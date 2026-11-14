#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dependencySections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
const lifecycleScripts = ["preinstall", "install", "postinstall", "prepare", "prepublish", "prepublishOnly"];

function sameJson(left, right) {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
}

export function compareDependencyState(manifest, lockfile, previousManifest) {
  const problems = [];
  const changes = [];
  const lifecycleChanges = [];
  const lockedRoot = lockfile?.packages?.[""];

  if (!lockedRoot) {
    problems.push("package-lock.json is missing packages[''] root metadata");
  } else {
    for (const field of ["name", "version", "engines"]) {
      if (!sameJson(manifest[field], lockedRoot[field])) {
        problems.push(`package.json and package-lock.json root ${field} differ`);
      }
    }
    for (const section of dependencySections) {
      if (!sameJson(manifest[section], lockedRoot[section])) {
        problems.push(`package.json and package-lock.json root ${section} differ`);
      }
    }
  }

  if (previousManifest) {
    for (const section of dependencySections) {
      const before = previousManifest[section] ?? {};
      const after = manifest[section] ?? {};
      const names = new Set([...Object.keys(before), ...Object.keys(after)]);
      for (const name of [...names].sort()) {
        if (before[name] === after[name]) continue;
        changes.push({ section, name, before: before[name] ?? null, after: after[name] ?? null });
      }
    }

    const beforeScripts = previousManifest.scripts ?? {};
    const afterScripts = manifest.scripts ?? {};
    for (const name of lifecycleScripts) {
      if (beforeScripts[name] === afterScripts[name]) continue;
      lifecycleChanges.push({
        name,
        before: beforeScripts[name] ?? null,
        after: afterScripts[name] ?? null,
        introduced: beforeScripts[name] == null && afterScripts[name] != null,
      });
    }
  }

  return {
    status: problems.length ? "fail" : "pass",
    problems,
    dependencyChanges: changes,
    lifecycleChanges,
    comparison: previousManifest ? "available" : "unverified",
  };
}

/** @typedef {{ status: number | null, stdout?: string, stderr?: string, output?: Array<string | null>, error?: Error & { code?: string } }} AuditSpawnResult */
/** @typedef {(command: string, args: string[], options: { cwd: string, encoding: "utf8", timeout: number, maxBuffer: number, windowsHide: boolean }) => AuditSpawnResult} AuditSpawn */

/** @param {{ cwd: string, timeoutMs?: number, spawn?: AuditSpawn }} options */
export function runDependencyAudit({ cwd, timeoutMs = 30_000, spawn = spawnSync }) {
  const result = spawn("npm", ["audit", "--audit-level=high", "--json"], {
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
  });

  let report;
  try {
    report = JSON.parse(result.stdout || result.output?.[1] || "");
  } catch {
    report = null;
  }

  if (report?.metadata?.vulnerabilities) {
    const counts = report.metadata.vulnerabilities;
    const failingCount = (counts.high ?? 0) + (counts.critical ?? 0);
    return {
      status: failingCount ? "fail" : "pass",
      counts,
      detail: failingCount ? `${failingCount} high/critical vulnerability finding(s)` : null,
    };
  }

  const detail = result.error?.code === "ETIMEDOUT"
    ? `npm audit exceeded ${timeoutMs} ms`
    : result.error?.message || result.stderr?.trim() || `npm audit exited ${result.status ?? "without a status"}`;
  return { status: "unverified", counts: null, detail };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readGitJson(root, ref, file) {
  const result = spawnSync("git", ["show", `${ref}:${file}`], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function parseArgs(args) {
  const options = { audit: false, requireAudit: false, json: false, base: "HEAD", timeoutMs: 30_000 };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--audit") options.audit = true;
    else if (arg === "--require-audit") { options.audit = true; options.requireAudit = true; }
    else if (arg === "--json") options.json = true;
    else if (arg === "--base" && args[index + 1]) options.base = args[++index];
    else if (arg === "--timeout-ms" && args[index + 1]) options.timeoutMs = Number(args[++index]);
    else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1_000 || options.timeoutMs > 120_000) {
    throw new Error("--timeout-ms must be an integer between 1000 and 120000");
  }
  return options;
}

function main() {
  const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const options = parseArgs(process.argv.slice(2));
  const manifest = readJson(resolve(root, "package.json"));
  const lockfile = readJson(resolve(root, "package-lock.json"));
  const previousManifest = options.base ? readGitJson(root, options.base, "package.json") : null;
  const report = compareDependencyState(manifest, lockfile, previousManifest);

  if (options.audit) {
    report.audit = runDependencyAudit({ cwd: root, timeoutMs: options.timeoutMs });
    if (report.audit.status === "fail") report.status = "fail";
    else if (report.audit.status === "unverified" && report.status === "pass") report.status = "unverified";
    if (options.requireAudit && report.audit.status !== "pass") report.status = "fail";
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`Dependency check: ${report.status}\n`);
    for (const problem of report.problems) process.stdout.write(`ERROR ${problem}\n`);
    if (report.comparison === "unverified") process.stdout.write("INFO dependency change baseline unavailable; package changes were not compared\n");
    for (const change of report.dependencyChanges) {
      process.stdout.write(`CHANGE ${change.section} ${change.name}: ${change.before ?? "(absent)"} -> ${change.after ?? "(absent)"}\n`);
    }
    for (const script of report.lifecycleChanges) {
      process.stdout.write(`LIFECYCLE ${script.name}${script.introduced ? " (new)" : " (changed)"}\n`);
    }
    if (report.audit) process.stdout.write(`AUDIT ${report.audit.status}${report.audit.detail ? `: ${report.audit.detail}` : ""}\n`);
  }

  if (report.status === "fail") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Dependency check could not run: ${error.message}\n`);
    process.exitCode = 2;
  }
}
