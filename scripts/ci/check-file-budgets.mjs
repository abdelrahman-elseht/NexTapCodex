import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const limits = { route: 250, component: 250, domain: 300, test: 500 };
const excludedNames = /(^|\/)(?:index\.d\.ts|next-env\.d\.ts)$/i;

export function fileKind(filename) {
  const file = filename.replaceAll("\\", "/");
  if (excludedNames.test(file) || /(^|\/)(?:\.next|node_modules|artifacts)\//.test(file)) return null;
  if (/^src\/app\/.*\/(?:page|layout|route|loading|error|not-found|global-error|default|template|actions|.*-actions)\.[cm]?[jt]sx?$/.test(file) || /^src\/app\/[^/]+\.[cm]?[jt]sx?$/.test(file)) return "route";
  if (/^src\/components\/.*\.[cm]?[jt]sx?$/.test(file) || /^src\/app\/.*\/_components\/.*\.[cm]?[jt]sx?$/.test(file)) return "component";
  if (/^tests\/.*\.(?:test|spec|e2e)\.[cm]?[jt]sx?$/.test(file)) return "test";
  if (/^src\/lib\/.*\.[cm]?[jt]sx?$/.test(file)) return "domain";
  return null;
}

function physicalLines(source) {
  if (source.length === 0) return 0;
  const lines = source.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines.length;
}

export function evaluateFileBudgets({ files, baselineCounts, exceptions, today = new Date().toISOString().slice(0, 10) }) {
  const errors = [];
  const warnings = [];
  const activeExceptions = new Set();
  for (const file of files) {
    const kind = fileKind(file.path);
    if (!kind) continue;
    const limit = limits[kind];
    if (file.lines <= limit) continue;
    const exception = exceptions.find((item) => item.file === file.path && item.expiresOn >= today && item.owner && item.reason);
    if (exception) {
      activeExceptions.add(exception.file);
      warnings.push(`${file.path}: ${file.lines}/${limit} lines; exception owner=${exception.owner}, expires=${exception.expiresOn}`);
      continue;
    }
    const baseline = baselineCounts.get(file.path);
    const message = `${file.path}: ${file.lines}/${limit} lines${baseline === undefined ? " (new file)" : ` (base ${baseline})`}`;
    errors.push(message);
  }
  for (const exception of exceptions) {
    if (exception.expiresOn < today) warnings.push(`STALE_EXCEPTION ${exception.file}: expired ${exception.expiresOn}`);
    else if (!activeExceptions.has(exception.file)) warnings.push(`UNUSED_EXCEPTION ${exception.file}: no changed over-budget file uses it`);
  }
  return { errors, warnings };
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function gitPaths(args) {
  const output = execFileSync("git", args, { cwd: root, encoding: "utf8" });
  return output.split("\0").filter(Boolean).map((file) => file.replaceAll("\\", "/"));
}

function countSource(revision, filename) {
  try {
    return physicalLines(execFileSync("git", ["show", `${revision}:${filename}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }));
  } catch {
    return undefined;
  }
}

function main() {
  const argIndex = process.argv.indexOf("--base");
  const base = argIndex >= 0 ? process.argv[argIndex + 1] : process.env.BASE_SHA || git(["merge-base", "HEAD", "main"]);
  if (!base) throw new Error("Provide --base <sha> or BASE_SHA.");
  const changed = new Set([
    ...gitPaths(["diff", "--name-only", "--diff-filter=ACMR", "-z", base, "--"]),
    ...gitPaths(["ls-files", "--others", "--exclude-standard", "-z"]),
  ]);
  const tracked = gitPaths(["ls-files", "-z"]);
  const baselineCounts = new Map();
  for (const file of changed) {
    const kind = fileKind(file);
    if (!kind) continue;
    const count = countSource(base, file);
    if (count !== undefined) baselineCounts.set(file, count);
  }

  const currentChanged = [...changed].flatMap((file) => {
    const kind = fileKind(file);
    if (!kind || !fs.existsSync(path.join(root, file))) return [];
    return [{ path: file, lines: physicalLines(fs.readFileSync(path.join(root, file), "utf8")) }];
  });
  const legacy = tracked.filter((file) => !changed.has(file)).flatMap((file) => {
    const kind = fileKind(file);
    if (!kind || !fs.existsSync(path.join(root, file))) return [];
    const count = physicalLines(fs.readFileSync(path.join(root, file), "utf8"));
    if (count <= limits[kind]) return [];
    return [`${file}: ${count}/${limits[kind]} lines (unchanged legacy)`];
  });
  const exceptionPath = path.join(root, ".file-budget-exceptions.json");
  const exceptions = fs.existsSync(exceptionPath) ? JSON.parse(fs.readFileSync(exceptionPath, "utf8")) : [];
  if (!Array.isArray(exceptions)) throw new Error(".file-budget-exceptions.json must contain a JSON array.");
  const result = evaluateFileBudgets({ files: currentChanged, baselineCounts, exceptions });
  for (const warning of legacy) console.warn(`WARN ${warning}`);
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  for (const error of result.errors) console.error(`ERROR ${error}`);
  if (result.errors.length) {
    console.error(`FILE_BUDGETS_FAILED: ${result.errors.length} changed overage(s); add a scoped, current exception or refactor by responsibility.`);
    process.exitCode = 1;
  } else {
    console.log(`FILE_BUDGETS_OK: ${currentChanged.length} changed source file(s), ${legacy.length} unchanged legacy overage(s).`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
