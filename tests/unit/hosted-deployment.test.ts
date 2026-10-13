import { describe, expect, it, afterEach } from "vitest";
import { assertDeployment } from "../../scripts/ci/verify-hosted-deployment.mjs";
import { GET } from "@/app/api/deployment/route";
import { vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

afterEach(() => vi.unstubAllEnvs());

const identity = {
  commit: "a".repeat(40), branch: "chore/hosted-staging-validation", deploymentId: "dpl_verified",
  deploymentUrl: "nextap-abc123-abdelrahman-867e.vercel.app", target: "preview", supabaseProject: "flkakuysakgwfoemgbwn",
};

describe("hosted acceptance deployment identity", () => {
  it("rejects an older alias and a Production target or database", () => {
    expect(() => assertDeployment(identity, identity.commit, identity.branch)).not.toThrow();
    for (const change of [{ commit: "b".repeat(40) }, { branch: "beta01" }, { target: "production" }, { supabaseProject: "jezpobjlfvihikplxrta" }, { deploymentId: undefined }, { deploymentUrl: "unrelated-tenant.vercel.app" }]) {
      expect(() => assertDeployment({ ...identity, ...change }, identity.commit, identity.branch)).toThrow();
    }
  });

  it("exposes only deployment metadata in the Staging Preview", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://staging.nextap.services");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", identity.commit);
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", identity.deploymentId);
    vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "must-never-appear");
    const response = GET();
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = await response.json();
    expect(body.commit).toBe(identity.commit);
    expect(JSON.stringify(body)).not.toContain("must-never-appear");
    expect(Object.keys(body).every(key => ["commit", "branch", "deploymentId", "deploymentUrl", "target", "supabaseProject"].includes(key))).toBe(true);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(GET().status).toBe(404);
  });

  it("cannot publish a passed summary without successful verification after the run", async () => {
    const output = await fs.mkdtemp(path.join(os.tmpdir(), "nextap-summary-"));
    try {
      const finishedAt = "2026-10-13T20:00:00.000Z";
      await fs.writeFile(path.join(output, "report.json"), JSON.stringify({ run: {
        id: "synthetic", status: "passed", exitCode: 0, finishedAt,
        vcs: { commit: identity.commit }, targets: [], summary: { discovered: 1, selected: 1, passed: 1 }, results: [],
      } }));
      await fs.writeFile(path.join(output, "fixture.json"), JSON.stringify({ slug: "preprod-media-unit" }));
      for (const [verifiedAfterRun, verifiedAt, expected] of [
        [false, "2026-10-13T20:01:00.000Z", "deployment-verification-failed"],
        [true, "2026-10-13T19:59:00.000Z", "deployment-verification-failed"],
        [true, "2026-10-13T20:01:00.000Z", "passed"],
      ]) {
        await fs.writeFile(path.join(output, "deployment.json"), JSON.stringify({ ...identity, verifiedAfterRun, verifiedAt }));
        execFileSync(process.execPath, ["scripts/ci/summarize-hosted-e2e.mjs", output]);
        const summary = JSON.parse(await fs.readFile(path.join(output, "summary.json"), "utf8"));
        expect(summary.status).toBe(expected);
      }
    } finally {
      await fs.rm(output, { recursive: true, force: true });
    }
  });
});
