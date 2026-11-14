import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { verifyR2ObjectReferences } from "../../scripts/cloudflare/phase1-restore-integrity.mjs";
import { describe, expect, it } from "vitest";
import { runD1Workflow } from "../../scripts/cloudflare/phase1-d1-workflow.mjs";

const enabled = process.env.RUN_PHASE1_D1_RESTORE === "1";

describe("Phase 1 R2 restore integrity", () => {
  const manifestJson = JSON.stringify({ objects: ["publication/restore"] });
  const mediaSha256 = createHash("sha256").update("synthetic-media-bytes").digest("hex");

  it("accepts all publication and media references when inventory keys and hashes match", () => {
    expect(verifyR2ObjectReferences({
      publications: [{ id: "pub-restore", artifact_key: "publication/restore", manifest_json: manifestJson, manifest_sha256: createHash("sha256").update(manifestJson).digest("hex") }],
      mediaReferences: [{ publication_id: "pub-restore", object_key: "media/restore", sha256: mediaSha256 }],
      objects: [{ key: "publication/restore" }, { key: "media/restore", sha256: mediaSha256 }],
    })).toMatchObject({ references: 2, mediaChecksums: 1, manifests: 1 });
  });

  it("rejects missing referenced objects and mismatched media checksums", () => {
    const input = {
      publications: [{ id: "pub-restore", artifact_key: "publication/restore", manifest_json: manifestJson, manifest_sha256: createHash("sha256").update(manifestJson).digest("hex") }],
      mediaReferences: [{ publication_id: "pub-restore", object_key: "media/restore", sha256: mediaSha256 }],
    };
    expect(() => verifyR2ObjectReferences({ ...input, objects: [] })).toThrow(/referenced objects are missing/);
    expect(() => verifyR2ObjectReferences({ ...input, objects: [{ key: "publication/restore" }, { key: "media/restore", sha256: "0".repeat(64) }] })).toThrow(/SHA-256 mismatch/);
  });

  it("rejects media references whose publication was not restored", () => {
    expect(() => verifyR2ObjectReferences({
      publications: [],
      mediaReferences: [{ publication_id: "pub-missing", object_key: "media/restore", sha256: mediaSha256 }],
      objects: [{ key: "media/restore", sha256: mediaSha256 }],
    })).toThrow(/missing publication pub-missing/);
  });
});

describe("Phase 1 D1 backup manifest", () => {
  it("records export identity, table allowlist, migrations, and artifact checksum without a remote call", async () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "phase1-d1-backup-test-"));
    const file = join(temporaryDirectory, "backup.sql");
    const manifest = join(temporaryDirectory, "backup.manifest.json");
    const artifact = "PRAGMA defer_foreign_keys=TRUE;\n";
    const wranglerCalls: string[][] = [];
    try {
      const result = await runD1Workflow({
        command: "backup", environment: "development", d1: "a64cabf6-b8f4-41aa-84fc-b7fed5d2dde7",
        r2: "nextap-dev-public", kv: "58df600b88a94da7806deb7ad5bc90c2",
        file, manifest, remote: true,
      }, { wrangler: (args) => {
        wranglerCalls.push(args);
        const outputIndex = args.indexOf("--output");
        writeFileSync(args[outputIndex + 1], artifact);
        return "";
      } });
      const metadata = JSON.parse(readFileSync(manifest, "utf8"));
      expect(wranglerCalls).toHaveLength(1);
      expect(wranglerCalls[0]).toContain("--remote");
      expect(wranglerCalls[0]).toContain("--no-schema");
      expect(metadata).toMatchObject({
        environment: "development",
        source: { d1Name: "nextap-dev-core", d1Id: "a64cabf6-b8f4-41aa-84fc-b7fed5d2dde7" },
        format: "wrangler-d1-sql-data-only",
        tables: expect.arrayContaining(["businesses", "operation_receipts"]),
        artifact: { file: "backup.sql", bytes: Buffer.byteLength(artifact), sha256: createHash("sha256").update(artifact).digest("hex") },
      });
      expect(metadata.exportedAtUtc).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(metadata.migrations.length).toBeGreaterThan(0);
      expect(result).toContain(metadata.artifact.sha256);
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});

describe("Phase 1 local D1 restore", () => {
  it.skipIf(!enabled)("restores migration-first data with matching rows and valid relationships", async () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "phase1-d1-restore-test-"));
    const id = randomUUID().replaceAll("-", "").slice(0, 12);
    const sourceName = `restore-source-${id}`;
    const targetName = `restore-target-${id}`;
    const migrationsDirectory = resolve("infra/cloudflare/d1/migrations");
    const targetPersistence = join(temporaryDirectory, "nextap-phase1-d1-workflow", "staging");
    const configPath = join(temporaryDirectory, "wrangler.toml");
    const dataPath = join(temporaryDirectory, "application-data.sql");
    const r2InventoryPath = join(temporaryDirectory, "r2-inventory.json");
    const previousTmpDir = process.env.TMPDIR;
    const tables = ["businesses", "business_pages", "slug_registry", "page_publications", "publication_media", "card_batches", "cards", "card_assignment_history"];
    const config = [
      'name = "phase1-restore-test"',
      'compatibility_date = "2026-11-13"',
      "[[d1_databases]]",
      'binding = "NEXTAP_DB"',
      `database_name = "${sourceName}"`,
      `database_id = "${id}-source"`,
      `migrations_dir = "${migrationsDirectory}"`,
      "",
    ].join("\n");
    writeFileSync(configPath, config);
    process.env.TMPDIR = temporaryDirectory;

    function wrangler(args: string[], persist?: string, quiet = false) {
      const options = [...args, "--local", ...(persist ? ["--persist-to", persist] : []), "--config", configPath];
      const result = spawnSync("node", [resolve("node_modules/wrangler/bin/wrangler.js"), ...options], {
        cwd: persist ? process.cwd() : temporaryDirectory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      });
      if (result.status !== 0) throw new Error(`Wrangler failed: ${result.stderr || result.stdout}`);
      return quiet ? "" : result.stdout;
    }

    function querySets(db: string, persist: string | undefined, sql: string) {
      return JSON.parse(wrangler(["d1", "execute", db, "--command", sql, "--json"], persist))
        .map((batch: { results?: unknown[] }) => batch.results ?? []);
    }

    function query(db: string, persist: string | undefined, sql: string) {
      return querySets(db, persist, sql).flat();
    }

    function checksum(rows: unknown[]) {
      return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
    }

    const allApplicationRowsSql = tables.map((table) => `SELECT * FROM "${table}" ORDER BY rowid;`).join(" ");

    try {
      wrangler(["d1", "migrations", "apply", sourceName], undefined, true);
      const seed = [
        "PRAGMA defer_foreign_keys=TRUE;",
        "INSERT INTO businesses (id,name,created_at,updated_at) VALUES ('biz-restore','Restore fixture','2026-11-13','2026-11-13');",
        "INSERT INTO business_pages (id,business_id,page_type,template,is_active,published_publication_id,created_at,updated_at) VALUES ('page-restore','biz-restore','main','cafe',1,'pub-restore','2026-11-13','2026-11-13');",
        "INSERT INTO slug_registry (slug,page_id,kind,created_at) VALUES ('restore-fixture','page-restore','canonical','2026-11-13');",
        "INSERT INTO slug_registry (slug,page_id,kind,created_at) VALUES ('restore-fixture-old','page-restore','alias','2026-11-13');",
        `INSERT INTO page_publications (id,page_id,version,snapshot_json,artifact_key,manifest_json,manifest_sha256,published_by_subject,verified_at,created_at) VALUES ('pub-restore','page-restore',1,'{}','artifact/restore','${JSON.stringify({ objects: ["media/restore"] })}', '${createHash("sha256").update(JSON.stringify({ objects: ["media/restore"] })).digest("hex")}','owner:test','2026-11-13','2026-11-13');`,
        `INSERT INTO publication_media (publication_id,object_key,sha256) VALUES ('pub-restore','media/restore','${createHash("sha256").update("synthetic-media-bytes").digest("hex")}');`,
        "INSERT INTO card_batches (id,name,quantity,created_by_subject,created_at) VALUES ('batch-restore','Restore batch',1,'owner:test','2026-11-13');",
        "INSERT INTO cards (id,batch_id,serial,token,page_id,status,created_at,updated_at) VALUES ('card-restore','batch-restore','NT-00000001-000001','0123456789abcdef0123456789abcdef','page-restore','active','2026-11-13','2026-11-13');",
        "INSERT INTO card_assignment_history (id,card_id,old_status,new_status,changed_by_subject,reason,created_at) VALUES ('history-restore','card-restore','unassigned','active','owner:test','activation','2026-11-13');",
      ].join("\n");
      writeFileSync(r2InventoryPath, JSON.stringify({ objects: [
        { key: "artifact/restore" },
        { key: "media/restore", sha256: createHash("sha256").update("synthetic-media-bytes").digest("hex") },
      ] }));
      const seedPath = join(temporaryDirectory, "seed.sql");
      writeFileSync(seedPath, seed);
      wrangler(["d1", "execute", sourceName, "--file", seedPath, "--json"], undefined, true);

      wrangler(["d1", "export", sourceName, "--output", dataPath, "--compatibility", "d1", "--no-schema", "--skip-confirmation", ...tables.flatMap((table) => ["--table", table])], undefined, true);
      const sourceRows = query(sourceName, undefined, "SELECT b.id AS business_id,p.id AS page_id,s.slug,pub.id AS publication_id,c.id AS card_id,h.id AS history_id FROM businesses b JOIN business_pages p ON p.business_id=b.id JOIN slug_registry s ON s.page_id=p.id JOIN page_publications pub ON pub.page_id=p.id AND p.published_publication_id=pub.id JOIN cards c ON c.page_id=p.id JOIN card_assignment_history h ON h.card_id=c.id ORDER BY b.id,p.id,s.slug,pub.id,c.id,h.id;");
      const sourceChecksum = checksum(sourceRows);
      const sourceDataChecksum = checksum(querySets(sourceName, undefined, allApplicationRowsSql));

      const matrix = { environments: {
        development: { status: "ready", d1: { name: sourceName, id: `${id}-source` }, r2: { name: "test-bucket" }, kv: { name: "test-kv", id: `${id}-kv` } },
        staging: { status: "ready", d1: { name: targetName, id: `${id}-target` }, r2: { name: "stage-bucket" }, kv: { name: "stage-kv", id: `${id}-stage-kv` } },
        production: { status: "not-authorized", d1: null, r2: null, kv: null },
      } };
      const result = await runD1Workflow({
        command: "restore", environment: "staging", d1: `${id}-target`, r2: "stage-bucket", kv: `${id}-stage-kv`, file: dataPath, r2Inventory: r2InventoryPath,
      }, { matrix });
      expect(result).toContain("2 R2 references, 1 media checksums, and 1 manifest checksums");

      writeFileSync(configPath, config
        .replace(`database_name = "${sourceName}"`, `database_name = "${targetName}"`)
        .replace(`database_id = "${id}-source"`, `database_id = "${id}-target"`));
      const targetRows = query(targetName, targetPersistence, "SELECT b.id AS business_id,p.id AS page_id,s.slug,pub.id AS publication_id,c.id AS card_id,h.id AS history_id FROM businesses b JOIN business_pages p ON p.business_id=b.id JOIN slug_registry s ON s.page_id=p.id JOIN page_publications pub ON pub.page_id=p.id AND p.published_publication_id=pub.id JOIN cards c ON c.page_id=p.id JOIN card_assignment_history h ON h.card_id=c.id ORDER BY b.id,p.id,s.slug,pub.id,c.id,h.id;");
      expect(checksum(targetRows)).toBe(sourceChecksum);
      expect(targetRows).toHaveLength(2);
      const targetDataChecksum = checksum(querySets(targetName, targetPersistence, allApplicationRowsSql));
      expect(targetDataChecksum).toBe(sourceDataChecksum);
      const counts = query(targetName, targetPersistence, `SELECT ${tables.map((table) => `(SELECT COUNT(*) FROM "${table}") AS "${table}"`).join(", ")};`)[0];
      expect(counts).toMatchObject({ businesses: 1, business_pages: 1, slug_registry: 2, page_publications: 1, publication_media: 1, card_batches: 1, cards: 1, card_assignment_history: 1 });
      const foreignKeyViolations = query(targetName, targetPersistence, "PRAGMA foreign_key_check;");
      expect(foreignKeyViolations).toEqual([]);
      process.stdout.write(`D1 restore evidence: rows_sha256=${sourceDataChecksum}; relationship_sha256=${sourceChecksum}; counts=${JSON.stringify(counts)}; relationship_rows=${targetRows.length}; foreign_key_violations=${foreignKeyViolations.length}\n`);
    } finally {
      if (previousTmpDir === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = previousTmpDir;
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  }, 300_000);
});
