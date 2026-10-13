import fs from "node:fs/promises";

const output = process.argv[2] || "artifacts/hosted-staging";
let report;
try {
  report = JSON.parse(await fs.readFile(`${output}/report.json`, "utf8"));
} catch (error) {
  if (error.code === "ENOENT") {
    console.log("Hosted E2E did not produce a report; preflight or setup did not complete.");
    process.exit(0);
  }
  throw error;
}
// Allowlist fields. Raw steps, errors, browser traces, cookies and request headers
// can contain credentials or card tokens and must never become CI artifacts.
const { run } = report;
const deployment = JSON.parse(await fs.readFile(`${output}/deployment.json`, "utf8"));
if (deployment.commit !== run.vcs?.commit) throw new Error("Test checkout and deployed commit differ.");
const fixture = JSON.parse(await fs.readFile(`${output}/fixture.json`, "utf8"));
const verifiedAfterRun = deployment.verifiedAfterRun === true && Date.parse(deployment.verifiedAt) >= Date.parse(run.finishedAt);
const summary = {
  runId: run.id,
  status: verifiedAfterRun ? run.status : "deployment-verification-failed",
  exitCode: verifiedAfterRun ? run.exitCode : 1,
  verifiedAfterRun,
  startedAt: run.startedAt,
  finishedAt: run.finishedAt,
  sourceCommit: deployment.commit,
  sourceBranch: deployment.branch,
  deployment,
  fixtureNamespace: fixture.slug,
  targets: run.targets.map(target => ({ name: target.id, origin: new URL(target.baseOrigin).origin })),
  counts: run.summary,
  unselected: run.summary.discovered - run.summary.selected,
  results: run.results.map(result => ({ file: result.file, target: result.targetId, status: result.status })),
};
await fs.writeFile(`${output}/summary.json`, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ status: summary.status, counts: summary.counts, unselected: summary.unselected }));
