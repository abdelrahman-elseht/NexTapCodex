import { execFileSync } from "node:child_process";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function runNpm(args, options = {}) {
  if (process.env.npm_execpath) {
    return execFileAsync(process.execPath, [process.env.npm_execpath, ...args], { cwd: root, windowsHide: true, ...options });
  }
  return execFileAsync(npm, args, { cwd: root, windowsHide: true, shell: process.platform === "win32", ...options });
}

function readJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(root, filename), "utf8"));
}

function gitShow(revision, filename) {
  return execFileSync("git", ["show", `${revision}:${filename}`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

function lockedVersion(lock, name) {
  return lock.packages[`node_modules/${name}`]?.version;
}

export function changedDirectDependencies(baseManifest, currentManifest, baseLock, currentLock) {
  const groups = ["dependencies", "devDependencies", "optionalDependencies"];
  const names = new Set(groups.flatMap((group) => [
    ...Object.keys(baseManifest[group] ?? {}),
    ...Object.keys(currentManifest[group] ?? {}),
  ]));
  return [...names].filter((name) =>
    groups.some((group) => baseManifest[group]?.[name] !== currentManifest[group]?.[name]) ||
    lockedVersion(baseLock, name) !== lockedVersion(currentLock, name),
  );
}

async function registryMetadata(name, version) {
  try {
    if (!/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(name) || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(version)) {
      return { name, version, unverified: "package identity is not a plain registry name and version" };
    }
    const { stdout } = await runNpm(["view", `${name}@${version}`, "version", "license", "deprecated", "engines", "--json"], {
      maxBuffer: 1024 * 1024,
    });
    return { name, version, metadata: JSON.parse(stdout) };
  } catch {
    return { name, version, unverified: "npm registry metadata could not be fetched" };
  }
}

async function outdatedReport() {
  try {
    const { stdout } = await runNpm(["outdated", "--json"], {
      maxBuffer: 2 * 1024 * 1024,
    });
    return JSON.parse(stdout || "{}");
  } catch (error) {
    try {
      return JSON.parse(error.stdout || "{}");
    } catch {
      return null;
    }
  }
}

async function auditSummary() {
  try {
    const { stdout } = await runNpm(["audit", "--json"], {
      maxBuffer: 4 * 1024 * 1024,
    });
    return JSON.parse(stdout).metadata?.vulnerabilities ?? null;
  } catch (error) {
    try {
      return JSON.parse(error.stdout || "{}").metadata?.vulnerabilities ?? null;
    } catch {
      return null;
    }
  }
}

async function main() {
  const all = process.argv.includes("--all");
  const baseArg = process.argv.indexOf("--base");
  const base = baseArg >= 0 ? process.argv[baseArg + 1] : process.env.BASE_SHA;
  const currentManifest = readJson("package.json");
  const currentLock = readJson("package-lock.json");
  let removed = [];
  let names = Object.keys({
    ...currentManifest.dependencies,
    ...currentManifest.devDependencies,
    ...currentManifest.optionalDependencies,
  });
  if (!all) {
    if (!base) {
      console.log("DEPENDENCY_STATUS_SKIPPED: no base SHA and no --all option.");
      return;
    }
    const baseManifest = JSON.parse(gitShow(base, "package.json"));
    const baseLock = JSON.parse(gitShow(base, "package-lock.json"));
    const changed = changedDirectDependencies(baseManifest, currentManifest, baseLock, currentLock);
    const currentNames = new Set([
      ...Object.keys(currentManifest.dependencies ?? {}),
      ...Object.keys(currentManifest.devDependencies ?? {}),
      ...Object.keys(currentManifest.optionalDependencies ?? {}),
    ]);
    removed = changed.filter((name) => !currentNames.has(name)).map((name) => ({ name, version: lockedVersion(baseLock, name) }));
    names = changed.filter((name) => currentNames.has(name));
  }
  if (!names.length && !removed.length) {
    console.log("DEPENDENCY_STATUS_OK: no changed direct dependencies.");
    return;
  }

  for (const row of removed) console.log(`REMOVED ${row.name}@${row.version ?? "unknown"}: review removal rationale and remaining callers.`);
  if (!names.length) return;
  console.log(`Dependency metadata for ${names.length} ${all ? "direct" : "changed direct"} package(s):`);
  const metadata = [];
  for (let index = 0; index < names.length; index += 4) {
    metadata.push(...await Promise.all(names.slice(index, index + 4).map((name) => {
      const version = lockedVersion(currentLock, name);
      return version ? registryMetadata(name, version) : Promise.resolve({ name, unverified: "no exact lockfile version" });
    })));
  }
  for (const row of metadata) {
    if (row.unverified) {
      console.log(`UNVERIFIED ${row.name}: ${row.unverified}`);
      continue;
    }
    const value = row.metadata;
    const license = Array.isArray(value.license) ? value.license.join(", ") : value.license ?? "not listed";
    const deprecation = value.deprecated ? ` DEPRECATED: ${value.deprecated}` : " not deprecated";
    console.log(`${row.name}@${row.version} | license=${license} | engines=${JSON.stringify(value.engines ?? {})} |${deprecation}`);
  }

  if (all) {
    const outdated = await outdatedReport();
    if (outdated === null) console.log("UNVERIFIED outdated report: npm registry request failed.");
    else {
      const rows = Object.entries(outdated);
      console.log(`Outdated direct dependencies: ${rows.length}`);
      for (const [name, value] of rows) console.log(`${name}: current=${value.current} wanted=${value.wanted} latest=${value.latest}`);
    }
    const vulnerabilities = await auditSummary();
    console.log(vulnerabilities
      ? `npm audit (report only): ${vulnerabilities.total} total; high=${vulnerabilities.high}; critical=${vulnerabilities.critical}; moderate=${vulnerabilities.moderate}; low=${vulnerabilities.low}`
      : "UNVERIFIED full npm audit report: npm registry request failed.");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
