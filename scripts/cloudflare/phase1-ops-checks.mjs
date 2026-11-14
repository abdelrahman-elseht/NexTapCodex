#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePhase1Target } from "./phase1-target-check.mjs";

const protectedOperations = [
  {
    operation: "admin-sign-in",
    counters: [
      { dimension: "environment + source IP", threshold: 10, windowSeconds: 900 },
      { dimension: "environment + normalized account-key HMAC", threshold: 5, windowSeconds: 900 },
    ],
    response: "429 with Retry-After; same generic authentication response for known and unknown accounts",
  },
  {
    operation: "admin-recovery",
    counters: [
      { dimension: "environment + source IP", threshold: 5, windowSeconds: 1800 },
      { dimension: "environment + normalized account-key HMAC", threshold: 3, windowSeconds: 1800 },
    ],
    response: "429 with Retry-After; identical response for known and unknown accounts",
  },
  {
    operation: "card-resolution",
    counters: [],
    dimension: "environment + keyed token fingerprint as an abuse signal only; no per-token cap; no approved IP ceiling",
    response: "No fingerprint-based rejection; any IP ceiling remains an unapproved load-test candidate",
  },
  {
    operation: "media-upload",
    counters: [
      { dimension: "environment + verified staff subject + business ID", threshold: 20, windowSeconds: 3600 },
      { dimension: "same verified subject/business key", threshold: 3, windowSeconds: 60 },
    ],
    response: "429 with Retry-After before upload processing or object writes",
  },
  {
    operation: "publication",
    counters: [
      { dimension: "environment + verified staff subject + business ID + page ID", threshold: 10, windowSeconds: 3600 },
      { dimension: "same verified subject/business/page key", threshold: 2, windowSeconds: 60 },
    ],
    response: "429 with Retry-After before publication; preserve the prior active version",
  },
  {
    operation: "admin-mutation",
    counters: [{ dimension: "environment + verified staff subject + business ID", threshold: 60, windowSeconds: 60 }],
    response: "429 with Retry-After before mutation; no partial canonical-state change",
  },
  {
    operation: "export",
    counters: [{ dimension: "environment + verified staff subject + business ID", threshold: 3, windowSeconds: 3600 }],
    response: "429 with Retry-After before export generation",
  },
];

const sensitiveKey = /(?:authorization|cookie|token|secret|password|credential|email|phone|mobile|contact|signed.?url|upload(?:ed)?.?(?:bytes|content)|body|request.?body|response.?body)/i;
const redactions = [
  { pattern: /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, replacement: "Bearer [REDACTED]" },
  { pattern: /\b[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, replacement: "[REDACTED_JWT]" },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[REDACTED_CONTACT]" },
  { pattern: /(?<!\w)(?:\+?\d[\d ().-]{7,}\d)(?!\w)/g, replacement: "[REDACTED_CONTACT]" },
  { pattern: /(\bcard\s+token\s+)[A-Za-z0-9_-]{6,}/gi, replacement: "$1[REDACTED_CARD_TOKEN]" },
  { pattern: /((?:\/c\/|[?&](?:card_)?token=|[?&]cardToken=))[A-Za-z0-9_-]{6,}/gi, replacement: "$1[REDACTED_CARD_TOKEN]" },
];

export const PHASE1_RATE_LIMIT_POLICIES = Object.freeze(protectedOperations.map(({ operation, counters, dimension, response }) => Object.freeze({
  operation,
  status: "approved-staging-test",
  counters: Object.freeze(counters.map((counter) => Object.freeze(counter))),
  threshold: counters.length === 1 ? counters[0].threshold : null,
  windowSeconds: counters.length === 1 ? counters[0].windowSeconds : null,
  dimension: dimension ?? counters.map(({ dimension: counterDimension }) => counterDimension).join("; "),
  response,
  signalOnly: operation === "card-resolution",
  ownerApprovalRequired: false,
})));

function redactText(value) {
  return redactions.reduce((result, rule) => result.replace(rule.pattern, rule.replacement), value);
}

export function redactOperationalLog(value) {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactOperationalLog);
  if (value instanceof Error) {
    return {
      name: redactText(value.name),
      message: redactText(value.message),
      ...(value.stack ? { stack: redactText(value.stack) } : {}),
    };
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKey.test(key) ? "[REDACTED]" : redactOperationalLog(item),
    ]));
  }
  return value;
}

export function serializeOperationalLog(value) {
  return JSON.stringify(redactOperationalLog(value));
}

export function rateLimitReadiness(policies = PHASE1_RATE_LIMIT_POLICIES) {
  const unresolved = policies.filter((policy) => policy.status !== "approved-staging-test"
    || (!policy.signalOnly && (!Array.isArray(policy.counters) || policy.counters.length === 0
      || policy.counters.some(({ threshold, windowSeconds }) => !Number.isFinite(threshold) || threshold < 1
        || !Number.isFinite(windowSeconds) || windowSeconds <= 0)))
    || !policy.dimension
    || !policy.response);
  return {
    ready: unresolved.length === 0,
    approvedCount: policies.length - unresolved.length,
    unresolved: unresolved.map(({ operation }) => operation),
    liveEnforcement: false,
  };
}

/** Deterministic test-only model; this is not a runtime rate limiter. */
export function simulateSyntheticRateLimit({ limit, windowMs, timestamps }) {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs <= 0 || !Array.isArray(timestamps)) {
    throw new Error("Synthetic rate-limit scenario requires a positive limit/window and timestamp sequence.");
  }
  const accepted = [];
  return timestamps.map((timestamp) => {
    if (!Number.isFinite(timestamp) || timestamp < 0) throw new Error("Synthetic timestamps must be non-negative finite numbers.");
    while (accepted.length && accepted[0] <= timestamp - windowMs) accepted.shift();
    if (accepted.length >= limit) {
      return { status: 429, retryAfterSeconds: Math.max(1, Math.ceil((accepted[0] + windowMs - timestamp) / 1000)) };
    }
    accepted.push(timestamp);
    return { status: 200, retryAfterSeconds: null };
  });
}

/** Test-only route model: direct profile reads do not enter the app limiter.
 * @param {{ route: string, limit?: number, windowMs?: number, timestamps: number[], tokenFingerprints?: string[] }} options
 */
export function simulateSyntheticStagingRequests({ route, limit, windowMs, timestamps, tokenFingerprints = [] }) {
  if (!Array.isArray(timestamps)) throw new Error("Synthetic staging scenario requires a timestamp sequence.");
  if (route === "/b/{slug}") {
    return { route, limiterApplied: false, responses: timestamps.map(() => ({ status: 200, retryAfterSeconds: null })) };
  }
  if (route === "card-resolution") {
    if (tokenFingerprints.length && tokenFingerprints.length !== timestamps.length) {
      throw new Error("Synthetic fingerprint count must match the request sequence.");
    }
    return {
      route,
      limiterApplied: false,
      fingerprintAbuseSignals: [...new Set(tokenFingerprints)],
      responses: timestamps.map(() => ({ status: 200, retryAfterSeconds: null })),
    };
  }
  return {
    route,
    limiterApplied: true,
    responses: simulateSyntheticRateLimit({ limit: limit ?? 0, windowMs: windowMs ?? 0, timestamps }),
  };
}

/** @param {{ matrix: object, environment: string, bindings: object, expectedAccountId: string, authenticatedAccountId: string, routes: string[], productionMutation: boolean }} options */
export function validatePhase1DeployPreflight({
  matrix,
  environment,
  bindings,
  expectedAccountId,
  authenticatedAccountId,
  routes,
  productionMutation,
}) {
  const target = validatePhase1Target(matrix, environment);
  if (!Array.isArray(routes) || typeof productionMutation !== "boolean") {
    throw new Error("Deployment preflight requires explicit route and production-mutation declarations.");
  }
  if (productionMutation || (routes?.length ?? 0) > 0) {
    throw new Error("Phase 1 deployment cannot change production configuration, DNS, or routes.");
  }
  if (!expectedAccountId || !authenticatedAccountId) {
    throw new Error("Deployment preflight requires an explicitly confirmed expected account and authenticated account identity.");
  }
  if (expectedAccountId !== authenticatedAccountId) {
    throw new Error("Authenticated Cloudflare account does not match the explicitly confirmed expected account.");
  }

  const expectedBindings = {
    NEXTAP_DB: { field: "id", value: target.resources.d1.id },
    NEXTAP_PUBLIC_MEDIA: { field: "name", value: target.resources.r2.name },
    NEXTAP_SLUG_CACHE: { field: "id", value: target.resources.kv.id },
  };
  for (const [binding, { field, value }] of Object.entries(expectedBindings)) {
    const actual = bindings?.[binding];
    if (!actual || typeof actual !== "object") throw new Error(`Deployment is missing the ${binding} resource binding.`);
    if (!value || actual[field] !== value) {
      throw new Error(`${binding} does not match the declared ${environment} resource.`);
    }
  }

  return { environment, bindings: Object.keys(expectedBindings), accountVerified: true, declaredRoutes: routes, declaredProductionMutation: productionMutation };
}

export function validatePhase1RollbackPlan({ matrix, environment, targetResources, deployment, rollback }) {
  const target = validatePhase1Target(matrix, environment);
  for (const kind of ["d1", "r2", "kv"]) {
    const accepted = new Set([target.resources[kind].id, target.resources[kind].name].filter(Boolean));
    if (!accepted.has(targetResources?.[kind])) throw new Error(`${kind.toUpperCase()} target does not match the declared ${environment} resource.`);
  }
  if (!deployment?.currentVersion || !deployment?.previousVersion || deployment.currentVersion === deployment.previousVersion) {
    throw new Error("Rollback requires distinct current and previous deployment version identifiers.");
  }
  if (!rollback?.sameEnvironment || !rollback?.smokeChecks || !rollback?.recordEvidence) {
    throw new Error("Rollback must stay in the selected environment, run smoke checks, and record evidence.");
  }
  if (deployment.migrationsApplied && (!rollback?.forwardMigrationPlan || !rollback?.previousVersionSchemaCompatible)) {
    throw new Error("Applied D1 migrations require a compatible previous Worker and a corrective migration-forward plan.");
  }
  return {
    environment,
    action: "restore-previous-worker-version",
    dataAction: deployment.migrationsApplied ? "migration-forward-only" : "no-d1-change",
    productionMutation: false,
  };
}

export function runPhase1OperationalSelfTest() {
  const synthetic = {
    requestId: "req-synthetic-01",
    route: "/c/card-SYNTHETIC-TOKEN-123456",
    authorization: "Bearer synthetic-secret-value",
    contact: { email: "synthetic@example.invalid", phone: "+1 202 555 0101" },
    message: "failed for /c/card-SYNTHETIC-TOKEN-123456?token=card-SYNTHETIC-TOKEN-123456",
  };
  const serialized = serializeOperationalLog(synthetic);
  for (const forbidden of ["synthetic-secret-value", "synthetic@example.invalid", "+1 202 555 0101", "card-SYNTHETIC-TOKEN-123456"]) {
    if (serialized.includes(forbidden)) throw new Error("Synthetic redaction check leaked a protected value.");
  }
  if (!serialized.includes("req-synthetic-01")) throw new Error("Synthetic redaction check removed a safe request identifier.");
  const syntheticRates = simulateSyntheticRateLimit({ limit: 2, windowMs: 1_000, timestamps: [0, 1, 500, 1_000] });
  if (JSON.stringify(syntheticRates) !== JSON.stringify([
    { status: 200, retryAfterSeconds: null },
    { status: 200, retryAfterSeconds: null },
    { status: 429, retryAfterSeconds: 1 },
    { status: 200, retryAfterSeconds: null },
  ])) throw new Error("Synthetic rate-limit scenario did not match its expected response sequence.");
  const scanBurst = simulateSyntheticStagingRequests({
    route: "card-resolution",
    timestamps: Array.from({ length: 15 }, (_, index) => index * 1_000),
    tokenFingerprints: Array.from({ length: 15 }, (_, index) => `fingerprint-${index % 2}`),
  });
  if (scanBurst.responses.some(({ status }) => status !== 200)) throw new Error("Synthetic QR/NFC scan burst was unexpectedly rate limited.");
  const directProfile = simulateSyntheticStagingRequests({ route: "/b/{slug}", timestamps: [0, 1, 2] });
  if (directProfile.limiterApplied || directProfile.responses.some(({ status }) => status !== 200)) {
    throw new Error("Direct profile reads must bypass the application rate limiter.");
  }
  return { redaction: "pass", syntheticRateLimit: "pass", scanBurst: "pass", directProfileBypass: "pass", rates: rateLimitReadiness() };
}

function main(args) {
  if (args.length && args[0] !== "--self-test") throw new Error("Usage: node scripts/cloudflare/phase1-ops-checks.mjs [--self-test]");
  const result = runPhase1OperationalSelfTest();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.rates.ready) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
