#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const allowedEnvironments = new Set(["development", "staging"]);
const resourceKinds = ["d1", "r2", "kv"];

export function validatePhase1Target(matrix, environment) {
  if (!allowedEnvironments.has(environment)) {
    throw new Error("Phase 1 mutations are limited to development or staging.");
  }

  const target = matrix?.environments?.[environment];
  if (!target || !["provisioned-empty", "ready"].includes(target.status)) {
    throw new Error(`Phase 1 ${environment} resources are not verified and ready.`);
  }

  const resources = Object.fromEntries(resourceKinds.map((kind) => [kind, target[kind]]));
  if (resourceKinds.some((kind) => !resources[kind] || typeof resources[kind] !== "object")) {
    throw new Error(`Phase 1 ${environment} target must identify D1, R2, and KV resources.`);
  }

  const otherEnvironment = environment === "development" ? "staging" : "development";
  const other = matrix.environments[otherEnvironment];
  if (!other || !["provisioned-empty", "ready"].includes(other.status)) {
    throw new Error(`Phase 1 ${otherEnvironment} resources are not verified and ready.`);
  }
  if (resourceKinds.some((kind) => !other[kind] || typeof other[kind] !== "object" || !(other[kind].id || other[kind].name))) {
    throw new Error(`Phase 1 ${otherEnvironment} target must identify D1, R2, and KV resources.`);
  }

  for (const kind of resourceKinds) {
    const currentIdentities = new Set([resources[kind].id, resources[kind].name].filter(Boolean));
    const otherIdentities = [other?.[kind]?.id, other?.[kind]?.name].filter(Boolean);
    if (otherIdentities.some((identity) => currentIdentities.has(identity))) {
      throw new Error(`${kind.toUpperCase()} resource is shared by development and staging.`);
    }
  }

  return { environment, resources };
}

export async function runPhase1Mutation({ matrix, environment, targetResources, execute }) {
  if (typeof execute !== "function") throw new Error("A mutation callback is required.");
  const target = validatePhase1Target(matrix, environment);
  for (const kind of resourceKinds) {
    const accepted = new Set([target.resources[kind].id, target.resources[kind].name].filter(Boolean));
    if (!accepted.has(targetResources?.[kind])) {
      throw new Error(`${kind.toUpperCase()} target does not match the declared ${environment} resource.`);
    }
  }
  return execute(target);
}

function readOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    if (!["--environment", "--d1", "--r2", "--kv"].includes(args[index]) || !args[index + 1]) {
      throw new Error("Usage: node scripts/cloudflare/phase1-target-check.mjs --environment development|staging --d1 <name-or-id> --r2 <name> --kv <name-or-id>");
    }
    const key = { "--environment": "environment", "--d1": "d1", "--r2": "r2", "--kv": "kv" }[args[index]];
    options[key] = args[++index];
  }
  return options;
}

function main(args) {
  const options = readOptions(args);
  if (!options.environment || !options.d1 || !options.r2 || !options.kv) {
    throw new Error("All environment and resource identity arguments are required.");
  }
  const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const matrix = JSON.parse(readFileSync(resolve(root, "infra/cloudflare/phase1-resource-matrix.json"), "utf8"));
  const target = validatePhase1Target(matrix, options.environment);
  for (const kind of resourceKinds) {
    const accepted = new Set([target.resources[kind].id, target.resources[kind].name].filter(Boolean));
    if (!accepted.has(options[kind])) throw new Error(`${kind.toUpperCase()} target does not match the declared ${options.environment} resource.`);
  }
  process.stdout.write(`Phase 1 target verified: ${target.environment}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
