import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

describe("Phase 1 D1 schema migrations", () => {
  it("preserves legacy slugs as aliases and enforces relational constraints", () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "phase1-d1-schema-"));
    const legacyMigrationsDirectory = join(temporaryDirectory, "legacy-migrations");
    const migrationsDirectory = resolve("infra/cloudflare/d1/migrations");
    const persistenceDirectory = join(temporaryDirectory, "persist");
    const configPath = join(temporaryDirectory, "wrangler.toml");
    const firstMigration = resolve(migrationsDirectory, "0001_phase1_core_schema.sql");
    const fixturePath = resolve("tests/fixtures/phase1-d1/minimal-core.sql");
    const databaseName = `phase1-schema-${process.pid}`;
    const databaseId = `phase1-schema-${process.pid}`;

    mkdirSync(legacyMigrationsDirectory);
    writeFileSync(join(legacyMigrationsDirectory, "0001_phase1_core_schema.sql"), readFileSync(firstMigration));

    function writeConfig(migrationPath: string) {
      writeFileSync(configPath, [
        'name = "phase1-schema-test"',
        'compatibility_date = "2026-11-13"',
        "[[d1_databases]]",
        'binding = "DB"',
        `database_name = "${databaseName}"`,
        `database_id = "${databaseId}"`,
        `migrations_dir = "${migrationPath}"`,
        "",
      ].join("\n"));
    }

    function wrangler(args: string[]) {
      const result = spawnSync("node", [resolve("node_modules/wrangler/bin/wrangler.js"), ...args, "--local", "--persist-to", persistenceDirectory, "--config", configPath], {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (result.status !== 0) throw new Error(result.stderr || result.stdout);
      return result.stdout;
    }

    function findDatabaseFiles(directory: string): string[] {
      return readdirSync(directory).flatMap((entry) => {
        const path = join(directory, entry);
        if (statSync(path).isDirectory()) return findDatabaseFiles(path);
        return path.endsWith(".sqlite") || path.endsWith(".sqlite3") ? [path] : [];
      });
    }

    try {
      writeConfig(legacyMigrationsDirectory);
      wrangler(["d1", "migrations", "apply", databaseName]);
      const setupPath = join(temporaryDirectory, "setup.sql");
      writeFileSync(setupPath, `${readFileSync(fixturePath, "utf8")}\nINSERT INTO slug_registry (slug,page_id,kind,created_at) VALUES ('fixture-reserved','page-test-01','reserved','2026-11-13T00:00:00Z');\n`);
      wrangler(["d1", "execute", databaseName, "--file", setupPath]);

      writeConfig(migrationsDirectory);
      wrangler(["d1", "migrations", "apply", databaseName]);

      const databaseFiles = findDatabaseFiles(persistenceDirectory);
      const databaseFile = databaseFiles.find((path) => {
        const candidate = new DatabaseSync(path);
        const hasSchema = candidate.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='slug_registry';").get() !== undefined;
        candidate.close();
        return hasSchema;
      });
      expect(databaseFile).toBeDefined();
      // Wrangler applies the D1 migrations; fast negative probes use its local SQLite persistence.
      const database = new DatabaseSync(databaseFile!);
      try {
        database.exec("PRAGMA foreign_keys = ON;");
        const slugs = database.prepare("SELECT slug,page_id,kind FROM slug_registry WHERE slug LIKE 'fixture-%' ORDER BY slug;").all();
        expect(slugs).toEqual([
          { slug: "fixture-business", page_id: "page-test-01", kind: "canonical" },
          { slug: "fixture-old-name", page_id: "page-test-01", kind: "alias" },
          { slug: "fixture-reserved", page_id: "page-test-01", kind: "alias" },
        ]);
        expect(database.prepare("PRAGMA foreign_key_list(slug_registry);").all()).toContainEqual(expect.objectContaining({ table: "business_pages", from: "page_id", to: "id" }));
        expect(database.prepare("PRAGMA table_info(slug_registry);").all().map((column) => column.name)).not.toContain("expires_at");
        expect(database.prepare("PRAGMA index_list(slug_registry);").all()).toContainEqual(expect.objectContaining({ name: "slug_registry_one_canonical_per_page_idx", unique: 1 }));
        expect(database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='slug_registry';").get()?.sql)
          .toContain("CHECK (kind IN ('canonical', 'alias'))");
        expect(database.prepare("PRAGMA foreign_key_check;").all()).toEqual([]);
        expect(database.prepare("SELECT has_menu FROM business_pages WHERE id='page-test-01';").get()).toEqual({ has_menu: 0 });
        const publishedSnapshot = JSON.parse(String(database.prepare("SELECT snapshot_json FROM page_publications WHERE id='pub-test-01';").get()?.snapshot_json));
        expect(publishedSnapshot).toMatchObject({ contact: { version: 1, enabled: true }, page: { hasMenu: false } });
        expect(database.prepare("PRAGMA table_info(page_publications);").all().map((column) => column.name)).not.toContain("contact_projection_json");

        const rejectedInserts = [
          "UPDATE business_pages SET has_menu=2 WHERE id='page-test-01';",
          "INSERT INTO slug_registry (slug,page_id,kind,created_at) VALUES ('fixture-old-name','page-test-01','alias','2026-11-13');",
          "INSERT INTO slug_registry (slug,page_id,kind,created_at) VALUES ('invalid-owner','missing-page','alias','2026-11-13');",
          "INSERT INTO slug_registry (slug,page_id,kind,created_at) VALUES ('invalid-kind','page-test-01','reserved','2026-11-13');",
          "INSERT INTO cards (id,batch_id,serial,token,status,created_at,updated_at) VALUES ('bad-token','batch-test-01','NT-20261113-000002','not-a-valid-token','unassigned','2026-11-13','2026-11-13');",
        ];
        for (const sql of rejectedInserts) expect(() => database.exec(sql)).toThrow();
      } finally {
        database.close();
      }
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  }, 120_000);
});
