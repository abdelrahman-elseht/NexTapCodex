import { describe, expect, it, vi } from "vitest";
import { runPhase1Mutation, validatePhase1Target } from "../../scripts/cloudflare/phase1-target-check.mjs";

const isolatedMatrix = () => ({
  environments: {
    development: {
      status: "ready",
      d1: { id: "dev-db-id", name: "dev-db" },
      r2: { name: "dev-media" },
      kv: { id: "dev-kv-id", name: "dev-kv" },
    },
    staging: {
      status: "ready",
      d1: { id: "stage-db-id", name: "stage-db" },
      r2: { name: "stage-media" },
      kv: { id: "stage-kv-id", name: "stage-kv" },
    },
    production: { status: "not-authorized" },
  },
});

describe("Phase 1 owner controls", () => {
  it.each([
    ["missing peer environment", (matrix: ReturnType<typeof isolatedMatrix>) => { Reflect.deleteProperty(matrix.environments, "staging"); }],
    ["peer without all resource identities", (matrix: ReturnType<typeof isolatedMatrix>) => { Reflect.deleteProperty(matrix.environments.staging, "r2"); }],
    ["unverified peer environment", (matrix: ReturnType<typeof isolatedMatrix>) => { matrix.environments.staging.status = "not-provisioned"; }],
  ])("rejects a target when the %s", (_scenario, configure) => {
    const matrix = isolatedMatrix();
    configure(matrix);

    expect(() => validatePhase1Target(matrix, "development")).toThrow(/Phase 1 staging/);
  });

  it.each([
    ["id", { id: "dev-db-id", name: "stage-db" }],
    ["name", { id: "stage-db-id", name: "dev-db" }],
  ])("rejects a D1 identity shared through its %s even when the other field differs", (_field, shared) => {
    const matrix = isolatedMatrix();
    matrix.environments.staging.d1 = shared;

    expect(() => validatePhase1Target(matrix, "development")).toThrow(/D1 resource is shared/);
  });

  it("rejects a deployment mutation before execution when a binding points at staging", async () => {
    const execute = vi.fn(async () => "deployed");
    const matrix = isolatedMatrix();

    await expect(runPhase1Mutation({
      matrix,
      environment: "development",
      targetResources: { d1: "stage-db-id", r2: "dev-media", kv: "dev-kv-id" },
      execute,
    })).rejects.toThrow(/D1 target does not match/);
    expect(execute).not.toHaveBeenCalled();
  });

  it("does not echo a credential-like value when it is supplied as an invalid target", async () => {
    const secretLike = "cf-secret-value-must-not-appear";
    const execute = vi.fn();

    let message = "";
    try {
      await runPhase1Mutation({
        matrix: isolatedMatrix(),
        environment: "development",
        targetResources: { d1: secretLike, r2: "dev-media", kv: "dev-kv-id" },
        execute,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toMatch(/D1 target does not match/);
    expect(message).not.toContain(secretLike);
    expect(execute).not.toHaveBeenCalled();
  });
});
