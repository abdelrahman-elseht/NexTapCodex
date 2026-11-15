#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const matrix = JSON.parse(readFileSync(resolve(root, "infra/cloudflare/phase1-resource-matrix.json"), "utf8"));
export const TABLES = ["businesses", "business_pages", "page_sections", "slug_registry", "page_publications", "media_assets", "publication_media", "card_batches", "cards", "card_assignment_history", "audit_events", "operation_receipts"];
const MIGRATIONS = ["0001_phase1_core_schema.sql", "0002_permanent_slug_aliases.sql", "0003_approved_page_publication_contracts.sql"];
const BACKUP_BUCKET = "nextap-recovery-backup-20261114-7f3a";

export function makePrefix(environment, timestamp, nonce) {
  if (!new Set(["development", "staging"]).has(environment)) throw new Error("Scheduled backups are limited to development or staging.");
  if (!Number.isFinite(timestamp) || !/^[a-f0-9-]{36}$/.test(nonce)) throw new Error("Invalid scheduled backup run identity.");
  const date = new Date(timestamp);
  const runTime = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `scheduled/${environment}/${date.toISOString().slice(0, 10)}/${runTime}-${nonce}`;
}

export function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function byteLength(bytes) {
  return Buffer.byteLength(bytes);
}

const OBJECT_HEADERS = [
  ["ContentType", "--content-type"],
  ["CacheControl", "--cache-control"],
  ["ContentDisposition", "--content-disposition"],
  ["ContentEncoding", "--content-encoding"],
  ["ContentLanguage", "--content-language"],
  ["Expires", "--expires"],
  ["WebsiteRedirectLocation", "--website-redirect-location"],
];

export function objectMetadataArgs(metadata = {}) {
  const args = [];
  for (const [field, option] of OBJECT_HEADERS) {
    if (metadata[field] !== undefined && metadata[field] !== null) args.push(option, String(metadata[field]));
  }
  if (metadata.Metadata && Object.keys(metadata.Metadata).length) {
    args.push("--metadata", JSON.stringify(metadata.Metadata));
  }
  return args;
}

export function assertObjectReadback(expected, actual, key) {
  const expectedHeaders = Object.fromEntries(OBJECT_HEADERS.map(([field]) => [field, expected[field] ?? null]));
  const actualHeaders = Object.fromEntries(OBJECT_HEADERS.map(([field]) => [field, actual[field] ?? null]));
  if (JSON.stringify(expectedHeaders) !== JSON.stringify(actualHeaders)
    || JSON.stringify(expected.Metadata ?? {}) !== JSON.stringify(actual.Metadata ?? {})) {
    throw new Error(`Recovery R2 metadata readback verification failed for ${key}`);
  }
}

export function verifyObjectReadback(expectedBody, actualBody, expectedMetadata, actualMetadata, key) {
  if (actualBody.length !== expectedBody.length || digest(actualBody) !== digest(expectedBody)) {
    throw new Error(`Recovery R2 readback verification failed for ${key}`);
  }
  assertObjectReadback(expectedMetadata, actualMetadata, key);
}

export function requireNonProductionEnvironment(environment) {
  if (!new Set(["development", "staging"]).has(environment)) throw new Error("Scheduled backups are limited to development or staging.");
  return matrix.environments[environment];
}

export function sentryIngestUrl(dsn, monitorSlug) {
  if (!dsn || !monitorSlug) throw new Error("Sentry DSN and Cron Monitoring slug are required.");
  const parsed = new URL(dsn);
  const projectId = parsed.pathname.split("/").filter(Boolean).at(-1);
  if (parsed.protocol !== "https:" || !parsed.username || !projectId || !/^[a-zA-Z0-9_-]+$/.test(monitorSlug)) {
    throw new Error("Sentry DSN or monitor slug is invalid.");
  }
  return `${parsed.protocol}//${parsed.host}/api/${encodeURIComponent(projectId)}/cron/${encodeURIComponent(monitorSlug)}/${encodeURIComponent(parsed.username)}/`;
}

export function sanitizedAwsErrorDetails(stderr) {
  const output = typeof stderr === "string" ? stderr : "";
  const code = output.match(/An error occurred\s*\(([A-Za-z0-9_.-]{1,80})\)/i)?.[1]
    ?? output.match(/(?:^|[\s,{])(?:"?Code"?)\s*[:=]\s*"?([A-Za-z0-9_.-]{1,80})"?/i)?.[1];
  const status = output.match(/(?:HTTP\s*(?:Status\s*)?(?:Code)?|HTTPStatusCode)\s*[:=]\s*(\d{3})\b/i)?.[1];
  const requestId = output.match(/(?:x-amz-request-id|request\s*id|requestid)\s*[:=]\s*([A-Za-z0-9-]{1,128})\b/i)?.[1];
  const details = [
    code ? `Code=${code}` : null,
    status ? `HTTPStatus=${status}` : null,
    requestId ? `RequestId=${requestId}` : null,
  ].filter(Boolean);
  return details.length ? `AWS error details: ${details.join(", ")}.` : "AWS error details unavailable.";
}

function run(command, args, { quiet = false, sanitizeAws = false } = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.error || result.status !== 0) {
    if (!quiet && result.stderr) process.stderr.write(result.stderr);
    const diagnostic = sanitizeAws ? ` ${sanitizedAwsErrorDetails(result.stderr)}` : "";
    throw new Error(`${command} failed (${args.slice(0, 2).join(" ")}); sensitive command output was suppressed.${diagnostic}`);
  }
  return result.stdout;
}

function readRows(output) {
  const parsed = JSON.parse(output);
  return (Array.isArray(parsed) ? parsed : [parsed]).flatMap((batch) => batch.results ?? []);
}

function backupEnv(environment) {
  const target = requireNonProductionEnvironment(environment);
  if (!target) throw new Error("Backup environment is not an approved non-production target.");
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) throw new Error("Cloudflare API credentials are not configured.");
  for (const name of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]) if (!process.env[name]) throw new Error("R2 S3 credentials are not configured.");
  return matrix.environments[environment];
}

/** @param {{backup?: typeof createScheduledBackup, ingestUrl?: string, checkInId?: string, fetcher?: typeof fetch}} options */
export async function runMonitoredBackup(environment, options = {}) {
  requireNonProductionEnvironment(environment);
  const backup = options.backup ?? createScheduledBackup;
  const checkInId = options.checkInId ?? randomUUID();
  const fetcher = options.fetcher ?? fetch;
  let send;
  try {
    const ingestUrl = options.ingestUrl ?? sentryIngestUrl(process.env.SENTRY_DSN, process.env.SENTRY_CRON_MONITOR_SLUG);
    const url = new URL(ingestUrl);
    if (url.protocol !== "https:") throw new Error("Sentry Cron Monitoring requires an HTTPS ingest URL.");
    send = async (status, method) => {
      const checkInUrl = new URL(url);
      checkInUrl.searchParams.set("status", status);
      checkInUrl.searchParams.set("check_in_id", checkInId);
      checkInUrl.searchParams.set("environment", environment);
      const response = await fetcher(checkInUrl, {
        method,
        ...(method === "POST" ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status,
            monitor_config: {
              schedule: { type: "crontab", value: "15 0 * * *" },
              timezone: "UTC",
              max_runtime: 30,
            },
          }),
        } : {}),
      });
      if (!response.ok) throw new Error(`Sentry Cron Monitoring check-in failed with HTTP ${response.status}.`);
    };
  } catch (error) {
    process.stderr.write(`Sentry Cron Monitoring setup failed; continuing backup without check-ins: ${error instanceof Error ? error.message : "unknown error"}\n`);
  }
  const reportCheckInFailure = (error) => {
    process.stderr.write(`Sentry Cron Monitoring check-in failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
  };
  if (send) await send("in_progress", "POST").catch(reportCheckInFailure);
  try {
    const outcome = await backup(environment);
    if (send) await send("ok", "GET").catch(reportCheckInFailure);
    return outcome;
  } catch (error) {
    if (send) await send("error", "GET").catch(reportCheckInFailure);
    throw error;
  }
}

function runAws(args, quiet = false) {
  return run("aws", [...args, "--endpoint-url", `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`, "--region", "auto", "--no-cli-pager"], { quiet, sanitizeAws: true });
}

function runWrangler(configPath, args, quiet = false) {
  return run("wrangler", [...args, "--config", configPath], { quiet });
}

function configFor(environment, resources, directory) {
  const path = join(directory, "wrangler.toml");
  writeFileSync(path, [
    'name = "phase1-scheduled-backup"',
    'compatibility_date = "2026-11-13"',
    "[[d1_databases]]",
    'binding = "NEXTAP_DB"',
    `database_name = "${resources.d1.name}"`,
    `database_id = "${resources.d1.id}"`,
    `migrations_dir = "${resolve(root, "infra/cloudflare/d1/migrations")}"`,
    "",
  ].join("\n"));
  return path;
}

function assertMigrations(configPath, database) {
  const output = runWrangler(configPath, ["d1", "execute", database.name, "--remote", "--command", "SELECT name FROM d1_migrations ORDER BY id;", "--json"], true);
  const applied = new Set(readRows(output).map((row) => String(row.name).replace(/\.sql$/, "")));
  const missing = MIGRATIONS.filter((name) => !applied.has(name.replace(/\.sql$/, "")));
  if (missing.length) throw new Error(`Required migrations must be applied before scheduled export: ${missing.join(", ")}`);
}

function sourceInventory(bucket, prefix, directory) {
  const listed = JSON.parse(runAws(["s3api", "list-objects-v2", "--bucket", bucket, "--output", "json"], true));
  const objects = [];
  for (const entry of listed.Contents ?? []) {
    const localFile = join(directory, `source-${objects.length}`);
    const sourceObject = JSON.parse(runAws(["s3api", "get-object", "--bucket", bucket, "--key", entry.Key, "--output", "json", localFile], true));
    const bytes = readFileSync(localFile);
    const hash = digest(bytes);
    const backupKey = `${prefix}/media/${entry.Key}`;
    runAws(["s3api", "put-object", "--bucket", BACKUP_BUCKET, "--key", backupKey, "--body", localFile, ...objectMetadataArgs(sourceObject)], true);
    const readbackFile = join(directory, `readback-${objects.length}`);
    const readbackMetadata = JSON.parse(runAws(["s3api", "get-object", "--bucket", BACKUP_BUCKET, "--key", backupKey, "--output", "json", readbackFile], true));
    const readback = readFileSync(readbackFile);
    verifyObjectReadback(bytes, readback, sourceObject, readbackMetadata, backupKey);
    objects.push({ key: entry.Key, bytes: bytes.length, sha256: hash, backupKey, metadata: Object.fromEntries(OBJECT_HEADERS.map(([field]) => [field, sourceObject[field] ?? null])), customMetadata: sourceObject.Metadata ?? {} });
  }
  return objects.sort((left, right) => left.key.localeCompare(right.key));
}

function putAndVerify(key, localFile, directory, contentType) {
  const bytes = readFileSync(localFile);
  runAws(["s3api", "put-object", "--bucket", BACKUP_BUCKET, "--key", key, "--body", localFile, "--content-type", contentType], true);
  const readbackFile = join(directory, `verify-${randomUUID()}`);
  const readbackMetadata = JSON.parse(runAws(["s3api", "get-object", "--bucket", BACKUP_BUCKET, "--key", key, "--output", "json", readbackFile], true));
  const readback = readFileSync(readbackFile);
  verifyObjectReadback(bytes, readback, { ContentType: contentType }, readbackMetadata, key);
  return { bytes: bytes.length, sha256: digest(bytes) };
}

export async function createScheduledBackup(environment, { now = Date.now(), nonce = randomUUID() } = {}) {
  const resources = backupEnv(environment);
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "nextap-phase1-backup-"));
  const configPath = configFor(environment, resources, temporaryDirectory);
  const prefix = makePrefix(environment, now, nonce);
  try {
    assertMigrations(configPath, resources.d1);
    const sqlPath = join(temporaryDirectory, "data.sql");
    runWrangler(configPath, ["d1", "export", resources.d1.name, "--remote", "--output", sqlPath, "--compatibility", "d1", "--no-schema", "--skip-confirmation", ...TABLES.flatMap((table) => ["--table", table])], true);
    const sql = readFileSync(sqlPath);
    const media = sourceInventory(resources.r2.name, prefix, temporaryDirectory);
    const migrationDetails = MIGRATIONS.map((name) => ({ name, sha256: digest(readFileSync(resolve(root, "infra/cloudflare/d1/migrations", name))) }));
    const manifestPath = join(temporaryDirectory, "manifest.json");
    const manifest = {
      schemaVersion: 1,
      environment,
      createdAtUtc: new Date(now).toISOString(),
      source: { d1Name: resources.d1.name, d1Id: resources.d1.id, r2Name: resources.r2.name },
      format: "wrangler-d1-sql-data-only",
      tables: TABLES,
      migrations: migrationDetails,
      d1: { key: `${prefix}/database/data.sql`, bytes: byteLength(sql), sha256: digest(sql) },
      sourceMedia: media,
    };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const sqlVerification = putAndVerify(manifest.d1.key, sqlPath, temporaryDirectory, "application/sql");
    if (sqlVerification.sha256 !== manifest.d1.sha256) throw new Error("D1 artifact hash changed during upload verification.");
    const manifestVerification = putAndVerify(`${prefix}/manifest.json`, manifestPath, temporaryDirectory, "application/json");
    const successPath = join(temporaryDirectory, "SUCCESS.json");
    writeFileSync(successPath, `${JSON.stringify({ status: "success", prefix, manifestSha256: manifestVerification.sha256, completedAtUtc: new Date().toISOString() })}\n`);
    putAndVerify(`${prefix}/SUCCESS.json`, successPath, temporaryDirectory, "application/json");
    return { prefix, manifest };
  } catch (error) {
    const failurePath = join(temporaryDirectory, "FAILURE.json");
    writeFileSync(failurePath, `${JSON.stringify({ status: "failure", prefix, atUtc: new Date().toISOString(), error: error instanceof Error ? error.message : "Unknown failure" })}\n`);
    try { putAndVerify(`${prefix}/FAILURE.json`, failurePath, temporaryDirectory, "application/json"); } catch { /* the workflow failure and Sentry check-in remain the alert path */ }
    throw error;
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMonitoredBackup(process.argv[2], {
    ingestUrl: process.env.SENTRY_CRON_INGEST_URL,
    checkInId: `${process.env.GITHUB_RUN_ID ?? randomUUID()}-${process.env.GITHUB_RUN_ATTEMPT ?? "1"}`,
  }).then(({ prefix, manifest }) => {
    process.stdout.write(`Verified scheduled recovery generation ${prefix}: D1 ${manifest.d1.bytes} bytes and ${manifest.sourceMedia.length} media objects.\n`);
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Scheduled backup failed."}\n`);
    process.exitCode = 1;
  });
}
