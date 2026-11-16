import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createScratchName, deleteScratchDatabase, validateGeneration, validateSqlArtifact } from "../../scripts/cloudflare/phase2-recovery-restore-rehearsal.mjs";

const prefix = "scheduled/staging/2026-11-15/20261115T194450Z-fcc5661b-5f81-44cf-944a-459db25734b8";
const tables = ["businesses", "business_pages"];
const source = { name: "nextap-staging-core", id: "98f7be19-5ab8-47c3-9e36-f7df99d83089" };
const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

function fixture() {
  const sql = Buffer.from("INSERT INTO businesses (id) VALUES ('synthetic');\n");
  const manifest = {
    schemaVersion: 1,
    environment: "staging",
    source: { d1Name: source.name, d1Id: source.id, r2Name: "nextap-staging-public" },
    format: "wrangler-d1-sql-data-only",
    tables,
    migrations: [{ name: "0001_phase1_core_schema.sql", sha256: "a".repeat(64) }],
    d1: { key: `${prefix}/database/data.sql`, bytes: sql.length, sha256: sha(sql) },
    sourceMedia: [],
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const successBytes = Buffer.from(JSON.stringify({ status: "success", prefix, manifestSha256: sha(manifestBytes) }));
  return { sql, manifest, manifestBytes, successBytes };
}

describe("Phase 2 recovery rehearsal validation", () => {
  it("accepts the exact staging generation with a matching manifest marker", () => {
    const data = fixture();
    expect(validateGeneration({ prefix, successBytes: data.successBytes, manifestBytes: data.manifestBytes, expectedSource: source, expectedTables: tables })).toEqual(data.manifest);
  });

  it("rejects a generation with a mismatched source D1", () => {
    const data = fixture();
    expect(() => validateGeneration({ prefix, successBytes: data.successBytes, manifestBytes: data.manifestBytes, expectedSource: { ...source, id: "00000000-0000-4000-8000-000000000000" }, expectedTables: tables })).toThrow();
  });

  it("rejects SQL bytes that do not match the backup manifest", () => {
    const data = fixture();
    expect(() => validateSqlArtifact(data.manifest, Buffer.from("different"))).toThrow();
    expect(() => validateSqlArtifact(data.manifest, data.sql)).not.toThrow();
  });

  it("deletes only the scratch D1 created for this workflow run and attempt", () => {
    vi.stubEnv("GITHUB_RUN_ID", "43753894745");
    vi.stubEnv("GITHUB_RUN_ATTEMPT", "2");
    const execute = vi.fn().mockReturnValueOnce("").mockReturnValueOnce("[]");
    const directory = mkdtempSync(join(tmpdir(), "phase2-recovery-delete-"));
    const configPath = join(directory, "scratch.toml");
    try {
      writeFileSync(configPath, "name = 'scratch'\n");
      const name = createScratchName();
      expect(name).toBe("nextap-p2-recovery-43753894745-2");
      const id = "123e4567-e89b-42d3-a456-426614174000";
      deleteScratchDatabase(name, id, configPath, execute);
      expect(execute).toHaveBeenCalledTimes(2);
      expect(execute).toHaveBeenNthCalledWith(1, "wrangler", ["d1", "delete", name, "--config", configPath, "--skip-confirmation"]);
      expect(execute).toHaveBeenNthCalledWith(2, "wrangler", ["d1", "list", "--json", "--config", configPath]);
      expect(() => deleteScratchDatabase("nextap-p2-recovery-43753894745-1", id, configPath, execute)).toThrow();
      expect(execute).toHaveBeenCalledTimes(2);
      const retained = vi.fn().mockReturnValueOnce("").mockReturnValueOnce(JSON.stringify([{ uuid: id, name }]));
      expect(() => deleteScratchDatabase(name, id, configPath, retained)).toThrow();
      expect(retained).toHaveBeenCalledTimes(2);
    } finally {
      rmSync(directory, { recursive: true, force: true });
      vi.unstubAllEnvs();
    }
  });
});
