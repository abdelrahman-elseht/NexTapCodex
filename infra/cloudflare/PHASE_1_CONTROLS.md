# Phase 1 Authorization and Operations Controls

Status: control design and target guard coverage are recorded; deployed admin authorization, independent Cloudflare credentials, Worker bindings/secrets, rate limiting, and rollback rehearsal are not yet evidenced. This note does not authorize production resources, DNS, routes, or deployment.

## Confirmed state

- The resource matrix records distinct development and staging D1, R2, and KV identities. Development D1 is in `WEUR`; staging D1 is in `EEUR`. Their resources are empty, and no Phase 1 Worker bindings or runtime secrets exist. See [`PHASE_1_ENVIRONMENTS.md`](PHASE_1_ENVIRONMENTS.md) and [`phase1-resource-matrix.json`](phase1-resource-matrix.json).
- [`phase1-target-check.mjs`](../../scripts/cloudflare/phase1-target-check.mjs) permits only `development` and `staging`, validates declared identities, and rejects identities shared across those environments. This is a local application guard. It does not constrain the Cloudflare API token, establish account-level isolation, validate deployed bindings, or protect an operation that bypasses the script.
- The migration token authorized for this work is an operator/CLI credential, not a Worker runtime secret. Existing evidence explicitly does not establish credential isolation. No token value is recorded here.
- There is no Phase 1 admin Worker or deployed Cloudflare Access application to test. The current application remains the compatibility baseline. Staging staff authorization, sign-out, MFA/recovery, and application authorization remain acceptance work.
- No Phase 1 deployment, production resource, production binding, DNS record, or public route is authorized by this note.

## Admin authentication and authorization

When the staging admin route exists, protect its dedicated hostname with a Cloudflare Access self-hosted application and a default-deny policy restricted to approved NexTap staff identities. Require the approved identity provider and MFA. Test anonymous requests, non-staff identities, expired sessions, logout, MFA recovery, and an allowed staff session in staging. Record the Access application audience for the runtime verifier only after the staging application exists.

Access authenticates a request at the edge; it does not replace application authorization. The Worker must validate the Access JWT signature, issuer/team domain, audience, expiry, and subject, then map the external subject to an active staff record and check a named capability for every protected operation. Deny when identity mapping, capability, or tenant scope is absent. Test staff with no capability, wrong-business scope, and allowed capability separately. Do not infer authorization from a valid Access cookie alone. Keep public profile delivery independent from Access and admin credentials.

This is a staging implementation and test plan, not evidence that Access or the application checks are deployed. Relevant requirements are in the active [migration PRD](../../docs/specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md#product-requirements).

## Environment and deployment boundaries

Keep separate resource IDs and bindings in explicit Wrangler environments. Each environment must bind only its own `NEXTAP_DB`, `NEXTAP_PUBLIC_MEDIA`, and `NEXTAP_SLUG_CACHE`. A deployment preflight must verify the selected environment, all three resolved resource identities, the intended account, and the checked-in matrix before Wrangler runs. CI should use a staging-only credential for staging jobs and must not expose the development credential to staging jobs. Dev/staging cross-mutation tests pass only when separate Cloudflare credentials are actually provisioned and a denied mutation is observed; the current shared/account-scoped migration token cannot prove that boundary.

Phase 1 deploy automation must reject `production`, unknown environments, missing identities, any cross-environment ID or name match, and any route, DNS, production data, production binding, or production configuration mutation. Do not add a production environment stanza or production credentials to the Phase 1 matrix. Keep the guard in front of every mutation entry point; a CLI command run outside the guarded workflow is outside the guard's protection. Current resource inventory is not runtime-isolation evidence.

The target-check unit tests cover environment allowlisting, complete identities, cross-environment collisions (including a matching ID or name when the other field differs), target mismatch, and the rule that failed validation occurs before the mutation callback. They do not prove Cloudflare IAM behavior or deployed configuration.

## Secrets and credential handling

- Keep operator API tokens in the approved local credential store or the CI secret store, scoped to the smallest account/resources and actions available. Never copy the migration token into `.env.cloudflare.local`, `.env.cloudflare.example`, Wrangler vars, application/browser variables, logs, test fixtures, prompts, or evidence.
- Once the Worker exists, store runtime secret values with Wrangler's secret mechanism separately for development and staging. Do not put secret values in `vars`, checked-in TOML, generated artifacts, command output, or deployment summaries. Access team domain and audience are configuration identifiers, not credentials; an Access JWT is sensitive request material.
- Keep runtime secrets distinct from CLI deployment credentials. Use separate credentials per environment where Cloudflare supports the required scope, and verify the boundary with negative cross-environment operations before claiming isolation.
- Treat export download URLs, Access cookies/JWTs, API authorization headers, session IDs, and temporary signed media URLs as secrets. Never put them in command transcripts or evidence. For local auth material, use the approved protected file and read it in-process without shell-sourcing arbitrary file content.

Official references: [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/), and [Access MFA requirements](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/mfa-requirements/).

## Logging, redaction, and rate limits

Worker and application logs should be structured around request ID, environment, route template, outcome, latency, and a non-reversible staff identifier where needed. Do not log request/response bodies, authorization or cookie headers, Access JWTs, API tokens, passwords, contact values, complete card tokens, signed URLs, or uploaded originals. For card support, log a keyed short fingerprint only if operations need correlation; never log the usable token. Apply the same redaction to exceptions and third-party telemetry. Tests must inject secret-shaped values, contacts, and full card tokens into each logging/error path and assert that serialized output contains none of them while preserving safe diagnostics.

No rate limit is currently configured or tested for a Phase 1 Worker. Before staging acceptance, define endpoint classes and use edge limits for unauthenticated abuse plus application limits keyed by verified staff identity for protected writes. A candidate staging policy to validate (not an approved production quota) is: login and recovery, 5 attempts per 15 minutes per IP with an additional account-keyed limit; protected mutations, 30 requests/minute per staff subject; exports and other high-cost operations, 3 starts/hour per subject. Return `429` with `Retry-After`, avoid account-enumerating differences, and test that limits do not cross-contaminate dev and staging. Tune values against legitimate workflows and Cloudflare plan capabilities before adoption. No rate-limit values should be represented as active until a staging test demonstrates enforcement.

Official reference: [Cloudflare rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/).

## Dev/staging rollback and migration-forward procedure

Until a Worker is deployed, the existing Next.js/Supabase/Vercel application remains the compatibility baseline. For a future dev/staging Worker release:

1. Capture the deployed Worker version, compatibility settings, environment bindings, migration ledger, and synthetic fixture checksums before mutation.
2. Deploy only to the selected non-production environment after target preflight; run anonymous, unauthorized, allowed, cross-environment, and data-integrity smoke checks.
3. On runtime regression, restore the previous known-good Worker version using Cloudflare's version/deployment rollback flow, then verify the same environment's bindings and smoke checks. Do not move traffic or bindings to another environment as a rollback shortcut.
4. Keep D1 changes migration-forward. Use expand/contract migrations so the old Worker version remains compatible during rollback. If a migration has already applied, deploy a corrective numbered migration; do not assume Worker rollback reverses D1. Preserve immutable R2 artifacts and restore data only into a separately verified empty target using the guarded restore workflow.
5. Record start/end timestamps, version IDs, migration state, checksums, failures, and recovery outcome. Rehearse the complete procedure independently in dev and staging before calling rollback tested.

No Phase 1 Worker rollback has been rehearsed; the existing D1 synthetic transport/restore evidence is not a rollback test or an RTO measurement. Production rollback remains a later cutover plan.

Official reference: [Workers versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/).

## Evidence needed to close these controls

| Control | Current evidence | Remaining proof |
| --- | --- | --- |
| Resource identity separation | Matrix and target-check tests | Deployed bindings and denied cross-environment mutation using distinct scoped credentials |
| Staff authentication | PRD contract only | Staging Access policy, allowed/denied identity tests, sign-out, MFA/recovery |
| Application authorization | PRD contract only | Runtime subject mapping, capability and tenant-scope deny/allow tests |
| Secret isolation | No runtime secrets configured | Per-environment secret setup and evidence no secret reaches logs/artifacts |
| Redaction | No target Worker logging path | Tests for credentials, contact values, full card tokens, signed URLs and exception paths |
| Rate limiting | No target Worker rules | Reviewed values and staging enforcement tests by route and environment |
| Deployment and rollback | Local target guard; no Phase 1 Worker deployed | Workflow preflight at each deploy entry point and rehearsed dev/staging Worker plus migration-forward recovery |
