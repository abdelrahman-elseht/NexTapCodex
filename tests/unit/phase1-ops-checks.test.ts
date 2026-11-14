import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  PHASE1_RATE_LIMIT_POLICIES,
  rateLimitReadiness,
  runPhase1OperationalSelfTest,
  simulateSyntheticRateLimit,
  simulateSyntheticStagingRequests,
  serializeOperationalLog,
  validatePhase1DeployPreflight,
  validatePhase1RollbackPlan,
} from "../../scripts/cloudflare/phase1-ops-checks.mjs";
import { readPhase1WranglerConfig, runPhase1DeployEntry } from "../../scripts/cloudflare/phase1-deploy.mjs";

const matrix = JSON.parse(readFileSync(new URL("../../infra/cloudflare/phase1-resource-matrix.json", import.meta.url), "utf8"));
const resources = (environment: "development" | "staging") => Object.fromEntries(
  ["d1", "r2", "kv"].map((kind) => [kind, matrix.environments[environment][kind].id ?? matrix.environments[environment][kind].name]),
);
const bindings = (environment: "development" | "staging") => ({
  NEXTAP_DB: matrix.environments[environment].d1,
  NEXTAP_PUBLIC_MEDIA: matrix.environments[environment].r2,
  NEXTAP_SLUG_CACHE: matrix.environments[environment].kv,
});

describe("Phase 1 operational controls", () => {
  it("redacts synthetic secrets, contacts, and complete card tokens while retaining safe diagnostics", () => {
    const serialized = serializeOperationalLog({
      requestId: "req-safe-01",
      authorization: "Bearer synthetic-secret",
      message: "contact synthetic@example.invalid, call +1 202 555 0101, path /c/card-SYNTHETIC-123456?token=card-SYNTHETIC-123456",
    });

    expect(serialized).toContain("req-safe-01");
    expect(serialized).not.toMatch(/synthetic-secret|synthetic@example\.invalid|\+1 202 555 0101|card-SYNTHETIC-123456/);
    expect(serialized).toContain("[REDACTED_CARD_TOKEN]");
  });

  it("keeps nested error and telemetry properties sanitized", () => {
    const serialized = serializeOperationalLog({
      error: Object.assign(new Error("request from person@example.invalid failed for card token card-error-token-123456"), {
        headers: { Cookie: "session-secret" },
      }),
      metadata: [{ cardToken: "full-card-token-value", outcome: "denied" }],
    });

    expect(serialized).not.toMatch(/person@example\.invalid|session-secret|full-card-token-value|card-error-token-123456/);
    expect(serialized).toContain("denied");
  });

  it("records approved staging thresholds without claiming live enforcement", () => {
    const readiness = rateLimitReadiness();

    expect(readiness).toEqual({
      ready: true,
      approvedCount: 7,
      unresolved: [],
      liveEnforcement: false,
    });
    expect(PHASE1_RATE_LIMIT_POLICIES.every(({ status, dimension, response, ownerApprovalRequired }) => (
      status === "approved-staging-test"
      && Boolean(dimension)
      && Boolean(response)
      && !ownerApprovalRequired
    ))).toBe(true);
    expect(PHASE1_RATE_LIMIT_POLICIES.map(({ operation, counters }) => [operation, counters])).toEqual([
      ["admin-sign-in", [
        { dimension: "environment + source IP", threshold: 10, windowSeconds: 900 },
        { dimension: "environment + normalized account-key HMAC", threshold: 5, windowSeconds: 900 },
      ]],
      ["admin-recovery", [
        { dimension: "environment + source IP", threshold: 5, windowSeconds: 1800 },
        { dimension: "environment + normalized account-key HMAC", threshold: 3, windowSeconds: 1800 },
      ]],
      ["card-resolution", []],
      ["media-upload", [
        { dimension: "environment + verified staff subject + business ID", threshold: 20, windowSeconds: 3600 },
        { dimension: "same verified subject/business key", threshold: 3, windowSeconds: 60 },
      ]],
      ["publication", [
        { dimension: "environment + verified staff subject + business ID + page ID", threshold: 10, windowSeconds: 3600 },
        { dimension: "same verified subject/business/page key", threshold: 2, windowSeconds: 60 },
      ]],
      ["admin-mutation", [{ dimension: "environment + verified staff subject + business ID", threshold: 60, windowSeconds: 60 }]],
      ["export", [{ dimension: "environment + verified staff subject + business ID", threshold: 3, windowSeconds: 3600 }]],
    ]);
    expect(PHASE1_RATE_LIMIT_POLICIES.find(({ operation }) => operation === "card-resolution")).toMatchObject({
      signalOnly: true,
      threshold: null,
      dimension: expect.stringContaining("no per-token cap"),
    });
  });

  it("simulates bounded synthetic 429 and Retry-After behavior without enabling a policy", () => {
    expect(simulateSyntheticRateLimit({ limit: 2, windowMs: 1_000, timestamps: [0, 1, 500, 1_000] })).toEqual([
      { status: 200, retryAfterSeconds: null },
      { status: 200, retryAfterSeconds: null },
      { status: 429, retryAfterSeconds: 1 },
      { status: 200, retryAfterSeconds: null },
    ]);
    expect(rateLimitReadiness().liveEnforcement).toBe(false);
    expect(() => simulateSyntheticRateLimit({ limit: 0, windowMs: 1_000, timestamps: [0] })).toThrow(/positive limit\/window/);
  });

  it("allows a QR/NFC card-resolution burst above 10 per minute and keeps fingerprints signal-only", () => {
    const result = simulateSyntheticStagingRequests({
      route: "card-resolution",
      timestamps: Array.from({ length: 15 }, (_, index) => index * 4_000),
      tokenFingerprints: Array.from({ length: 15 }, (_, index) => `fingerprint-${index % 2}`),
    });

    expect(result.limiterApplied).toBe(false);
    expect(result.fingerprintAbuseSignals).toEqual(["fingerprint-0", "fingerprint-1"]);
    expect(result.responses).toHaveLength(15);
    expect(result.responses.every(({ status }) => status === 200)).toBe(true);
  });

  it("keeps direct /b/{slug} reads outside the application limiter", () => {
    const result = simulateSyntheticStagingRequests({ route: "/b/{slug}", timestamps: [0, 1, 2, 3] });

    expect(result).toMatchObject({ route: "/b/{slug}", limiterApplied: false });
    expect(result.responses.every(({ status }) => status === 200)).toBe(true);
  });

  it("allows preflight only for exact isolated bindings and a confirmed account identity", () => {
    expect(validatePhase1DeployPreflight({
      matrix,
      environment: "development",
      bindings: bindings("development"),
      expectedAccountId: "synthetic-account-id",
      authenticatedAccountId: "synthetic-account-id",
      routes: [],
      productionMutation: false,
    })).toMatchObject({ environment: "development", accountVerified: true, declaredProductionMutation: false, declaredRoutes: [] });
  });

  it("fails closed for unconfirmed accounts, mismatched bindings, routes, and production", () => {
    const input = {
      matrix,
      environment: "development",
      bindings: bindings("development"),
      expectedAccountId: "synthetic-account-id",
      authenticatedAccountId: "synthetic-account-id",
      routes: [],
      productionMutation: false,
    };

    expect(() => validatePhase1DeployPreflight({ ...input, expectedAccountId: "" })).toThrow(/explicitly confirmed expected account/);
    expect(() => validatePhase1DeployPreflight({ ...input, authenticatedAccountId: "other-account-id" })).toThrow(/does not match/);
    expect(() => validatePhase1DeployPreflight({ ...input, bindings: bindings("staging") })).toThrow(/does not match the declared development/);
    expect(() => validatePhase1DeployPreflight({ ...input, bindings: { ...input.bindings, NEXTAP_DB: { name: matrix.environments.development.d1.name } } })).toThrow(/NEXTAP_DB does not match/);
    expect(() => validatePhase1DeployPreflight({ ...input, bindings: { ...input.bindings, NEXTAP_SLUG_CACHE: { name: matrix.environments.development.kv.name } } })).toThrow(/NEXTAP_SLUG_CACHE does not match/);
    expect(() => validatePhase1DeployPreflight({ ...input, bindings: { ...input.bindings, NEXTAP_PUBLIC_MEDIA: { name: "wrong-bucket" } } })).toThrow(/NEXTAP_PUBLIC_MEDIA does not match/);
    expect(() => validatePhase1DeployPreflight({ ...input, routes: ["example.com/*"] })).toThrow(/cannot change production configuration/);
    expect(() => validatePhase1DeployPreflight({ ...input, routes: undefined as never })).toThrow(/explicit route and production-mutation declarations/);
    expect(() => validatePhase1DeployPreflight({ ...input, productionMutation: true })).toThrow(/cannot change production configuration/);
    expect(() => validatePhase1DeployPreflight({ ...input, environment: "production" })).toThrow(/limited to development or staging/);
  });

  it("derives deployment bindings from the selected Wrangler environment", () => {
    const configText = readFileSync(new URL("../../infra/cloudflare/phase1-runtime.wrangler.toml", import.meta.url), "utf8");

    expect(readPhase1WranglerConfig(configText, "development")).toMatchObject({
      environment: "development",
      workersDev: false,
      routes: [],
      bindings: {
        NEXTAP_DB: { id: matrix.environments.development.d1.id, name: matrix.environments.development.d1.name },
        NEXTAP_PUBLIC_MEDIA: { name: matrix.environments.development.r2.name },
        NEXTAP_SLUG_CACHE: { id: matrix.environments.development.kv.id },
      },
    });
  });

  it("allows workers.dev only from the staging smoke config and waits for recovery fixture references", async () => {
    const configText = readFileSync(new URL("../../infra/cloudflare/phase1-smoke.wrangler.toml", import.meta.url), "utf8");
    expect(() => readPhase1WranglerConfig(configText, "staging")).toThrow(/workers.dev/);
    expect(readPhase1WranglerConfig(configText, "staging", { allowWorkersDev: true })).toMatchObject({
      environment: "staging",
      workersDev: true,
      routes: [],
      bindings: {
        NEXTAP_DB: { id: matrix.environments.staging.d1.id, name: matrix.environments.staging.d1.name },
        NEXTAP_PUBLIC_MEDIA: { name: matrix.environments.staging.r2.name },
        SMOKE_RECOVERY_MEDIA: { name: "nextap-recovery-backup-20261114-7f3a" },
        NEXTAP_SLUG_CACHE: { id: matrix.environments.staging.kv.id },
      },
    });
    expect(() => readPhase1WranglerConfig(configText.replace(/\[\[env\.staging\.r2_buckets\]\]\nbinding = "SMOKE_RECOVERY_MEDIA"\nbucket_name = "nextap-recovery-backup-20261114-7f3a"\n?/, ""), "staging", { allowWorkersDev: true })).toThrow(/exactly one D1, R2, and KV/);
    const wrongSmokeBucket = configText.replace("nextap-recovery-backup-20261114-7f3a", "wrong-bucket");
    const wrongBucketRun = vi.fn();
    await expect(runPhase1DeployEntry({
      args: ["--environment", "staging", "--account-id", "synthetic-account-id", "--smoke-reachable"],
      root: process.cwd(),
      run: wrongBucketRun,
      inheritedEnv: { NODE_ENV: "test", CLOUDFLARE_MIGRATION_API_TOKEN: "synthetic-api-token" },
      readConfig: () => wrongSmokeBucket,
    })).rejects.toThrow(/recovery-approved D1\/R2 fixture references/);
    expect(wrongBucketRun).not.toHaveBeenCalled();
    for (const changedConfig of [
      configText.replace("recovery-20261114-7f3a-business", "another-business"),
      configText.replace("recovery-20261114-7f3a/media/synthetic.txt", "another/object.txt"),
    ]) {
      const rejectedRun = vi.fn();
      await expect(runPhase1DeployEntry({
        args: ["--environment", "staging", "--account-id", "synthetic-account-id", "--smoke-reachable"],
        root: process.cwd(),
        run: rejectedRun,
        inheritedEnv: { NODE_ENV: "test", CLOUDFLARE_MIGRATION_API_TOKEN: "synthetic-api-token" },
        readConfig: () => changedConfig,
      })).rejects.toThrow(/recovery-approved D1\/R2 fixture references/);
      expect(rejectedRun).not.toHaveBeenCalled();
    }
    const run = vi.fn();
    await expect(runPhase1DeployEntry({
      args: ["--environment", "staging", "--account-id", "synthetic-account-id", "--smoke-reachable"],
      root: process.cwd(),
      run,
      inheritedEnv: { NODE_ENV: "test" },
    })).rejects.toThrow(/CLOUDFLARE_MIGRATION_API_TOKEN/);
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects production and route options before invoking Wrangler", async () => {
    const run = vi.fn();

    await expect(runPhase1DeployEntry({ args: ["--environment", "production", "--account-id", "synthetic-account-id"], run })).rejects.toThrow(/limited to development or staging/);
    await expect(runPhase1DeployEntry({ args: ["--environment", "development", "--account-id", "synthetic-account-id", "--route", "example.com/*"], run })).rejects.toThrow(/Usage:/);
    expect(run).not.toHaveBeenCalled();
  });

  it("suppresses deployment when config IDs disagree with the resource matrix", async () => {
    const configText = readFileSync(new URL("../../infra/cloudflare/phase1-runtime.wrangler.toml", import.meta.url), "utf8");
    const changedConfig = configText.replace(matrix.environments.development.d1.id, matrix.environments.staging.d1.id);
    const run = vi.fn((_command: string, _args: string[]) => ({ status: 0, stdout: "{\"accounts\":[{\"id\":\"synthetic-account-id\"}]}", stderr: "", error: undefined }));

    await expect(runPhase1DeployEntry({
      args: ["--environment", "development", "--account-id", "synthetic-account-id", "--deploy"],
      root: process.cwd(),
      run,
      inheritedEnv: { NODE_ENV: "test" },
      readConfig: () => changedConfig,
    })).rejects.toThrow(/NEXTAP_DB does not match/);
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0]?.[1]).toContain("whoami");
  });

  it("suppresses the deploy command when Wrangler dry-run bindings disagree", async () => {
    const calls: string[][] = [];
    const run = (_command: string, args: string[]) => {
      calls.push(args);
      if (args.includes("whoami")) return { status: 0, stdout: "{\"accounts\":[{\"id\":\"synthetic-account-id\"}]}", stderr: "", error: undefined };
      return { status: 0, stdout: "env.NEXTAP_DB (wrong-database)", stderr: "", error: undefined };
    };

    await expect(runPhase1DeployEntry({
      args: ["--environment", "development", "--account-id", "synthetic-account-id", "--deploy"],
      root: process.cwd(),
      run,
      inheritedEnv: { NODE_ENV: "test" },
    })).rejects.toThrow(/dry-run resolved bindings/);
    expect(calls).toHaveLength(2);
    expect(calls.some((args) => args[0]?.endsWith("wrangler.js") && args[1] === "deploy" && !args.includes("--dry-run"))).toBe(false);
  });

  it("records deployment version and verifies remote binding metadata after deploy", async () => {
    const calls: string[][] = [];
    const run = (_command: string, args: string[]) => {
      calls.push(args);
      if (args.includes("whoami")) return { status: 0, stdout: "{\"accounts\":[{\"id\":\"synthetic-account-id\"}]}", stderr: "", error: undefined };
      if (args.includes("--dry-run")) return { status: 0, stdout: "env.NEXTAP_DB (nextap-dev-core)\nenv.NEXTAP_PUBLIC_MEDIA (nextap-dev-public)\nenv.NEXTAP_SLUG_CACHE (58df600b88a94da7806deb7ad5bc90c2)", stderr: "", error: undefined };
      if (args.includes("status")) return { status: 0, stdout: "{\"versions\":[{\"version_id\":\"synthetic-version-id\",\"percentage\":100}]}", stderr: "", error: undefined };
      if (args.includes("view")) return { status: 0, stdout: JSON.stringify({ resources: { bindings: [
        { name: "NEXTAP_DB", type: "d1", id: matrix.environments.development.d1.id },
        { name: "NEXTAP_PUBLIC_MEDIA", type: "r2_bucket", bucket_name: matrix.environments.development.r2.name },
        { name: "NEXTAP_SLUG_CACHE", type: "kv_namespace", namespace_id: matrix.environments.development.kv.id },
      ] } }), stderr: "", error: undefined };
      return { status: 0, stdout: "", stderr: "", error: undefined };
    };

    await expect(runPhase1DeployEntry({
      args: ["--environment", "development", "--account-id", "synthetic-account-id", "--deploy"],
      root: process.cwd(),
      run,
      inheritedEnv: { NODE_ENV: "test" },
    })).resolves.toMatchObject({ mode: "deployed", accountId: "synthetic-account-id", versionId: "synthetic-version-id" });
    expect(calls.some((args) => args[1] === "deploy" && !args.includes("--dry-run"))).toBe(true);
    expect(calls.some((args) => args[1] === "deployments" && args[2] === "status")).toBe(true);
    expect(calls.some((args) => args[1] === "versions" && args[2] === "view")).toBe(true);
  });

  it("fails post-deploy verification when deployed metadata points at a different binding", async () => {
    const calls: string[][] = [];
    const run = (_command: string, args: string[]) => {
      calls.push(args);
      if (args.includes("whoami")) return { status: 0, stdout: "{\"accounts\":[{\"id\":\"synthetic-account-id\"}]}", stderr: "", error: undefined };
      if (args.includes("--dry-run")) return { status: 0, stdout: "env.NEXTAP_DB (nextap-dev-core)\nenv.NEXTAP_PUBLIC_MEDIA (nextap-dev-public)\nenv.NEXTAP_SLUG_CACHE (58df600b88a94da7806deb7ad5bc90c2)", stderr: "", error: undefined };
      if (args.includes("status")) return { status: 0, stdout: "{\"versions\":[{\"version_id\":\"synthetic-version-id\",\"percentage\":100}]}", stderr: "", error: undefined };
      if (args.includes("view")) return { status: 0, stdout: JSON.stringify({ resources: { bindings: [
        { name: "NEXTAP_DB", type: "d1", id: matrix.environments.staging.d1.id },
        { name: "NEXTAP_PUBLIC_MEDIA", type: "r2_bucket", bucket_name: matrix.environments.development.r2.name },
        { name: "NEXTAP_SLUG_CACHE", type: "kv_namespace", namespace_id: matrix.environments.development.kv.id },
      ] } }), stderr: "", error: undefined };
      return { status: 0, stdout: "", stderr: "", error: undefined };
    };

    await expect(runPhase1DeployEntry({
      args: ["--environment", "development", "--account-id", "synthetic-account-id", "--deploy"],
      root: process.cwd(),
      run,
      inheritedEnv: { NODE_ENV: "test" },
    })).rejects.toThrow(/Deployed Worker metadata does not match/);
    expect(calls.filter((args) => args[1] === "deploy" && !args.includes("--dry-run"))).toHaveLength(1);
  });

  it.each(["development", "staging"] as const)("accepts a same-environment %s rollback with migration-forward handling", (environment) => {
    expect(validatePhase1RollbackPlan({
      matrix,
      environment,
      targetResources: resources(environment),
      deployment: { currentVersion: "version-current", previousVersion: "version-previous", migrationsApplied: true },
      rollback: { sameEnvironment: true, smokeChecks: true, recordEvidence: true, forwardMigrationPlan: true, previousVersionSchemaCompatible: true },
    })).toMatchObject({ environment, action: "restore-previous-worker-version", dataAction: "migration-forward-only", productionMutation: false });
  });

  it("rejects production, cross-environment resources, and unsafe rollback after schema changes", () => {
    const input = {
      matrix,
      environment: "development",
      targetResources: resources("development"),
      deployment: { currentVersion: "version-current", previousVersion: "version-previous", migrationsApplied: true },
      rollback: { sameEnvironment: true, smokeChecks: true, recordEvidence: true },
    };

    expect(() => validatePhase1RollbackPlan({ ...input, environment: "production" })).toThrow(/limited to development or staging/);
    expect(() => validatePhase1RollbackPlan({ ...input, targetResources: resources("staging") })).toThrow(/does not match/);
    expect(() => validatePhase1RollbackPlan(input)).toThrow(/migration-forward/);
  });

  it("passes synthetic checks while keeping live enforcement explicitly unverified", () => {
    expect(runPhase1OperationalSelfTest()).toMatchObject({
      redaction: "pass",
      syntheticRateLimit: "pass",
      scanBurst: "pass",
      directProfileBypass: "pass",
      rates: { ready: true, liveEnforcement: false },
    });
  });
});
