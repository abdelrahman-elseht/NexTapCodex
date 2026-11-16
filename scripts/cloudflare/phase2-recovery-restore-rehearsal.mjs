#!/usr/bin/env node
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runD1Workflow } from "./phase1-d1-workflow.mjs";
import { TABLES } from "./phase1-scheduled-backup.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const BACKUP_BUCKET = "nextap-recovery-backup-20261114-7f3a";
const PREFIX = "scheduled/staging/2026-11-15/20261115T194450Z-fcc5661b-5f81-44cf-944a-459db25734b8";
const MIGRATIONS = resolve(root, "infra/cloudflare/d1/migrations");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let stageId = "config";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
function fail() { throw new Error("recovery operation failed"); }

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  if (result.error || result.status !== 0) fail();
  return result.stdout;
}

function safeKey(key) {
  return typeof key === "string" && key.startsWith(`${PREFIX}/`)
    && !key.includes("\\") && key.split("/").every((part) => part && part !== "." && part !== "..");
}

function getObject(key, destination) {
  if (!safeKey(key)) fail();
  run("aws", [
    "s3api", "get-object", "--bucket", BACKUP_BUCKET, "--key", key, "--output", "json", destination,
    "--endpoint-url", `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    "--region", "auto", "--no-cli-pager",
  ]);
  return readFileSync(destination);
}

function validateGeneration({ prefix, successBytes, manifestBytes, expectedSource, expectedTables }) {
  let success;
  let manifest;
  try {
    success = JSON.parse(successBytes);
    manifest = JSON.parse(manifestBytes);
  } catch { fail(); }
  if (prefix !== PREFIX || success.status !== "success" || success.prefix !== prefix
    || success.manifestSha256 !== digest(manifestBytes) || !Array.isArray(manifest.sourceMedia)
    || manifest.environment !== "staging"
    || manifest.source?.d1Name !== expectedSource.name || manifest.source?.d1Id !== expectedSource.id
    || manifest.source?.r2Name !== "nextap-staging-public" || manifest.format !== "wrangler-d1-sql-data-only"
    || JSON.stringify(manifest.tables) !== JSON.stringify(expectedTables)
    || !manifest.d1 || manifest.d1.key !== `${prefix}/database/data.sql`
    || !Number.isSafeInteger(manifest.d1.bytes) || manifest.d1.bytes <= 0
    || !/^[a-f0-9]{64}$/.test(manifest.d1.sha256 ?? "")
    || !Array.isArray(manifest.migrations) || !Array.isArray(manifest.sourceMedia)) fail();
  return manifest;
}

function validateSqlArtifact(manifest, sqlBytes) {
  if (sqlBytes.length !== manifest.d1.bytes || digest(sqlBytes) !== manifest.d1.sha256) fail();
}

function readRows(stdout) {
  const parsed = JSON.parse(stdout);
  const batches = Array.isArray(parsed) ? parsed : [parsed];
  return batches.flatMap((batch) => batch.results ?? []);
}

function migrationInventory() {
  return readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^\d+_.+\.sql$/.test(entry.name))
    .map((entry) => {
      const bytes = readFileSync(resolve(MIGRATIONS, entry.name));
      return { name: entry.name, sha256: digest(bytes) };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function verifyMigrationInventory(manifest) {
  if (JSON.stringify(manifest.migrations) !== JSON.stringify(migrationInventory())) fail();
}

function downloadMediaAndTombstones(manifest, directory) {
  const inventory = [];
  const deletionDirectory = join(directory, "deletions");
  mkdirSync(deletionDirectory, { mode: 0o700 });
  for (const [index, media] of manifest.sourceMedia.entries()) {
    if (typeof media.key !== "string" || !media.key || !Number.isSafeInteger(media.bytes)
      || !/^[a-f0-9]{64}$/.test(media.sha256 ?? "")) fail();
    if (media.deleted) {
      const deletion = media.deletionRecord;
      if (!deletion || !safeKey(deletion.key) || !deletion.key.startsWith(`${PREFIX}/deletions/`)
        || basename(deletion.key) !== deletion.key.slice(`${PREFIX}/deletions/`.length)) fail();
      const target = join(deletionDirectory, basename(deletion.key));
      const bytes = getObject(deletion.key, target);
      if (digest(bytes) !== deletion.sha256) fail();
      continue;
    }
    const expectedKey = `${PREFIX}/media/${media.key}`;
    if (media.backupKey !== expectedKey || !safeKey(media.backupKey)) fail();
    const path = join(directory, `media-${index}`);
    const bytes = getObject(media.backupKey, path);
    if (bytes.length !== media.bytes || digest(bytes) !== media.sha256) fail();
    inventory.push({ key: media.key, sha256: media.sha256 });
  }
  const inventoryPath = join(directory, "r2-inventory.json");
  writeFileSync(inventoryPath, `${JSON.stringify({ objects: inventory })}\n`, { mode: 0o600, flag: "wx" });
  return inventoryPath;
}

function createScratchName() {
  const runId = process.env.GITHUB_RUN_ID;
  const attempt = process.env.GITHUB_RUN_ATTEMPT;
  if (!/^\d+$/.test(runId ?? "") || !/^\d+$/.test(attempt ?? "")) fail();
  return `nextap-p2-recovery-${runId}-${attempt}`;
}

function createScratchDatabase(name) {
  stageId = "scratch_create";
  const output = run("wrangler", ["d1", "create", name, "--location", "eeur"]);
  const id = output.match(/database_id\s*=\s*["']([0-9a-f-]{36})["']/i)?.[1];
  if (!id || !UUID.test(id)) fail();
  return id;
}

function countQuery() {
  const columns = TABLES.map((table) => `(SELECT COUNT(*) FROM "${table}") AS "${table}"`);
  return `SELECT ${columns.join(", ")};`;
}

async function main() {
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID
    || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) fail();
  const tempRoot = process.env.RUNNER_TEMP || tmpdir();
  const directory = mkdtempSync(join(tempRoot, "nextap-p2-recovery-"));
  chmodSync(directory, 0o700);
  try {
    stageId = "backup_metadata";
    const successPath = join(directory, "SUCCESS.json");
    const successBytes = getObject(`${PREFIX}/SUCCESS.json`, successPath);
    const success = JSON.parse(successBytes);
    const manifestName = success.manifestKey ? basename(success.manifestKey) : "manifest.json";
    if (success.manifestKey && (!safeKey(success.manifestKey) || !success.manifestKey.startsWith(`${PREFIX}/manifest`)
      || !/^manifest(?:-[a-f0-9]{64})?\.json$/.test(manifestName))) fail();
    const manifestPath = join(directory, manifestName);
    const manifestBytes = getObject(success.manifestKey || `${PREFIX}/manifest.json`, manifestPath);
    const matrix = JSON.parse(readFileSync(resolve(root, "infra/cloudflare/phase1-resource-matrix.json"), "utf8"));
    const staging = matrix.environments.staging;
    const manifest = validateGeneration({ prefix: PREFIX, successBytes, manifestBytes, expectedSource: staging.d1, expectedTables: TABLES });
    verifyMigrationInventory(manifest);

    stageId = "backup_sql";
    const sqlPath = join(directory, "data.sql");
    const sqlBytes = getObject(manifest.d1.key, sqlPath);
    validateSqlArtifact(manifest, sqlBytes);
    const r2Inventory = downloadMediaAndTombstones(manifest, directory);
    const generationDirectory = join(directory, "generation");
    mkdirSync(generationDirectory, { mode: 0o700 });
    copyFileSync(successPath, join(generationDirectory, "SUCCESS.json"));
    copyFileSync(manifestPath, join(generationDirectory, manifestName));
    const deletionPath = join(generationDirectory, "deletions");
    if (existsSync(join(directory, "deletions"))) {
      mkdirSync(deletionPath, { mode: 0o700 });
      for (const file of readdirSync(join(directory, "deletions"))) copyFileSync(join(directory, "deletions", file), join(deletionPath, file));
    }

    const scratchName = createScratchName();
    const scratchId = createScratchDatabase(scratchName);
    const scratchMatrix = structuredClone(matrix);
    scratchMatrix.environments.staging.d1 = { ...staging.d1, name: scratchName, id: scratchId };
    const configSnapshot = join(directory, "scratch.wrangler.toml");
    const wrangler = (args, { quiet = false } = {}) => {
      const configIndex = args.indexOf("--config");
      if (configIndex >= 0 && args[configIndex + 1] && existsSync(args[configIndex + 1])) {
        copyFileSync(args[configIndex + 1], configSnapshot);
        chmodSync(configSnapshot, 0o600);
      }
      stageId = args.includes("apply") ? "scratch_migrations" : args.includes("--file") ? "scratch_restore" : "scratch_verify";
      const output = run("wrangler", args);
      return quiet ? "" : output;
    };
    stageId = "scratch_restore";
    const restoreResult = await runD1Workflow({
      command: "restore",
      environment: "staging",
      d1: scratchName,
      r2: staging.r2.name,
      kv: staging.kv.id,
      remote: true,
      file: sqlPath,
      r2Inventory,
      recoveryGeneration: generationDirectory,
    }, { matrix: scratchMatrix, wrangler });

    stageId = "scratch_foreign_keys";
    const configArgs = ["--config", configSnapshot];
    const fkRows = readRows(run("wrangler", ["d1", "execute", scratchName, "--remote", ...configArgs, "--command", "PRAGMA foreign_key_check;", "--json"]));
    if (fkRows.length !== 0) fail();
    stageId = "scratch_counts";
    const countRows = readRows(run("wrangler", ["d1", "execute", scratchName, "--remote", ...configArgs, "--command", countQuery(), "--json"]));
    if (countRows.length !== 1 || !TABLES.some((table) => Number(countRows[0][table]) > 0)) fail();
    const counts = Object.fromEntries(TABLES.map((table) => [table, Number(countRows[0][table])]));
    process.stdout.write(`${JSON.stringify({
      status: "restored",
      environment: "staging",
      backupPrefix: PREFIX,
      scratchD1: scratchName,
      scratchD1Id: scratchId,
      migrations: manifest.migrations.length,
      tableCounts: counts,
      foreignKeyViolations: 0,
      r2ObjectsVerified: JSON.parse(readFileSync(r2Inventory, "utf8")).objects.length,
      restoreResult,
    })}\n`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    process.stderr.write(`${JSON.stringify({ status: "failed", stageId, errorCategory: "operation_error" })}\n`);
    process.exitCode = 1;
  });
}

export { validateGeneration, validateSqlArtifact };
