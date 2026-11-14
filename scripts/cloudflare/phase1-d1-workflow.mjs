#!/usr/bin/env node
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { runPhase1Mutation } from "./phase1-target-check.mjs";
import { verifyR2ObjectReferences } from "./phase1-restore-integrity.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const matrixPath = resolve(root, "infra/cloudflare/phase1-resource-matrix.json");
const defaultMigrationsDir = resolve(root, "infra/cloudflare/d1/migrations");
const applicationTablesSql = "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('_cf_KV', 'd1_migrations') ORDER BY name;";
const backupTables = ["businesses", "business_pages", "page_sections", "slug_registry", "page_publications", "media_assets", "publication_media", "card_batches", "cards", "card_assignment_history", "audit_events", "operation_receipts"];

function parseArgs(args) {
  const options = { command: args[0] };
  const keys = new Map([
    ["--environment", "environment"], ["--d1", "d1"], ["--r2", "r2"],
    ["--kv", "kv"], ["--migrations-dir", "migrationsDir"], ["--file", "file"], ["--manifest", "manifest"], ["--r2-inventory", "r2Inventory"],
  ]);
  for (let i = 1; i < args.length; i += 1) {
    if (args[i] === "--remote") options.remote = true;
    else if (keys.has(args[i]) && args[i + 1]) options[keys.get(args[i])] = args[++i];
    else throw new Error("Usage: phase1-d1-workflow.mjs <status|apply|backup|restore> --environment development|staging --d1 <name-or-id> --r2 <name> --kv <name-or-id> [--remote] [--migrations-dir <path>] [--file <sql-file>] [--manifest <json-file>]");
  }
  if (!["status", "apply", "backup", "restore"].includes(options.command)) throw new Error("Command must be status, apply, backup, or restore.");
  for (const key of ["environment", "d1", "r2", "kv"]) if (!options[key]) throw new Error(`--${key} is required.`);
  if (options.command === "restore" && !options.file) throw new Error("--file is required for restore.");
  if (options.command === "backup" && (!options.file || !options.manifest)) throw new Error("backup requires --file and --manifest.");
  if (options.manifest && options.command !== "backup") throw new Error("--manifest is only valid for backup.");
  if (options.r2Inventory && options.command !== "restore") throw new Error("--r2-inventory is only valid for restore.");
  return options;
}

function migrationsIn(directory) {
  let entries;
  try { entries = readdirSync(directory, { withFileTypes: true }); }
  catch { throw new Error(`D1 migration directory is unavailable: ${directory}`); }
  const files = entries.filter((entry) => entry.isFile() && /^\d+_.+\.sql$/.test(entry.name)).map((entry) => entry.name).sort();
  if (files.length === 0) throw new Error(`No numbered D1 migration SQL files found in ${directory}.`);
  return files;
}

function readJsonResult(output) {
  const parsed = JSON.parse(output);
  const batch = Array.isArray(parsed) ? parsed : [parsed];
  return batch.flatMap((item) => item.results ?? []);
}

function rowCountSql(tableNames) {
  return `SELECT ${tableNames.map((name) => `(SELECT COUNT(*) FROM "${name.replaceAll('"', '""')}") AS "${name.replaceAll('"', '""')}"`).join(", ")};`;
}

function dataStatements(sql) {
  const statements = [];
  let start = 0;
  let quote = null;
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    if (quote) {
      if (char === quote && sql[index + 1] === quote) index += 1;
      else if (char === quote) quote = null;
    } else if (char === "'" || char === '"') quote = char;
    else if (char === ";") {
      const statement = sql.slice(start, index).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
  }
  if (quote) throw new Error("Restore SQL contains an unterminated quoted value.");
  const tail = sql.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

function validateDataOnlySql(sql) {
  const statements = dataStatements(sql);
  const allowed = statements.length > 0 && statements.every((statement) =>
    /^PRAGMA\s+defer_foreign_keys\s*=\s*(?:TRUE|ON|1)$/i.test(statement)
    || /^INSERT\s+INTO\s+(?:"(?:[^"]|"")+"|[A-Za-z_][A-Za-z0-9_]*)\s*\([^;]*\)\s+VALUES\s*\(/i.test(statement),
  );
  if (!allowed) throw new Error("Restore SQL accepts only INSERT INTO ... VALUES statements and Wrangler's PRAGMA defer_foreign_keys; export data-only with --no-schema and explicit application --table flags.");
}

function createWranglerRunner(run = spawnSync) {
  return (args, { quiet = false } = {}) => {
    const result = run("npx", ["wrangler", ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Wrangler command failed (${args.slice(0, 3).join(" ")}). Check the command and target credentials; output was suppressed.`);
    return quiet ? "" : result.stdout;
  };
}

export async function runD1Workflow(options, { matrix = JSON.parse(readFileSync(matrixPath, "utf8")), wrangler = createWranglerRunner() } = {}) {
  // Validate every declared environment identity before inspecting files or invoking Wrangler.
  return runPhase1Mutation({
    matrix,
    environment: options.environment,
    targetResources: { d1: options.d1, r2: options.r2, kv: options.kv },
    execute: async ({ resources }) => {
      const db = resources.d1.name;
      const temporaryDirectory = mkdtempSync(resolve(tmpdir(), "phase1-wrangler-"));
      const configPath = resolve(temporaryDirectory, "wrangler.toml");
      const persistencePath = resolve(tmpdir(), "nextap-phase1-d1-workflow", options.environment);
      const migrationsDirectory = resolve(root, options.migrationsDir ?? defaultMigrationsDir);
      writeFileSync(configPath, [
        'name = "phase1-d1-workflow"',
        'compatibility_date = "2026-11-13"',
        "[[d1_databases]]",
        'binding = "NEXTAP_DB"',
        `database_name = "${resources.d1.name}"`,
        `database_id = "${resources.d1.id}"`,
        `migrations_dir = "${migrationsDirectory}"`,
        "",
      ].join("\n"));
      const target = [options.remote ? "--remote" : "--local", ...(options.remote ? [] : ["--persist-to", persistencePath]), "--config", configPath];
      try {
      if (options.command === "status") {
        return wrangler(["d1", "migrations", "list", db, ...target]);
      }
      if (options.command === "backup") {
        if (!options.remote) throw new Error("D1 backups require --remote so the artifact represents the declared Cloudflare database.");
        const file = resolve(root, options.file);
        const manifestPath = resolve(root, options.manifest);
        if (file === manifestPath || statSync(file, { throwIfNoEntry: false }) || statSync(manifestPath, { throwIfNoEntry: false })) {
          throw new Error("Backup SQL and manifest paths must be distinct and must not already exist.");
        }
        const migrations = migrationsIn(migrationsDirectory).map((name) => {
          const migration = readFileSync(resolve(migrationsDirectory, name));
          return { name, sha256: createHash("sha256").update(migration).digest("hex") };
        });
        wrangler(["d1", "export", db, "--remote", "--output", file, "--compatibility", "d1", "--no-schema", "--skip-confirmation", ...backupTables.flatMap((table) => ["--table", table])], { quiet: true });
        const artifact = readFileSync(file);
        const manifest = {
          schemaVersion: 1,
          environment: options.environment,
          source: { d1Name: resources.d1.name, d1Id: resources.d1.id },
          exportedAtUtc: new Date().toISOString(),
          format: "wrangler-d1-sql-data-only",
          tables: backupTables,
          migrations,
          artifact: { file: file.split(/[\\/]/).at(-1), bytes: artifact.length, sha256: createHash("sha256").update(artifact).digest("hex") },
        };
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
        return `D1 export created for ${options.environment}; ${artifact.length} bytes, SHA-256 ${manifest.artifact.sha256}. Protect the SQL and manifest together; this command does not back up R2.`;
      }
      if (options.command === "apply") {
        const files = migrationsIn(migrationsDirectory);
        wrangler(["d1", "migrations", "apply", db, ...target], { quiet: true });
        const rows = readJsonResult(wrangler(["d1", "execute", db, ...target, "--command", "SELECT name FROM d1_migrations ORDER BY id;", "--json"]));
        const applied = new Set(rows.map((row) => row.name));
        const pending = files.filter((name) => !applied.has(name) && !applied.has(name.replace(/\.sql$/, "")));
        if (pending.length) throw new Error(`Migration verification failed; not recorded as applied: ${pending.join(", ")}`);
        return `Verified ${files.length} migration(s) applied to ${options.environment}.`;
      }

      const file = resolve(root, options.file);
      if (!statSync(file, { throwIfNoEntry: false })?.isFile()) throw new Error(`Restore SQL file is unavailable: ${options.file}`);
      const sql = readFileSync(file, "utf8");
      validateDataOnlySql(sql);
      const files = migrationsIn(migrationsDirectory);
      wrangler(["d1", "migrations", "apply", db, ...target], { quiet: true });
      const ledger = readJsonResult(wrangler(["d1", "execute", db, ...target, "--command", "SELECT name FROM d1_migrations ORDER BY id;", "--json"]));
      const applied = new Set(ledger.map((row) => row.name));
      const pending = files.filter((name) => !applied.has(name) && !applied.has(name.replace(/\.sql$/, "")));
      if (pending.length) throw new Error(`Restore schema verification failed; migrations not recorded as applied: ${pending.join(", ")}`);
      const tables = readJsonResult(wrangler(["d1", "execute", db, ...target, "--command", applicationTablesSql, "--json"])).map((row) => row.name);
      if (!tables.length) throw new Error("Restore target schema has no application tables.");
      const counts = readJsonResult(wrangler(["d1", "execute", db, ...target, "--command", rowCountSql(tables), "--json"]))[0] ?? {};
      const occupied = tables.filter((name) => Number(counts[name]) > 0);
      if (occupied.length) throw new Error(`Restore target must contain no application rows; found data in: ${occupied.join(", ")}.`);
      wrangler(["d1", "execute", db, ...target, "--file", file, "--json"], { quiet: true });
      const restoredTables = readJsonResult(wrangler(["d1", "execute", db, ...target, "--command", applicationTablesSql, "--json"])).map((row) => row.name);
      const restoredCounts = readJsonResult(wrangler(["d1", "execute", db, ...target, "--command", rowCountSql(restoredTables), "--json"]))[0] ?? {};
      const populated = restoredTables.filter((name) => Number(restoredCounts[name]) > 0);
      if (!populated.length) throw new Error("Restore verification failed; no application rows were found after import.");
      if (options.r2Inventory) {
        const inventory = JSON.parse(readFileSync(resolve(root, options.r2Inventory), "utf8"));
        const publications = readJsonResult(wrangler(["d1", "execute", db, ...target, "--command", "SELECT id, artifact_key, manifest_json, manifest_sha256 FROM page_publications ORDER BY id;", "--json"]));
        const mediaReferences = readJsonResult(wrangler(["d1", "execute", db, ...target, "--command", "SELECT publication_id, object_key, sha256 FROM publication_media ORDER BY publication_id, object_key;", "--json"]));
        const integrity = verifyR2ObjectReferences({ publications, mediaReferences, objects: inventory.objects });
        return `Data-only restore completed in ${options.environment}; verified ${files.length} migration(s), ${populated.length} populated table(s), ${integrity.references} R2 references, ${integrity.mediaChecksums} media checksums, and ${integrity.manifests} manifest checksums.`;
      }
      return `Data-only transport restore completed in ${options.environment} after verifying ${files.length} migration(s); ${populated.length} table(s) contain restored rows (content integrity not verified; no R2 inventory supplied).`;
      } finally {
        rmSync(temporaryDirectory, { recursive: true, force: true });
      }
    },
  });
}

async function main(args) {
  const result = await runD1Workflow(parseArgs(args));
  process.stdout.write(`${result}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
