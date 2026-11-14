# Phase 1 Operational Checks

Status: local synthetic log-redaction checks, approved staging-test rate-limit scenarios, and dev/staging deployment/rollback preflight validation are implemented. Development Worker version `7de1da94-e479-47bf-9fe4-a72959cbf06f` is recorded as the sole 100% current version, with D1/R2/KV binding metadata verified; Wrangler reported no deployment targets, and no route, custom domain, or workers.dev target was added. Staging deployment, Worker logging, live rate-limit enforcement, rollback rehearsal, and production readiness remain unverified. This procedure does not authorize production changes, public routing, or later-phase features.

## Local checks

Run the deterministic unit tests and the executable self-check:

```sh
npx vitest run tests/unit/phase1-ops-checks.test.ts
node scripts/cloudflare/phase1-ops-checks.mjs --self-test
```

The self-check injects synthetic credentials, contact values, and card tokens into structured log data, serializes the redacted result, and fails if a protected fixture survives. Safe request diagnostics remain. Import `redactOperationalLog` or `serializeOperationalLog` at the eventual Worker logging boundary; this source check does not prove a deployed logger, exception reporter, or third-party telemetry path uses it. Do not send real contact data or credentials to this local check.

The sanitizer removes sensitive-key fields, bearer credentials, JWT-shaped values, email addresses, phone-number-shaped values, and card tokens in `/c/` paths or token query parameters. Request and response bodies must not be passed to operational logging at all. Add the sanitizer at each logging and error-reporting boundary when those runtime paths are implemented, and test the actual serialized output there.

## Rate-limit decisions and staging tests

The owner approved the packet's proposed thresholds for bounded staging tests. These values are test targets, not workload-derived production quotas or proof of deployed controls. `PHASE1_RATE_LIMIT_POLICIES` records them as `approved-staging-test`; the self-check's policy readiness is not live-enforcement readiness. Its result includes `liveEnforcement: false`, and no Worker/service boundary currently consumes the policies.

| Operation | Approved staging-test counters | Rejection behavior |
| --- | --- | --- |
| Sign-in | Environment + source IP: 10 per 15 minutes; environment + normalized account-key HMAC: 5 per 15 minutes | `429` + `Retry-After`; generic auth body |
| Recovery | Environment + source IP: 5 per 30 minutes; environment + normalized account-key HMAC: 3 per 30 minutes | `429` + `Retry-After`; generic recovery body |
| Card resolution | No approved hard counter. Keyed token fingerprint is an abuse signal only; no per-token cap. | Fingerprint alone must never reject a lookup. Any IP ceiling remains a load-test candidate, not approved. |
| Upload | Environment + verified staff subject + business ID: 20 per hour; same key: 3 per minute | `429` before processing or object writes |
| Publication | Environment + verified staff subject + business ID + page ID: 10 per hour; same key: 2 per minute | `429` before publication; preserve prior active version |
| Other admin mutation | Environment + verified staff subject + business ID: 60 per minute | `429` before mutation; no partial canonical-state change |
| Export | Environment + verified staff subject + business ID: 3 per hour | `429` before export generation |

Account keys and token fingerprints must be keyed hashes with a secret unavailable to clients, not reversible or logged identifiers. Do not trust caller-supplied subject or business IDs. Direct `/b/{slug}` profile reads are static/CDN delivery and bypass the application limiter entirely. Do not place those reads behind the application rate-limit path.

The local synthetic tests exercise bounded in-memory sequences, including allowed requests, `429`, `Retry-After`, and window expiry. They also verify that 15 synthetic card resolutions in one minute pass even when fingerprints repeat, and that direct `/b/{slug}` reads bypass the application limiter. These are simulator checks, not requests to Cloudflare or the staging Worker. A keyed fingerprint may be recorded for abuse review, but it does not impose a cap; legitimate QR/NFC bursts above 10 scans per minute must remain possible. Card/IP ceilings require representative load testing and separate owner approval before activation.

For live enforcement, first select a supported mechanism and confirm its counter semantics and plan support. Cloudflare's Workers Rate Limiting binding supports only 10- or 60-second periods and approximate per-location counters, so it can exceed configured counts and does not provide a strict global cap. WAF rule characteristics and periods depend on the zone plan; the approved $5 Workers Paid starting tier alone does not establish WAF availability. A rate-limit store/dependency failure must fail closed for protected mutations without partially changing canonical state. Demonstrate each applicable threshold and response with bounded synthetic traffic against isolated staging before reporting the live gate passed. No staging enforcement evidence currently exists.

## Dev/staging deployment checks

Use the supported wrapper in local dry-run mode first:

```sh
node scripts/cloudflare/phase1-deploy.mjs --environment development --account-id "$CLOUDFLARE_ACCOUNT_ID"
```

The wrapper defaults to dry-run and accepts only the environment, config path, account ID, and explicit `--deploy` switch; it rejects arbitrary Wrangler flags and positional arguments. It reads the selected `[env.<environment>]` bindings from the chosen TOML config, rejects production tables, routes/custom domains, inherited root resource bindings, and enabled `workers_dev`, then compares exact D1 and KV IDs plus the R2 bucket name against `phase1-resource-matrix.json`. It invokes authenticated `wrangler whoami --json` and requires the selected account ID to appear in the authenticated account list. It sets `CLOUDFLARE_ACCOUNT_ID` for subsequent Wrangler calls, runs Wrangler's local `deploy --dry-run` with fixed `--config` and `--env` arguments, and checks Wrangler's resolved D1/R2 names and KV ID against the selected config. Only after these checks does `--deploy` compose a fixed `wrangler deploy --config ... --env ...` invocation. After deployment, it reads JSON deployment status and the current version's JSON metadata, requiring one 100% current version and exact D1 ID, R2 name, and KV namespace ID matches. No caller-supplied route or production booleans control these checks.

The account ID is a non-secret Cloudflare identifier. The operator owns confirming it from the intended account and supplying it via `--account-id` or `CLOUDFLARE_ACCOUNT_ID`; it is not checked into the resource matrix or config by this work. Wrangler still requires valid credentials in its supported local or CI credential store. The wrapper's `whoami`, deployment status, and version metadata steps are read-only authenticated Cloudflare requests; dry-run compiles locally without upload.

### Development deployment evidence

On 2026-11-14, one guarded development deployment used confirmed account ID `a401ce0eabf88b4042e48ba94180234b` and Worker name `nextap-phase1-runtime-development`. Wrangler reported `Uploaded nextap-phase1-runtime-development`, then `No targets deployed`. The wrapper's read-back checks returned current version ID `7de1da94-e479-47bf-9fe4-a72959cbf06f` at `100%` and verified these version bindings against the development matrix: `NEXTAP_DB` D1 ID `a64cabf6-b8f4-41aa-84fc-b7fed5d2dde7`; `NEXTAP_PUBLIC_MEDIA` bucket `nextap-dev-public`; `NEXTAP_SLUG_CACHE` namespace ID `58df600b88a94da7806deb7ad5bc90c2`. The 100% field describes the current Worker version assignment; `No targets deployed` confirms this change added no route/worker.dev target and does not establish public reachability. No staging deployment was attempted.

The checked-in `phase1-runtime.wrangler.toml` is local configuration, not evidence of deployed Worker bindings. Direct `wrangler deploy` remains technically possible and bypasses the wrapper. Treat direct invocation as unsupported for Phase 1; use `phase1-deploy.mjs` as the deployment entrypoint. The wrapper's checks protect its own fixed command path and do not constrain users who bypass it.

### Temporary reachable staging smoke

The Worker foundation includes one temporary `GET /__ops/smoke` route. It returns only `environment`, `healthy`, and D1/R2 health booleans. It requires a generated bearer secret, checks for the recovery-approved synthetic business fixture in staging D1, and calls `head` on the recovery-approved synthetic R2 object. Invalid credentials and all other paths return 404; non-GET requests return 405. The route does not use Access or business authentication and grants no application capability. All application/admin routes remain 404, and `/b/{slug}` is not implemented in this Worker.

The regular runtime config keeps `workers_dev = false`. A separate checked-in `phase1-smoke.wrangler.toml` enables workers.dev only for the staging smoke Worker, has no route/custom-domain declarations, and must contain exact fixture references supplied by the recovery handoff. Do not deploy while either placeholder remains. The wrapper requires `--smoke-reachable`, staging, the canonical smoke config, the exact matrix bindings, authenticated account identity, Wrangler dry-run binding checks, and a successful read of the account workers.dev subdomain before it writes the temporary Worker secret or issues the single Worker deploy. It reads `CLOUDFLARE_MIGRATION_API_TOKEN` from the process environment or ignored repository `.env` without shell evaluation or output, and passes it to Wrangler in memory as `CLOUDFLARE_API_TOKEN`. The token must already allow account identity/subdomain reads, staging Worker deploy, and Worker secret write; any denial stops before deployment, with no permission escalation or alternate target.

Run only after the recovery agent confirms the synthetic fixtures and their cleanup plan:

```sh
node scripts/cloudflare/phase1-deploy.mjs --environment staging --account-id "$CLOUDFLARE_ACCOUNT_ID" --smoke-reachable --deploy
```

The wrapper generates and writes the smoke secret without printing it, then sends one authenticated GET to the derived workers.dev URL and accepts only a staging response with both health checks true. Record the returned Worker version and endpoint, then coordinate fixture cleanup. Once cleanup is confirmed, remove the temporary secret with the non-deploying command:

```sh
node scripts/cloudflare/phase1-deploy.mjs --environment staging --account-id "$CLOUDFLARE_ACCOUNT_ID" --remove-smoke-secret
```

This remains a narrow runtime smoke, not proof of recovery acceptance, authorization, environment credential isolation, public profile delivery, or production readiness. Do not add Access, custom domains, routes, production DNS, or a second deployment as a workaround.

## Dev/staging rollback checks

`validatePhase1RollbackPlan` checks a supplied deployment record locally. It accepts only matrix-verified development or staging identities, rejects another environment's resources, and requires a distinct current and previous Worker version, same-environment rollback, smoke checks, and evidence capture. If D1 migrations have applied, it also requires proof that the prior Worker remains schema-compatible and a corrective numbered migration-forward plan. Worker rollback never implies D1 rollback.

The function validates a plan; it does not call Cloudflare, deploy a Worker, run migrations, restore D1, or perform a rollback rehearsal. For each future dev/staging release, capture version and binding identities plus migration state before the change, deploy only through the guarded workflow, run authorization and data-integrity smoke checks, and record timestamps, versions, checksums, failures, and outcome. Use Cloudflare's documented version/deployment controls to restore the prior Worker version in the same environment; keep D1 migration recovery forward-only. Rehearse this separately in development and staging before marking rollback tested. Production rollback remains deferred.

## Evidence status

| Control | Local evidence | Runtime or owner gate |
| --- | --- | --- |
| Redaction | Synthetic values are absent from serialized output in unit and CLI checks | Integrate at all Worker, exception, and telemetry boundaries and test deployed output |
| Rate limits | Approved staging-test thresholds and synthetic sequence checks cover `429`/`Retry-After`; QR/NFC burst above 10/minute and direct `/b/{slug}` bypass are checked | Live enforcement is not implemented or verified; select a supported mechanism and prove applicable thresholds with bounded synthetic traffic in isolated staging |
| Deployment preflight | One development deployment passed config/matrix, authenticated-account, Wrangler dry-run, current-version, and exact binding checks; no targets/routes were deployed | Staging deployment and rollback rehearsal remain unverified; direct Wrangler can bypass this wrapper |
| Rollback | Local validation rejects production/cross-environment targets and requires migration-forward handling | Rehearse a Worker rollback and smoke checks independently in development and staging |

## Official Cloudflare references

- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/)
- [Rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Workers versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/)
