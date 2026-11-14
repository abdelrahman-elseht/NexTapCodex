import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runPhase1Mutation, validatePhase1Target } from "../../scripts/cloudflare/phase1-target-check.mjs";

const readyMatrix = () => ({
  environments: {
    development: { status: "ready", d1: { name: "dev-db", id: "dev-db-id" }, r2: { name: "dev-bucket" }, kv: { name: "dev-kv", id: "dev-kv-id" } },
    staging: { status: "ready", d1: { name: "stage-db", id: "stage-db-id" }, r2: { name: "stage-bucket" }, kv: { name: "stage-kv", id: "stage-kv-id" } },
    production: { status: "not-authorized" },
  },
});

describe("Phase 1 environment target check", () => {
  it("validates the checked-in resource matrix without sharing target identities", () => {
    const matrix = JSON.parse(readFileSync(new URL("../../infra/cloudflare/phase1-resource-matrix.json", import.meta.url), "utf8"));
    expect(validatePhase1Target(matrix, "development").resources.d1.id).toBe("a64cabf6-b8f4-41aa-84fc-b7fed5d2dde7");
    expect(validatePhase1Target(matrix, "staging").resources.d1.id).toBe("98f7be19-5ab8-47c3-9e36-f7df99d83089");
    expect(() => validatePhase1Target(matrix, "production")).toThrow(/limited to development or staging/);
  });

  it.each([undefined, "", "production", "preview", "test"])("rejects missing or unsupported environment %s", (environment) => {
    expect(() => validatePhase1Target(readyMatrix(), environment)).toThrow(/limited to development or staging/);
  });

  it("fails closed when resources are not verified", () => {
    const matrix = readyMatrix();
    matrix.environments.development.status = "not-provisioned";
    expect(() => validatePhase1Target(matrix, "development")).toThrow(/not verified and ready/);
  });

  it("rejects incomplete or shared environment resources", () => {
    const matrix = readyMatrix();
    Reflect.deleteProperty(matrix.environments.development, "kv");
    expect(() => validatePhase1Target(matrix, "development")).toThrow(/identify D1, R2, and KV/);
    matrix.environments.development.kv = { ...matrix.environments.staging.kv };
    expect(() => validatePhase1Target(matrix, "development")).toThrow(/shared by development and staging/);
  });

  it.each(["development", "staging"])("accepts a complete isolated %s matrix entry", (environment) => {
    expect(validatePhase1Target(readyMatrix(), environment)).toMatchObject({ environment });
  });

  it("checks exact identities before executing a mutation callback", async () => {
    const execute = vi.fn(async () => "executed");
    const matrix = readyMatrix();
    const targetResources = { d1: "dev-db", r2: "dev-bucket", kv: "dev-kv-id" };
    await expect(runPhase1Mutation({ matrix, environment: "development", targetResources, execute })).resolves.toBe("executed");
    expect(execute).toHaveBeenCalledOnce();
    await expect(runPhase1Mutation({ matrix, environment: "production", targetResources, execute })).rejects.toThrow(/limited to development or staging/);
    await expect(runPhase1Mutation({ matrix, environment: "development", targetResources: { ...targetResources, d1: "prod-db" }, execute })).rejects.toThrow(/does not match/);
    expect(execute).toHaveBeenCalledOnce();
  });
});
