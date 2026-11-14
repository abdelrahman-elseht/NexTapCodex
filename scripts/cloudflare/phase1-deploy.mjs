#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePhase1DeployPreflight } from "./phase1-ops-checks.mjs";

const environments = new Set(["development", "staging"]);
const defaultConfig = "infra/cloudflare/phase1-runtime.wrangler.toml";
const smokeFixtureId = "recovery-20261114-7f3a-business";
const smokeFixtureKey = "recovery-20261114-7f3a/media/synthetic.txt";
const resourceTables = {
  d1_databases: { binding: "NEXTAP_DB", fields: ["binding", "database_name", "database_id"] },
  r2_buckets: { binding: "NEXTAP_PUBLIC_MEDIA", fields: ["binding", "bucket_name"] },
  kv_namespaces: { binding: "NEXTAP_SLUG_CACHE", fields: ["binding", "id"] },
};

function usage() {
  return "Usage: node scripts/cloudflare/phase1-deploy.mjs --environment development|staging [--config <path>] [--account-id <id>] [--deploy] [--smoke-reachable | --remove-smoke-secret]";
}

export function parseDeployArguments(args, inheritedAccountId = "") {
  const options = { config: defaultConfig, accountId: inheritedAccountId, deploy: false, smokeReachable: false, removeSmokeSecret: false };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--deploy") {
      if (seen.has(flag)) throw new Error("Duplicate deployment flag.");
      seen.add(flag);
      options.deploy = true;
      continue;
    }
    if (flag === "--smoke-reachable") {
      if (seen.has(flag)) throw new Error("Duplicate smoke mode flag.");
      seen.add(flag);
      options.smokeReachable = true;
      options.config = "infra/cloudflare/phase1-smoke.wrangler.toml";
      continue;
    }
    if (flag === "--remove-smoke-secret") {
      if (seen.has(flag)) throw new Error("Duplicate smoke-secret cleanup flag.");
      seen.add(flag);
      options.smokeReachable = true;
      options.removeSmokeSecret = true;
      options.config = "infra/cloudflare/phase1-smoke.wrangler.toml";
      continue;
    }
    const keys = { "--environment": "environment", "--config": "config", "--account-id": "accountId" };
    const key = keys[flag];
    if (!key || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error(usage());
    if (seen.has(flag)) throw new Error(`Duplicate ${flag} option.`);
    seen.add(flag);
    options[key] = args[++index];
  }
  if (!environments.has(options.environment)) throw new Error("Phase 1 deployments are limited to development or staging.");
  if (options.smokeReachable && options.environment !== "staging") throw new Error("Reachable smoke deployment is restricted to staging.");
  if (options.removeSmokeSecret && options.deploy) throw new Error("Smoke-secret cleanup cannot deploy a Worker.");
  if (!options.accountId) throw new Error("Set --account-id or CLOUDFLARE_ACCOUNT_ID to the confirmed Cloudflare account ID.");
  return options;
}

function withoutTomlComment(line) {
  let quote = "";
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) { escaped = false; continue; }
    if (char === "\\" && quote === '"') { escaped = true; continue; }
    if ((char === '"' || char === "'") && (!quote || quote === char)) { quote = quote ? "" : char; continue; }
    if (char === "#" && !quote) return line.slice(0, index).trim();
  }
  return line.trim();
}

function parseTomlString(raw) {
  if (raw.startsWith('"') && raw.endsWith('"')) return JSON.parse(raw);
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1);
  throw new Error("Phase 1 Wrangler config contains an unsupported value for a checked field.");
}

function parseCheckedValue(key, raw) {
  if (["binding", "database_name", "database_id", "bucket_name", "id", "name", "account_id", "SMOKE_D1_FIXTURE_ID", "SMOKE_R2_FIXTURE_KEY"].includes(key)) return parseTomlString(raw);
  if (key === "workers_dev") {
    if (raw === "true") return true;
    if (raw === "false") return false;
    throw new Error("Phase 1 Wrangler config has an invalid workers_dev value.");
  }
  if (["routes", "route", "custom_domain", "custom_domains"].includes(key)) {
    if (raw === "[]") return [];
    if (raw.startsWith("[") && raw.endsWith("]")) {
      const body = raw.slice(1, -1).trim();
      if (!body) return [];
      return body.split(",").map((item) => parseTomlString(item.trim()));
    }
    return [parseTomlString(raw)];
  }
  return undefined;
}

export function readPhase1WranglerConfig(source, environment, { allowWorkersDev = false } = {}) {
  if (!environments.has(environment)) throw new Error("Phase 1 deployments are limited to development or staging.");
  const rootTable = { section: "", array: false, values: {} };
  const tables = [rootTable];
  let current = rootTable;
  for (const [index, sourceLine] of source.replace(/^\uFEFF/, "").split(/\r?\n/).entries()) {
    const line = withoutTomlComment(sourceLine).trim();
    if (!line) continue;
    const header = line.match(/^(\[\[?)([^\]]+)(\]\]?)$/);
    if (header) {
      const array = header[1] === "[[" && header[3] === "]]";
      const section = header[2].trim();
      if (header[1].length !== header[3].length || !section) throw new Error(`Invalid TOML table at line ${index + 1}.`);
      current = { section, array, values: {} };
      tables.push(current);
      continue;
    }
    const assignment = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.*?)\s*$/);
    if (!assignment) throw new Error(`Unsupported TOML syntax at line ${index + 1}.`);
    const table = current;
    const [, key, raw] = assignment;
    if (key in table.values) throw new Error(`Duplicate Wrangler config key ${key} in ${table.section || "root"}.`);
    const parsed = parseCheckedValue(key, raw);
    if (parsed !== undefined) table.values[key] = parsed;
  }

  const prohibitedRoutes = tables.some((table) => ["routes", "route", "custom_domain", "custom_domains"].some((key) => (table.values[key]?.length ?? 0) > 0));
  if (prohibitedRoutes) throw new Error("Phase 1 deployment config cannot declare routes or custom domains.");
  if (tables.some((table) => table.section === "env.production" || table.section.startsWith("env.production."))) {
    throw new Error("Phase 1 Wrangler config cannot define a production environment.");
  }
  if (tables.some((table) => table.array && Object.hasOwn(resourceTables, table.section))) {
    throw new Error("Phase 1 resource bindings must be declared under the selected environment.");
  }

  const rootSettings = tables.find((table) => table.section === "")?.values ?? {};
  if (tables.some((table) => table.values.workers_dev === true
    && !(allowWorkersDev && table.section === "env.staging"))) {
    throw new Error("workers.dev is allowed only in the selected staging smoke environment.");
  }
  const envTable = tables.find((table) => table.section === `env.${environment}` && !table.array);
  const envD1 = tables.filter((table) => table.section === `env.${environment}.d1_databases` && table.array);
  const envR2 = tables.filter((table) => table.section === `env.${environment}.r2_buckets` && table.array);
  const envKv = tables.filter((table) => table.section === `env.${environment}.kv_namespaces` && table.array);
  if (rootSettings.account_id !== undefined && typeof rootSettings.account_id !== "string") throw new Error("Invalid account_id in Wrangler config.");
  const expectedWorkersDev = allowWorkersDev && environment === "staging";
  if (rootSettings.workers_dev !== false || envTable?.values.workers_dev !== expectedWorkersDev) {
    throw new Error(expectedWorkersDev
      ? "Reachable smoke config must explicitly enable workers.dev only for the selected staging environment."
      : "Phase 1 deployment config must explicitly disable workers.dev for the root and selected environment.");
  }
  const smokeR2 = allowWorkersDev ? envR2.filter((table) => table.values.binding === "SMOKE_RECOVERY_MEDIA") : [];
  const canonicalR2 = envR2.filter((table) => table.values.binding === "NEXTAP_PUBLIC_MEDIA");
  if (envD1.length !== 1 || envKv.length !== 1 || canonicalR2.length !== 1
    || (allowWorkersDev ? smokeR2.length !== 1 || envR2.length !== 2 : envR2.length !== 1)) {
    throw new Error("Selected Wrangler environment must declare exactly one D1, R2, and KV binding.");
  }
  const bindings = Object.fromEntries([
    [envD1[0], resourceTables.d1_databases],
    ...canonicalR2.map((table) => [table, resourceTables.r2_buckets]),
    ...(allowWorkersDev ? smokeR2.map((table) => [table, { binding: "SMOKE_RECOVERY_MEDIA", fields: ["binding", "bucket_name"] }]) : []),
    [envKv[0], resourceTables.kv_namespaces],
  ].map(([table, definition]) => {
    const values = table.values;
    if (values.binding !== definition.binding || definition.fields.some((field) => typeof values[field] !== "string" || !values[field])) {
      throw new Error(`Wrangler ${environment} ${definition.binding} binding is incomplete or has an unexpected binding name.`);
    }
    return [definition.binding, Object.fromEntries(definition.fields.filter((field) => field !== "binding").map((field) => [
      field === "database_id" ? "id" : field === "database_name" || field === "bucket_name" ? "name" : field,
      values[field],
    ]))];
  }));
  if (typeof envTable?.values.name !== "string" || !envTable.values.name) throw new Error("Selected Wrangler environment must declare a Worker name.");
  const varsTable = tables.find((table) => table.section === `env.${environment}.vars` && !table.array);
  return {
    environment,
    workerName: envTable.values.name,
    accountId: rootSettings.account_id,
    workersDev: expectedWorkersDev,
    smokeFixtureId: varsTable?.values.SMOKE_D1_FIXTURE_ID,
    smokeR2FixtureKey: varsTable?.values.SMOKE_R2_FIXTURE_KEY,
    routes: [],
    bindings,
  };
}

function checkedConfigPath(root, requested) {
  const absolute = resolve(root, requested);
  const pathFromRoot = relative(root, absolute);
  if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) throw new Error("Wrangler config must be inside this repository.");
  return { absolute, relative: pathFromRoot };
}

function runCommand(command, args, { cwd, env, capture = true, input }) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: capture ? ["pipe", "pipe", "pipe"] : "inherit",
    input,
    maxBuffer: 8 * 1024 * 1024,
  });
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error };
}

function runRequiredCommand(runner, executable, args, context) {
  const result = runner(executable, args, context);
  if (result.error || result.status !== 0) throw new Error("Cloudflare preflight command failed; no deployment was issued.");
  return result;
}

function migrationApiToken(root, inheritedEnv) {
  if (inheritedEnv.CLOUDFLARE_MIGRATION_API_TOKEN) return inheritedEnv.CLOUDFLARE_MIGRATION_API_TOKEN;
  let source = "";
  try { source = readFileSync(resolve(root, ".env"), "utf8"); } catch { /* Optional ignored local file. */ }
  const line = source.split(/\r?\n/).find((item) => /^\s*CLOUDFLARE_MIGRATION_API_TOKEN\s*=/.test(item));
  const raw = line?.replace(/^\s*CLOUDFLARE_MIGRATION_API_TOKEN\s*=\s*/, "").trim() ?? "";
  const token = (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")) ? raw.slice(1, -1) : raw;
  if (!token || token.includes("$")) throw new Error("Reachable smoke requires CLOUDFLARE_MIGRATION_API_TOKEN in the process environment or ignored repository .env file.");
  return token;
}

async function workersDevSubdomain(accountId, token, fetcher) {
  const response = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`, {
    headers: { authorization: `Bearer ${token}` },
  }).catch(() => null);
  if (!response?.ok) throw new Error("Cloudflare workers.dev subdomain preflight failed; no deployment was issued.");
  const payload = await response.json().catch(() => null);
  const subdomain = payload?.result?.subdomain;
  if (typeof subdomain !== "string" || !/^[a-z0-9-]+$/.test(subdomain)) {
    throw new Error("Cloudflare workers.dev subdomain preflight returned an invalid value; no deployment was issued.");
  }
  return subdomain;
}

function assertSmokeConfig(config) {
  if (config.environment !== "staging" || !config.workersDev
    || config.smokeFixtureId !== smokeFixtureId
    || config.smokeR2FixtureKey !== smokeFixtureKey
    || config.bindings.SMOKE_RECOVERY_MEDIA?.name !== "nextap-recovery-backup-20261114-7f3a") {
    throw new Error("Reachable smoke config must target staging workers.dev and contain recovery-approved D1/R2 fixture references.");
  }
}

function accountIsAuthorized(whoamiText, expectedAccountId) {
  let identity;
  try { identity = JSON.parse(whoamiText); }
  catch { throw new Error("Authenticated Wrangler identity did not return valid JSON."); }
  const accountIds = Array.isArray(identity.accounts) ? identity.accounts.map((account) => account.id) : [];
  if (!accountIds.includes(expectedAccountId)) throw new Error("Authenticated Wrangler identity does not include the explicitly selected account.");
  return true;
}

function assertDryRunBindings(output, bindings) {
  const expected = [
    [`env.NEXTAP_DB (${bindings.NEXTAP_DB.name})`, "NEXTAP_DB"],
    [`env.NEXTAP_PUBLIC_MEDIA (${bindings.NEXTAP_PUBLIC_MEDIA.name})`, "NEXTAP_PUBLIC_MEDIA"],
    [`env.NEXTAP_SLUG_CACHE (${bindings.NEXTAP_SLUG_CACHE.id})`, "NEXTAP_SLUG_CACHE"],
  ];
  if (bindings.SMOKE_RECOVERY_MEDIA) expected.push([`env.SMOKE_RECOVERY_MEDIA (${bindings.SMOKE_RECOVERY_MEDIA.name})`, "SMOKE_RECOVERY_MEDIA"]);
  for (const [line] of expected) {
    if (!output.includes(line)) throw new Error("Wrangler dry-run resolved bindings do not match the selected Phase 1 environment.");
  }
}

function parseJsonCommandOutput(text, description) {
  try { return JSON.parse(text); }
  catch { throw new Error(`Wrangler ${description} did not return valid JSON.`); }
}

function getCurrentVersionId(deploymentText) {
  const deployment = parseJsonCommandOutput(deploymentText, "deployment status");
  const versions = deployment?.versions;
  if (!Array.isArray(versions) || versions.length !== 1 || versions[0]?.percentage !== 100 || typeof versions[0]?.version_id !== "string") {
    throw new Error("Deployed Worker metadata did not show one fully active version.");
  }
  return versions[0].version_id;
}

function verifyVersionBindings(versionText, expectedBindings) {
  const version = parseJsonCommandOutput(versionText, "version view");
  const bindings = version?.resources?.bindings;
  if (!Array.isArray(bindings)) throw new Error("Deployed Worker version did not return binding metadata.");
  const expected = [
    { name: "NEXTAP_DB", type: "d1", field: "id", value: expectedBindings.NEXTAP_DB.id },
    { name: "NEXTAP_PUBLIC_MEDIA", type: "r2_bucket", field: "bucket_name", value: expectedBindings.NEXTAP_PUBLIC_MEDIA.name },
    { name: "NEXTAP_SLUG_CACHE", type: "kv_namespace", field: "namespace_id", value: expectedBindings.NEXTAP_SLUG_CACHE.id },
  ];
  if (expectedBindings.SMOKE_RECOVERY_MEDIA) expected.push({ name: "SMOKE_RECOVERY_MEDIA", type: "r2_bucket", field: "bucket_name", value: "nextap-recovery-backup-20261114-7f3a" });
  for (const item of expected) {
    const matches = bindings.filter((binding) => binding.name === item.name && binding.type === item.type);
    if (matches.length !== 1 || matches[0]?.[item.field] !== item.value) {
      throw new Error(`Deployed Worker metadata does not match the ${item.name} target.`);
    }
  }
}

export async function runPhase1DeployEntry({
  args,
  root = resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
  run = runCommand,
  inheritedEnv = process.env,
  readConfig = (path) => readFileSync(path, "utf8"),
  fetcher = fetch,
}) {
  const options = parseDeployArguments(args, inheritedEnv.CLOUDFLARE_ACCOUNT_ID ?? "");
  const config = checkedConfigPath(root, options.config);
  if (options.smokeReachable && config.relative !== "infra/cloudflare/phase1-smoke.wrangler.toml") {
    throw new Error("Reachable smoke operations require the checked-in staging smoke config.");
  }
  const matrix = JSON.parse(readFileSync(resolve(root, "infra/cloudflare/phase1-resource-matrix.json"), "utf8"));
  const parsedConfig = readPhase1WranglerConfig(readConfig(config.absolute), options.environment, { allowWorkersDev: options.smokeReachable });
  if (options.smokeReachable) assertSmokeConfig(parsedConfig);
  if (parsedConfig.accountId && parsedConfig.accountId !== options.accountId) throw new Error("Wrangler config account_id does not match the selected account.");
  const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
  const apiToken = options.smokeReachable ? migrationApiToken(root, inheritedEnv) : inheritedEnv.CLOUDFLARE_API_TOKEN;
  const commandContext = { cwd: root, env: { ...inheritedEnv, CLOUDFLARE_ACCOUNT_ID: options.accountId, ...(apiToken ? { CLOUDFLARE_API_TOKEN: apiToken } : {}) } };
  const identity = runRequiredCommand(run, process.execPath, [wrangler, "whoami", "--json"], commandContext);
  accountIsAuthorized(identity.stdout, options.accountId);
  const target = validatePhase1DeployPreflight({
    matrix,
    environment: options.environment,
    bindings: parsedConfig.bindings,
    expectedAccountId: options.accountId,
    authenticatedAccountId: options.accountId,
    routes: parsedConfig.routes,
    productionMutation: false,
  });
  if (options.removeSmokeSecret) {
    runRequiredCommand(run, process.execPath, [wrangler, "secret", "delete", "SMOKE_TOKEN", "--config", config.relative, "--env", options.environment], commandContext);
    return { environment: options.environment, mode: "smoke-secret-removed", accountId: options.accountId };
  }
  const baseArgs = ["deploy", "--config", config.relative, "--env", options.environment];
  const dryRun = runRequiredCommand(run, process.execPath, [wrangler, ...baseArgs, "--dry-run"], commandContext);
  assertDryRunBindings(`${dryRun.stdout}\n${dryRun.stderr}`, parsedConfig.bindings);

  if (!options.deploy) return { environment: options.environment, mode: "dry-run", accountVerified: true, bindings: target.bindings };
  const subdomain = options.smokeReachable ? await workersDevSubdomain(options.accountId, apiToken, fetcher) : null;
  const smokeToken = options.smokeReachable ? randomBytes(32).toString("hex") : null;
  if (smokeToken) {
    runRequiredCommand(run, process.execPath, [wrangler, "secret", "put", "SMOKE_TOKEN", "--config", config.relative, "--env", options.environment], {
      ...commandContext,
      input: `${smokeToken}\n`,
    });
  }
  runRequiredCommand(run, process.execPath, [wrangler, ...baseArgs], { ...commandContext, capture: false });
  const deployment = runRequiredCommand(run, process.execPath, [wrangler, "deployments", "status", "--config", config.relative, "--env", options.environment, "--json"], commandContext);
  const versionId = getCurrentVersionId(deployment.stdout);
  const version = runRequiredCommand(run, process.execPath, [wrangler, "versions", "view", versionId, "--config", config.relative, "--env", options.environment, "--json"], commandContext);
  verifyVersionBindings(version.stdout, parsedConfig.bindings);
  if (smokeToken && subdomain) {
    const endpoint = `https://${parsedConfig.workerName}.${subdomain}.workers.dev/__ops/smoke`;
    const response = await fetcher(endpoint, { headers: { authorization: `Bearer ${smokeToken}` } }).catch(() => null);
    const payload = await response?.json().catch(() => null);
    if (response?.status !== 200 || payload?.environment !== "staging" || payload?.healthy !== true
      || payload?.checks?.d1 !== true || payload?.checks?.r2 !== true) {
      throw new Error("Reachable staging smoke failed its D1/R2 health checks; the smoke secret remains configured for cleanup.");
    }
    return { environment: options.environment, mode: "deployed-and-smoked", accountId: options.accountId, versionId, endpoint, checks: payload.checks, bindings: target.bindings, smokeSecretConfigured: true };
  }
  return { environment: options.environment, mode: "deployed", accountId: options.accountId, versionId, bindings: target.bindings };
}

async function main(args) {
  const result = await runPhase1DeployEntry({ args });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Phase 1 deployment preflight failed."}\n`);
    process.exitCode = 1;
  }
}
