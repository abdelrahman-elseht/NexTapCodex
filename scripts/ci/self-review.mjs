import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CHECKLIST = [
  ["SR-1", "I inspected the complete diff and traced changed behavior to its callers"],
  ["SR-2", "The required quality checks are green for this exact head SHA"],
  ["SR-3", "Changed behavior has focused tests, including failure and recovery paths"],
  ["SR-4", "Secrets, authorization, data boundaries, and external side effects are checked"],
  ["SR-5", "Documentation, rollback, and the merge/release danger are recorded"],
];

const HIGH_RISK_CHECKLIST = [
  ["SR-H1", "I reviewed security and data impact for every high-risk changed file"],
  ["SR-H2", "The migration, deployment, or destructive-operation rollback path is explicit"],
  ["SR-H3", "The acceptance evidence covers the changed production boundary"],
];

const RELEASE_CHECKLIST = [
  ["SR-R1", "The release source and accepted Staging SHA are identified exactly"],
  ["SR-R2", "Hosted Staging acceptance is complete and its sanitized evidence is linked"],
  ["SR-R3", "Migration history, checksums, and environment separation are verified"],
  ["SR-R4", "Production recovery, last-known-good deployment, and smoke checks are recorded"],
  ["SR-R5", "The promoted tree was compared with the accepted source after merge strategy"],
];

const HIGH_RISK_PATHS = [
  /^\.github\/workflows\//i,
  /^supabase\/migrations\//i,
  /^supabase\/tests\//i,
  /(^|\/)middleware\.(m|c)?tsx?$/i,
  /(^|\/)instrumentation\.(m|c)?tsx?$/i,
  /(^|\/)(auth|session|rls|security|permissions?)(\/|\.|$)/i,
  /(^|\/)(deployment|release|production|staging|environment|config)(\/|\.|$)/i,
  /(^|\/)(deletion|delete|assignment|inventory|billing|payment)(\/|\.|$)/i,
  /package(-lock)?\.json$/i,
];

const DESTRUCTIVE_SQL = /\b(drop|truncate|delete\s+from|alter\s+table|revoke|grant)\b/i;
const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----/i;
const SECRET_ASSIGNMENT =
  /\b(?:service[_-]?role|private[_-]?key|api[_-]?key|access[_-]?token|auth[_-]?token|password|secret)\b\s*[:=]\s*["'`](?!\s*(?:\$\{\{|placeholder|example|test|changeme|your[_ -]?value|x{3,})\b)[^"'`\r\n]{12,}["'`]/i;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function checked(body, id) {
  return new RegExp(`(?:^|\\n)\\s*[-*]\\s*\\[[xX]\\]\\s*${escapeRegExp(id)}(?:\\s|[-:]|$)`).test(body);
}

function section(body, title) {
  const heading = new RegExp(`^##\\s+${escapeRegExp(title)}\\s*$`, "im").exec(body);
  if (!heading) return "";
  const start = heading.index + heading[0].length;
  const remainder = body.slice(start);
  const nextHeading = remainder.search(/^##\\s+/im);
  return remainder.slice(0, nextHeading < 0 ? remainder.length : nextHeading);
}

function field(body, label) {
  const match = body.match(new RegExp(`^\\s*(?:[-*]\\s*)?${escapeRegExp(label)}\\s*:\\s*(.+?)\\s*$`, "im"));
  return match?.[1]?.trim() ?? "";
}

function hasUsefulValue(value) {
  return Boolean(value) && !/^<(?:sha|link|run|owner|value)>$/i.test(value) && !/\b(?:todo|tbd|fill[ -]?in|pending)\b/i.test(value);
}

function addedLines(files) {
  return files.flatMap((file) =>
    String(file.patch ?? "")
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      .map((line) => ({ filename: file.filename, line: line.slice(1) })),
  );
}

function isSecretFile(filename) {
  return /(^|\/)(?:\.env(?:\.[^/]+)?|[^/]+\.(?:pem|key|p12|pfx))$/i.test(filename) &&
    !/(?:\.example|\.sample|\.template|\.test)$/i.test(filename);
}

export function classifyFiles(files) {
  const names = files.map((file) => file.filename);
  const lines = addedLines(files);
  const destructive = lines.some(({ filename, line }) => /\.sql$/i.test(filename) && DESTRUCTIVE_SQL.test(line));
  const highRisk = names.some((name) => HIGH_RISK_PATHS.some((pattern) => pattern.test(name))) || destructive;
  const secretFiles = names.filter(isSecretFile);
  const secretLines = lines.filter(({ line }) => PRIVATE_KEY.test(line) || SECRET_ASSIGNMENT.test(line));
  return {
    level: highRisk ? "high" : names.length > 0 ? "medium" : "low",
    highRisk,
    destructive,
    secretFiles,
    secretLines,
    names,
  };
}

function requiredItems({ baseRef, risk }) {
  const items = [...CHECKLIST];
  if (risk.highRisk) items.push(...HIGH_RISK_CHECKLIST);
  if (baseRef === "main") items.push(...RELEASE_CHECKLIST);
  return items;
}

/**
 * @param {{ pr: any, files: any[], hostedAcceptanceRuns?: Array<{event?: string, conclusion?: string, head_sha?: string}> }} input
 */
export function evaluateReview({ pr, files, hostedAcceptanceRuns = [] }) {
  const body = String(pr.body ?? "");
  const risk = classifyFiles(files);
  const errors = [];
  const warnings = [];
  const selfReview = section(body, "Self-review");
  const items = requiredItems({ baseRef: pr.base.ref, risk });

  if (pr.draft) errors.push("The pull request is still a draft.");
  if (pr.state !== "open") errors.push(`The pull request is ${pr.state}; only open PRs can pass self-review.`);
  if (!selfReview) errors.push("The PR body must contain a `## Self-review` section.");

  const owner = field(selfReview, "Self-review owner").replace(/^@/, "");
  if (!owner) errors.push("Self-review owner is missing.");
  else if (owner.toLowerCase() !== String(pr.user.login).toLowerCase()) {
    errors.push(`Self-review owner @${owner} must match PR author @${pr.user.login}.`);
  }

  const riskLevel = field(selfReview, "Risk level").toLowerCase();
  if (!/^(low|medium|high)$/.test(riskLevel)) errors.push("Risk level must be low, medium, or high.");
  else if (risk.highRisk && riskLevel !== "high") errors.push("High-risk changes must be marked `Risk level: high`.");
  if (!hasUsefulValue(field(selfReview, "Blast radius"))) errors.push("Blast radius must be stated in the self-review.");
  if (!hasUsefulValue(field(selfReview, "Merge danger"))) errors.push("Merge danger must be stated in the self-review.");
  if (!/\bEvidence\s*:/i.test(selfReview)) errors.push("The self-review must include an Evidence field.");
  if (/\b(?:todo|tbd|fill[ -]?in|pending)\b|<(?:sha|link|run|owner|value)>/i.test(selfReview)) {
    errors.push("The self-review still contains a placeholder or pending item.");
  }

  for (const [id] of items) {
    if (!checked(selfReview, id)) errors.push(`Required self-review item ${id} is not checked.`);
  }

  if (risk.secretFiles.length > 0) errors.push(`Secret-like files are changed: ${risk.secretFiles.join(", ")}.`);
  if (risk.secretLines.length > 0) {
    errors.push(`A likely secret was found in added lines: ${risk.secretLines.map(({ filename }) => filename).join(", ")}.`);
  }

  const sourceSha = field(selfReview, "Release source SHA");
  if (pr.base.ref === "main") {
    if (!/^[0-9a-f]{40}$/i.test(sourceSha) || sourceSha.toLowerCase() !== String(pr.head.sha).toLowerCase()) {
      errors.push("Release source SHA must exactly match the PR head SHA.");
    }
    const acceptedSha = field(selfReview, "Accepted Staging SHA");
    if (pr.head.ref === "staging") {
      if (!/^[0-9a-f]{40}$/i.test(acceptedSha) || acceptedSha.toLowerCase() !== String(pr.head.sha).toLowerCase()) {
        errors.push("Accepted Staging SHA must exactly match the staging PR head SHA.");
      }
      if (!hasUsefulValue(field(selfReview, "Hosted Staging acceptance artifact"))) {
        errors.push("Hosted Staging acceptance artifact must be linked for a staging release.");
      }
      const hasDispatchAcceptance = hostedAcceptanceRuns.some(
        (run) => run.event === "workflow_dispatch" && run.conclusion === "success" && run.head_sha === pr.head.sha,
      );
      if (!hasDispatchAcceptance) {
        errors.push("A successful manual Hosted Staging acceptance run for the exact release SHA was not found.");
      }
    } else if (!hasUsefulValue(field(selfReview, "Hotfix base SHA"))) {
      errors.push("A non-staging main PR must identify its Hotfix base SHA.");
    }
    for (const label of ["Migration history/checksums", "Production recovery target", "Production smoke evidence"]) {
      if (!hasUsefulValue(field(selfReview, label))) errors.push(`${label} must be recorded for a main release.`);
    }
  }

  if (risk.level === "medium" && !risk.highRisk) warnings.push("Medium-risk changes: keep the evidence links specific to the changed files.");
  if (files.length > 100) warnings.push(`Large diff: ${files.length} changed files require an explicit file-by-file review.`);
  return { ok: errors.length === 0, errors, warnings, risk, required: items.map(([id, text]) => ({ id, text })) };
}

export function buildManifest({ repo, pr, files, result, generatedAt = new Date().toISOString() }) {
  const fileSummary = files.map(({ filename, status, additions, deletions, changes, patch }) => ({
    filename, status, additions, deletions, changes, patch: patch ?? null,
  }));
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify(fileSummary)).digest("hex");
  return {
    schema: 1,
    generatedAt,
    repository: repo,
    pullRequest: pr.number,
    base: { ref: pr.base.ref, sha: pr.base.sha },
    head: { ref: pr.head.ref, sha: pr.head.sha },
    author: pr.user.login,
    // Never write added-line contents to the artifact: the scanner may have
    // found a credential, and the artifact is retained outside the PR.
    risk: {
      level: result.risk.level,
      highRisk: result.risk.highRisk,
      destructive: result.risk.destructive,
      secretFiles: result.risk.secretFiles,
      secretLineFiles: [...new Set(result.risk.secretLines.map(({ filename }) => filename))],
    },
    changedFileCount: files.length,
    changedFilesFingerprint: fingerprint,
    changedFiles: files.map(({ filename, status, additions, deletions, changes }) => ({ filename, status, additions, deletions, changes })),
    requiredChecklist: result.required,
    warnings: result.warnings,
    passed: result.ok,
    errors: result.errors,
  };
}

async function githubRequest(pathname, token) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "nextap-self-review",
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status} for ${pathname}: ${await response.text()}`);
  return response.json();
}

async function listFiles(repo, number, token) {
  const files = [];
  for (let page = 1; page <= 20; page += 1) {
    const rows = await githubRequest(`/repos/${repo}/pulls/${number}/files?per_page=100&page=${page}`, token);
    files.push(...rows);
    if (rows.length < 100) return files;
  }
  throw new Error("The pull request changes exceed the self-review file limit of 2,000 files.");
}

async function listHostedAcceptanceRuns(repo, sha, token) {
  const query = new URLSearchParams({ branch: "staging", head_sha: sha, per_page: "100" });
  const data = await githubRequest(`/repos/${repo}/actions/workflows/hosted-e2e.yml/runs?${query}`, token);
  return data.workflow_runs ?? [];
}

function renderSummary({ pr, result, manifest }) {
  const lines = [
    `### Self-review ${result.ok ? "passed" : "failed"}`,
    `- PR: #${pr.number} (${pr.base.ref} ← ${pr.head.ref})`,
    `- Head SHA: \`${pr.head.sha}\``,
    `- Risk: **${result.risk.level}**; changed files: ${manifest.changedFileCount}`,
    `- Diff fingerprint: \`${manifest.changedFilesFingerprint}\``,
  ];
  if (result.errors.length) lines.push("", "**Required fixes:**", ...result.errors.map((error) => `- ${error}`));
  if (result.warnings.length) lines.push("", "**Warnings:**", ...result.warnings.map((warning) => `- ${warning}`));
  return `${lines.join("\n")}\n`;
}

export async function runSelfReview({ eventPath = process.env.GITHUB_EVENT_PATH, token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPOSITORY, outputDir = process.env.SELF_REVIEW_OUTPUT ?? "self-review" } = {}) {
  if (!eventPath || !token || !repo) throw new Error("GITHUB_EVENT_PATH, GITHUB_TOKEN, and GITHUB_REPOSITORY are required.");
  const event = JSON.parse(await fs.readFile(eventPath, "utf8"));
  const number = event.pull_request?.number;
  if (!number) throw new Error("This workflow must run for a pull_request_target event.");

  const pr = await githubRequest(`/repos/${repo}/pulls/${number}`, token);
  const files = await listFiles(repo, number, token);
  const hostedAcceptanceRuns = pr.base.ref === "main" && pr.head.ref === "staging"
    ? await listHostedAcceptanceRuns(repo, pr.head.sha, token)
    : [];
  const result = evaluateReview({ pr, files, hostedAcceptanceRuns });
  const manifest = buildManifest({ repo, pr, files, result });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const summary = renderSummary({ pr, result, manifest });
  await fs.writeFile(path.join(outputDir, "summary.md"), summary, "utf8");
  if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
  if (!result.ok) {
    const error = new Error(`Self-review failed with ${result.errors.length} required fix(es).`);
    error.result = result;
    throw error;
  }
  return { pr, files, result, manifest };
}

const invoked = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invoked) {
  runSelfReview().catch((error) => {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  });
}
