import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";

export function assertDeployment(identity, commit, branch) {
  if (identity.commit !== commit || identity.branch !== branch || identity.target !== "preview" ||
      identity.supabaseProject !== "flkakuysakgwfoemgbwn" ||
      !/^dpl_[a-zA-Z0-9]+$/.test(identity.deploymentId) ||
      !/^nextap-[a-z0-9]+-abdelrahman-867e\.vercel\.app$/.test(identity.deploymentUrl)) {
    throw new Error("Staging deployment identity does not match the checked-out commit and isolated Preview target.");
  }
}

export async function verifyDeployment({ wait = false } = {}) {
  const origin = process.env.E2E_BASE_URL;
  if (origin !== "https://staging.nextap.services") throw new Error("Deployment verification requires the stable Staging origin.");
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const branch = process.env.GITHUB_REF_NAME || execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
  const deadline = Date.now() + (wait ? 300_000 : 0);
  let identity;
  do {
    const response = await fetch(`${origin}/api/deployment`, {
      headers: { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET },
      redirect: "manual", signal: AbortSignal.timeout(15_000),
    });
    if (response.ok && response.headers.get("content-type")?.includes("application/json")) {
      identity = await response.json();
      try { assertDeployment(identity, commit, branch); break; } catch { /* A new deployment may still be building. */ }
    }
    if (Date.now() >= deadline) throw new Error("The stable Staging alias is not serving the expected deployment; inspect Vercel readiness and branch binding.");
    await setTimeout(5_000);
  } while (true);
  const output = "artifacts/hosted-staging/deployment.json";
  const evidence = { commit, branch, deploymentId: identity.deploymentId, deploymentUrl: identity.deploymentUrl, target: identity.target, supabaseProject: identity.supabaseProject, origin, mutationMode: process.env.E2E_ALLOW_MUTATIONS === "true", verifiedAfterRun: !wait, verifiedAt: new Date().toISOString() };
  if (!wait) {
    const initial = JSON.parse(await fs.readFile(output, "utf8"));
    if (initial.deploymentId !== evidence.deploymentId) throw new Error("Staging alias changed deployment during the test run; rerun acceptance.");
  }
  await fs.mkdir("artifacts/hosted-staging", { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Verified Staging deployment ${evidence.deploymentId} at commit ${commit}.`);
  return evidence;
}
