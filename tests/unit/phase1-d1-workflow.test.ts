import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";
import { runD1Workflow } from "../../scripts/cloudflare/phase1-d1-workflow.mjs";

const matrix = {
  environments: {
    development: { status: "ready", d1: { name: "dev-db", id: "dev-id" }, r2: { name: "dev-bucket" }, kv: { name: "dev-kv", id: "dev-kv-id" } },
    staging: { status: "ready", d1: { name: "stage-db", id: "stage-id" }, r2: { name: "stage-bucket" }, kv: { name: "stage-kv", id: "stage-kv-id" } },
    production: { status: "not-authorized", d1: null, r2: null, kv: null },
  },
};

const options = (extra = {}) => ({ command: "apply", environment: "development", d1: "dev-id", r2: "dev-bucket", kv: "dev-kv-id", ...extra });

describe("Phase 1 D1 workflow", () => {
  function withArtifacts(callback: (artifacts: { migrationsDir: string; restoreFile: string }) => Promise<void>) {
    const directory = mkdtempSync(join(tmpdir(), "phase1-d1-workflow-"));
    const migrationsDir = join(directory, "migrations");
    mkdirSync(migrationsDir);
    writeFileSync(join(migrationsDir, "0001_initial.sql"), "CREATE TABLE sample (id TEXT PRIMARY KEY);");
    writeFileSync(join(migrationsDir, "0002_indexes.sql"), "CREATE INDEX sample_id ON sample (id);");
    writeFileSync(join(migrationsDir, "0003_menu_flag.sql"), "ALTER TABLE sample ADD COLUMN has_menu INTEGER NOT NULL DEFAULT 0 CHECK (has_menu IN (0, 1));");
    const restoreFile = join(directory, "restore.sql");
    writeFileSync(restoreFile, "PRAGMA defer_foreign_keys=TRUE;\nINSERT INTO sample (id) VALUES ('synthetic-row');");
    return callback({ migrationsDir, restoreFile }).finally(() => rmSync(directory, { recursive: true, force: true }));
  }

  it("refuses production before invoking the Wrangler boundary", async () => {
    const wrangler = vi.fn();
    await expect(runD1Workflow(options({ environment: "production", d1: "prod" }), { matrix, wrangler })).rejects.toThrow(/limited to development or staging/);
    expect(wrangler).not.toHaveBeenCalled();
  });

  it("rejects any mismatched resource identity before invoking Wrangler", async () => {
    const wrangler = vi.fn();
    await expect(runD1Workflow(options({ r2: "stage-bucket" }), { matrix, wrangler })).rejects.toThrow(/R2 target does not match/);
    expect(wrangler).not.toHaveBeenCalled();
  });

  it("applies and verifies each numbered migration against the exact declared database", async () => {
    await withArtifacts(async ({ migrationsDir }) => {
      const wrangler = vi.fn()
        .mockReturnValueOnce("")
        .mockReturnValueOnce(JSON.stringify([{ results: [{ name: "0001_initial.sql" }, { name: "0002_indexes.sql" }, { name: "0003_menu_flag.sql" }] }]));
      const result = await runD1Workflow(options({ migrationsDir }), { matrix, wrangler });
      expect(result).toContain("Verified 3 migration(s)");
      expect(wrangler.mock.calls[0][0]).toContain("dev-db");
      expect(wrangler.mock.calls[0][0]).toContain("--local");
      expect(wrangler.mock.calls[1][0]).toContain("SELECT name FROM d1_migrations ORDER BY id;");
    });
  });

  it("uses the repository D1 migration directory by default", async () => {
    const wrangler = vi.fn((args: string[]) => {
      if (args[1] === "migrations") {
        const config = args[args.indexOf("--config") + 1];
        expect(readFileSync(config, "utf8")).toContain(`migrations_dir = "${resolve("infra/cloudflare/d1/migrations")}"`);
        return "";
      }
      return JSON.stringify([{ results: [
        { name: "0001_phase1_core_schema.sql" },
        { name: "0002_permanent_slug_aliases.sql" },
        { name: "0003_approved_page_publication_contracts.sql" },
      ] }]);
    });
    await expect(runD1Workflow(options(), { matrix, wrangler })).resolves.toContain("Verified 3 migration(s)");
  });

  it("reports a migration set that Wrangler did not record as fully applied", async () => {
    await withArtifacts(async ({ migrationsDir }) => {
      const wrangler = vi.fn().mockReturnValueOnce("").mockReturnValueOnce(JSON.stringify([{ results: [{ name: "0001_initial.sql" }] }]));
      await expect(runD1Workflow(options({ migrationsDir }), { matrix, wrangler })).rejects.toThrow(/0002_indexes.sql/);
    });
  });

  it("migrates an empty target before restoring a data-only artifact", async () => {
    await withArtifacts(async ({ restoreFile }) => {
      const wrangler = vi.fn()
        .mockReturnValueOnce("")
        .mockReturnValueOnce(JSON.stringify([{ results: [
          { name: "0001_phase1_core_schema.sql" },
          { name: "0002_permanent_slug_aliases.sql" },
          { name: "0003_approved_page_publication_contracts.sql" },
        ] }]))
        .mockReturnValueOnce(JSON.stringify([{ results: [{ name: "sample" }] }]))
        .mockReturnValueOnce(JSON.stringify([{ results: [{ sample: 0 }] }]))
        .mockReturnValueOnce("")
        .mockReturnValueOnce(JSON.stringify([{ results: [{ name: "sample" }] }]))
        .mockReturnValueOnce(JSON.stringify([{ results: [{ sample: 1 }] }]));
      const result = await runD1Workflow(options({ command: "restore", file: restoreFile, remote: true }), { matrix, wrangler });
      expect(result).toContain("Data-only transport restore completed in development");
      expect(wrangler.mock.calls[0][0]).toContain("migrations");
      expect(wrangler.mock.calls[2][0].some((argument: string) => argument.includes("NOT IN ('_cf_KV', 'd1_migrations')"))).toBe(true);
      expect(wrangler.mock.calls[4][0]).toContain("--remote");
      expect(wrangler.mock.calls[4][0]).toContain("--file");
    });
  });

  it("refuses a restore artifact that includes schema DDL", async () => {
    await withArtifacts(async ({ restoreFile }) => {
      writeFileSync(restoreFile, "CREATE TABLE sample (id TEXT PRIMARY KEY);");
      const wrangler = vi.fn();
      await expect(runD1Workflow(options({ command: "restore", file: restoreFile }), { matrix, wrangler })).rejects.toThrow(/only INSERT INTO/);
      expect(wrangler).not.toHaveBeenCalled();
    });
  });

  it.each([
    "DROP TABLE sample;",
    "ALTER TABLE sample ADD COLUMN extra TEXT;",
    "CREATE VIEW sample_view AS SELECT 1;",
    "CREATE TRIGGER sample_trigger AFTER INSERT ON sample BEGIN SELECT 1; END;",
  ])("rejects non-data restore SQL before Wrangler runs: %s", async (sql) => {
    await withArtifacts(async ({ restoreFile }) => {
      writeFileSync(restoreFile, sql);
      const wrangler = vi.fn();
      await expect(runD1Workflow(options({ command: "restore", file: restoreFile }), { matrix, wrangler })).rejects.toThrow(/only INSERT INTO/);
      expect(wrangler).not.toHaveBeenCalled();
    });
  });

  it("refuses a restore target that already contains application rows", async () => {
    await withArtifacts(async ({ restoreFile }) => {
      const wrangler = vi.fn()
        .mockReturnValueOnce("")
        .mockReturnValueOnce(JSON.stringify([{ results: [
          { name: "0001_phase1_core_schema.sql" },
          { name: "0002_permanent_slug_aliases.sql" },
          { name: "0003_approved_page_publication_contracts.sql" },
        ] }]))
        .mockReturnValueOnce(JSON.stringify([{ results: [{ name: "sample" }] }]))
        .mockReturnValueOnce(JSON.stringify([{ results: [{ sample: 3 }] }]));
      await expect(runD1Workflow(options({ command: "restore", file: restoreFile }), { matrix, wrangler })).rejects.toThrow(/must contain no application rows/);
      expect(wrangler).toHaveBeenCalledTimes(4);
    });
  });

  it("does not classify Wrangler's migration ledger as application data", async () => {
    await withArtifacts(async ({ restoreFile }) => {
      const wrangler = vi.fn()
        .mockReturnValueOnce("")
        .mockReturnValueOnce(JSON.stringify([{ results: [
          { name: "0001_phase1_core_schema.sql" },
          { name: "0002_permanent_slug_aliases.sql" },
          { name: "0003_approved_page_publication_contracts.sql" },
        ] }]))
        .mockReturnValueOnce(JSON.stringify([{ results: [{ name: "sample" }] }]))
        .mockReturnValueOnce(JSON.stringify([{ results: [{ sample: 0 }] }]))
        .mockReturnValueOnce("")
        .mockReturnValueOnce(JSON.stringify([{ results: [{ name: "sample" }] }]))
        .mockReturnValueOnce(JSON.stringify([{ results: [{ sample: 1 }] }]));
      await expect(runD1Workflow(options({ command: "restore", file: restoreFile }), { matrix, wrangler })).resolves.toContain("Data-only transport restore");
    });
  });
});
