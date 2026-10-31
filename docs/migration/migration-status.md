# Migration status and evidence

Status date: 2026-10-31. **Phase 0: READY FOR REVIEW. Phase 1: COMPLETE against its documented local acceptance criteria; review pending.** Phase 1 was explicitly approved for the existing `migration-architecture` worktree. No later phase is started, and this status is not evidence that a Cloudflare deployment works.

## Approved source and worktree

- Owner clarification, 2026-10-30: **Main is the source of truth that Staging will match.** Application code and intended schema follow approved Main through reviewed promotion and forward migrations. Environment-specific configuration and sanitized Staging test data stay isolated; this is not approval to synchronize data, deploy or apply schema changes.
- Approved source: Main at `230adeca680c0fe7e22b3ece0fd9169764b84ffe`. The foundation audit's read-only remote lookup on 2026-10-30 returned the same SHA for `origin/main`; this continuation did not repeat a network lookup.
- Branch: `migration-architecture`. Dedicated worktree: `F:/projects/nextap-migration-architecture`. HEAD is the approved SHA. The existing branch/worktree was inspected and safely reused.
- Original checkout `F:/projects/NexTap-contacts` remains on `main`. Its tracked edits are `.gitignore`, `AGENTS.md`, `docs/README.md`, `src/app/admin/businesses/_components/business-editor.tsx`, `src/app/admin/businesses/_components/contact-card-editor.tsx`, `src/lib/business/contact.ts`, `tests/e2e/contacts.e2e.ts`, and `tests/unit/contacts-ux.test.ts`. Its untracked files are `docs/research/PUBLIC_PROFILE_MEDIA_AND_PERFORMANCE.md`, `docs/specs/CLOUDFLARE_R2_MIGRATION_SPEC.md`, and `docs/specs/NEXTAP_MIGRATION_FOUNDATION_AGENT_PROMPT.md`. The start inventory recorded status and hashes before documentation writes; the final continuation rechecked that these status entries remain. No writes were made to the original checkout. Hashes were not recaptured in this final pass.
- Other branches/worktrees were preserved. A branch is not a deployment environment; Production remains on Vercel.
- Remote freshness is the read-only check dated 2026-10-30 only. Recheck approval/source before future work; newer Main is not automatically approved.

## Deliverables

- [Current architecture](../architecture/current-architecture.md): route/data/security/media/CI and dated hosted schema evidence, Worker compatibility matrix and blockers.
- [Codebase structure](../architecture/codebase-structure.md): actual layout, the extracted draft workflow and Contact Projection v1 boundaries, remaining mixed responsibilities and future dependency checks.
- [Migration plan](migration-plan.md): two-Worker target, publication protocol/failures, cache/revocation, copy plan, cost/performance and owner decisions.
- [Migration specification](migration-spec.md): phases 0-12 with approval gates, implementation surfaces, checks, acceptance, failure, rollback and open evidence.
- This file records baseline, validation and approval ledger.
- [Architecture navigation](../ARCHITECTURE.md) links the five deliverables.
- [Cloudflare platform research](../research/CLOUDFLARE_WORKERS_PLATFORM_EVIDENCE.md) is first-party-source research dated 2026-10-30. The foundation prompt, R2 spec and public-media investigation are supporting documentation in this worktree.
- Phase 1 changed only the draft-action workflow boundary, its Supabase persistence adapter, Contact Projection v1 typing/validation and focused unit/boundary coverage. No application route moved; no package, lockfile, environment configuration, SQL migration, hosted environment, R2 bucket, DNS, deployment or Production resource changed.

## Evidence and result

Previously collected, read-only evidence dated 2026-10-30 is carried forward from the foundation audit; the final documentation continuation did not rerun hosted SQL/catalog queries, public DNS lookup, or remote freshness checks. The earlier audit inspected Git history/refs/worktrees and dirty state, source/routes/SQL/migrations/CI, lockfile resolution, npm registry metadata and official Cloudflare/Supabase documents. Its selected Staging/Production catalog queries did not select application rows.

- Earlier selected catalog evidence reported PostgreSQL 17.11 and RLS enabled on eleven public application tables and sampled private tables in both projects. Each migration ledger had 31 entries, but names/versions differed; equal counts do not establish schema parity.
- Earlier catalog evidence found `public.update_business_page` in Production but not Staging. The current contact editor uses `save_contact_draft`; a legacy direct save calls `update_business_page`. Treat the Staging difference as drift to reconcile against approved Main intent, including exact signature, authorization and grants, through a reviewed forward migration. Production presence is not schema authority; no reconciliation was applied.
- Earlier catalog evidence found `private.snapshot_media_paths` identical in both environments and excluding AVIF. The local MIME migration does not repair registration. A forward migration and controlled re-registration remain proposals; neither was applied or tested.
- Source inspection confirms `/b/[slug]` remains dynamic and contacts Supabase; current media may also use Supabase. Existing behavior does not meet the target zero-request design.
- Native Sharp, Worker route/middleware compatibility, standalone HTML generation, R2 read-only enforcement and publish concurrency still need implementation/runtime proof. No proposed compatibility check or migration is claimed as executed.
- Earlier DNS evidence reported Hostinger nameservers. This continuation did not recheck DNS. Cloudflare zone/settings, Auth allowlists, current provider deployment trigger, account plan/usage, backup and restore remain unavailable or unverified.
- During this continuation, Git status/branch/HEAD were rechecked for both worktrees; the approved worktree remains at the approved SHA and the original checkout's listed changes remain present. Source environment-variable names and CI workflow trigger/input locations were inventoried without printing values.

## Phase 0 validation (carried forward)

The earlier documentation continuation checked relative links/source anchors, UTF-8 and whitespace, `git diff --check`, architecture navigation and preservation of the original checkout. No new hosted queries or deployment checks are implied by those Phase 0 results.

## Phase 1 implementation and validation

The selected behavior-preserving slice is the Admin contact draft save/publish path. `src/app/admin/businesses/draft-actions.ts` keeps the Next.js Server Action contract and delegates revision checks/outcome mapping to `src/lib/business/draft-workflow.ts`. `src/lib/supabase/contact-draft-persistence.ts` performs contact-photo preparation and the existing `save_contact_draft` RPC. `src/lib/contracts/contact-projection-v1.ts` defines the strict Zod Contract consumed by business contact/publication types and VCF serialization. Boundary and unit tests cover this workflow and Contract. The draft route now compares local browser Origin with the forwarded request Host while preserving the configured canonical-origin check for hosted environments. No database/provider behavior changed.

- `npm run typecheck`: passed.
- `npm run lint`: passed with 13 warnings and no errors.
- `npm test`: passed, 41 test files and 273 tests.
- `npm run build`: fresh production build passed using local placeholder Supabase values and the isolated `.next-phase1-build` output directory; no hosted project was contacted or modified.
- E2E: `tests/e2e/public-journey.e2e.ts` passed all 6 desktop tests in the earlier run. The affected Admin test, `tests/e2e/contacts.e2e.ts` with `tests/e2e/contacts.local.config.ts`, ran against local Supabase and synthetic main/branch fixtures. Report: `tests/e2e/tests/e2e/.e2e/phase1-local-contacts-verification-20261030-5/report.json`; exact result was 2 passed and 2 failed across 390px and 1440px. The anonymous denial test passed at both widths. The editor flow reached contact preview and produced valid downloaded VCF artifacts at both widths, then its `POST /api/admin/businesses/draft` returned HTTP 403 with the matching local Origin; the UI stayed at `Unpublished changes` and showed `Connection failed`. Save/reload, publish, public VCF, and disable behavior were not reached.
- Local test-process audit: the runner environment had zero unexpected variable names and the app command received only the local Supabase URL `http://127.0.0.1:56321`, its local publishable key, and synthetic fixture/test-owner inputs. No hosted Staging/Production credentials were present in the test process, and no credential values were printed or recorded. The worktree contains `.env.example` only; no `.env` file was modified.
- A local-only sign-in with the synthetic E2E owner followed by read-only owner-row and capability queries found the owner row and edit/publish capabilities. Only presence/booleans were reported; the diagnostic signed out.
- Follow-up diagnosis corrected the earlier trace-only conclusion: the browser trace showed `Origin: http://127.0.0.1:3137`, but Next reconstructed the server `request.url` as `http://localhost:3137`. The request-scoped log correlated by response header showed middleware claims present and the route rejecting at `origin-check` with HTTP 403 before claims/owner route checks or any action. The earlier hypothesis that `owner_users` lookup caused the 403 was incorrect. The browser received no redirect. The local account was then confirmed by password sign-in to the local Auth endpoint and a read-only `owner_users` lookup; the row's role is `administrator`.
- The retained Next log contained startup lines only and had no request checkpoints. Current Supabase monitoring guidance routes diagnosis through the unified Logs view or SQL log queries; the local CLI guide notes that local log collection depends on the Analytics Server and Docker logging-driver access. Read-only local probes returned HTTP 200 from `/auth/v1/health`, HTTP 200 from `/rest/v1/`, and HTTP 302 from the local Analytics root. The Supabase CLI and Docker CLI were unavailable, so no request-correlated Auth/Postgres logs could be read. No credentials, cookies, JWTs, draft contents, or response secrets were printed.
- Added opt-in request checkpoints to the draft middleware and route. They are disabled unless `NEXTAP_REQUEST_DIAGNOSTICS=true`, the Supabase URL is exactly `http://127.0.0.1:56321`, and neither environment marker is production. Logs contain only a random request ID, checkpoint/status, cookie presence/count, claims presence, safe Auth/PostgREST error codes, owner-row presence, and validation booleans. The same ID is returned in a response header for correlation; cookies, JWTs, user IDs, request bodies and draft contents are not logged. Session refresh still uses the existing cookie adapter and forwards refreshed request/response cookies.
- Added `local draft authorization probe does not save`, which signs in using the local synthetic owner and posts a dummy draft with an invalid mode. Its authenticated execution initially reproduced the 403 and the correlated checkpoints established the Origin mismatch. After the fix, it passed at 390px with HTTP 400 `Invalid save mode.` after middleware claims, route claims, owner lookup, rate limit, and content-type checks; it stops before any save/publish action. The test's invalid mode and dummy payload cause no persistence.
- The optional Vector collector was reported restarting because its Docker log endpoint was unavailable. It did not prevent the observed browser run: Next started, anonymous-denial checks completed, and the contact-preview endpoint returned a valid VCF. The draft request received an application-level 403. Docker CLI was unavailable for an independent collector check; Docker security settings and repository configuration were left untouched.
- No schema migration, database reset, or business/page/card/media fixture write occurred. No hosted Supabase project, Cloudflare, Vercel, DNS, deployment, or Production resource was accessed.
- `npm run typecheck`: passed after the Origin fix and route regression test.
- `npm run lint`: passed with 13 warnings and no errors after the fix.
- `npm test`: passed, 41 test files and 274 tests after the regression test.
- `npm run build`: fresh isolated production build passed in `.next-phase1-diagnostic-user-3` using only the local Supabase URL/key and local site URL; no hosted project was contacted. Next's generated type-path edits were removed while preserving the pre-existing `tsconfig.json` and `next-env.d.ts` changes.
- E2E: `local draft authorization probe does not save` ran separately at `--target 390` and `--target 1440`; both passed (1 selected, 1 passed each) with the local-only URL guard and `E2E_ALLOW_MUTATIONS=false`. Reports: `tests/e2e/tests/e2e/tests/e2e/.e2e/phase1-local-user-diagnostic-20261031-4/report.json` and `tests/e2e/tests/e2e/tests/e2e/.e2e/phase1-local-user-diagnostic-20261031-5/report.json`. Correlated responses were HTTP 400 with the expected invalid-mode class; no draft action or RPC ran. The full fixture-mutating journey was not rerun: it writes/publishes and disables contact data on the synthetic main/branch pages, and the test has no cleanup or restoration for those changes. Browser sign-in created normal local Auth sessions; no Auth user, business, page, media, or publication fixture was created or modified by these probes.
- The first local probe run before the fix failed as expected with 403. Its browser trace reported request Origin `http://127.0.0.1:3137`; the server log for the matching request ID reported expected/request URL origin `http://localhost:3137`. After the fix, the passing probe log reported `hostOrigin` `http://127.0.0.1:3137`, `allowed=true`, `claimsPresent=true`, `ownerFound=true`, and a 400 response after the invalid-mode check. Diagnostic lines contain no credentials, cookies, JWTs, user IDs, draft contents, or raw response bodies.
- Full local contact E2E rerun (2026-10-31): `tests/e2e/contacts.e2e.ts` passed all 3 tests at both 390px and 1440px (6/6 total), including contact preview/VCF, save/reload, publish, public VCF download, and disable. Report: `tests/e2e/.e2e/report.json`, run `01a1912d-c4c3-7541-b8de-d4bccebb6a45`. A temporary runner loaded only `_LOCAL` URL/key/owner entries from the original checkout's ignored env file, enforced the exact local Supabase URL, created a uniquely named business with new main/branch pages and required hero/contact sections, and supplied only local credentials/IDs to E2E. Cleanup deactivated those two pages and archived that business; immutable publication history remains attached to the retired local fixture. No existing synthetic fixture, Auth user, or hosted project was changed. The first attempt with an incomplete disposable fixture failed the app's expected hero-section validation and was retired; the corrected fixture passed. Request-correlated diagnostics show the origin check allowed the browser Host, claims and owner checks passed, and save/publish actions returned HTTP 200. No cookies, JWTs, user IDs, draft contents, or response bodies were logged.
- `git diff --check`: passed after the route/test/doc changes. Git emitted only line-ending normalization warnings for existing Phase 1 source/test edits.
- `git diff --check`: passed after the diagnostic changes. Git emitted only line-ending normalization warnings for existing Phase 1 source/test edits.
- WSL preflight (2026-10-30): Ubuntu reached the local Supabase Auth health endpoint on port `56321` (HTTP 200), but its environment had no `NEXT_PUBLIC_SUPABASE_URL`, local publishable key, or synthetic owner credentials. Ubuntu Node.js `22.22.1` is below the installed E2E CLI requirement; the CLI ran successfully through Windows Node.js `22.23.2` from the mounted worktree (`e2e 0.18.0`). The authenticated probe was not run, so no draft request, fixture mutation, or correlated route diagnostic was produced. No Supabase CLI was available in WSL or Windows.
- WSL auth preflight (2026-10-31): found the newly supplied values only in the original checkout's ignored `.env.local`; its Supabase URL was not the required local endpoint, so that URL was not used. The publishable key from that file returned HTTP 200 from the local Auth settings endpoint at `http://127.0.0.1:56321`. A password sign-in sent only to that local endpoint returned `invalid_credentials`; the account is absent from local Auth or its credentials do not match. No owner lookup or draft POST followed. No hosted request was made and no Auth or business fixture was created or changed.

The checks above cover the Phase 1 changes and the local-only diagnostics. The origin authorization defect is established and fixed. The full browser journey now exercises `saveDraftState`, the workflow, photo adapter, `save_contact_draft`, publication, and public VCF behavior against a disposable local fixture. Cleanup retires the newly created business and deactivates both pages while preserving immutable publication history. No existing synthetic fixture or hosted resource was changed.

Phase 1's documented local acceptance criteria are met. The established cause of the draft POST 403 was an origin comparison mismatch: Next supplied a `localhost` request URL while the browser Origin and request Host were `127.0.0.1`; the route compared Origin to the reconstructed URL origin. The route now uses the request Host for local same-origin validation and retains the configured canonical origin in hosted environments. A unit regression test confirms the local proxy case passes authorization while a foreign Origin remains denied, and the full disposable-fixture browser journey passes. The source dependency closures are recorded in [codebase structure](../architecture/codebase-structure.md#verified-phase-1-import-closures); the extracted-workflow boundary test and AST closure evidence satisfy the Phase 1 source-level gate. Emitted route manifests, deployment separation, and published Portfolio Contract compatibility are not Phase 1 gates and remain later-phase evidence. The current `/b/[slug]` Supabase read is recorded existing behavior, not a Phase 1 failure. No changes were made in the original `main` checkout.

## Phase 1 acceptance evidence

| Phase 1 criterion | Evidence in this worktree | Result |
| --- | --- | --- |
| Extract a real workflow boundary and keep provider behavior at its adapter | `draft-actions.ts` delegates revision/result mapping to `draft-workflow.ts`; `contact-draft-persistence.ts` retains the existing Supabase RPC/photo path. Workflow and adapter unit coverage passed; disposable-fixture browser save/publish passed. | Met for the selected module boundary and exercised persistence path. |
| Add a transitive boundary check in the existing test system | `tests/unit/business-module-boundaries.test.ts` passed as part of 41 files / 273 tests. It verifies the selected workflow and Contract edges and records current Admin/Public provider edges. | Met for this narrow slice; not a global layering or deployment check. |
| Evidence relevant route/import closures | Read-only AST analysis recorded 19 Admin action, 24 Admin draft POST route, and 22 Public page first-party modules with verified provider paths in the linked architecture document. | Met as source evidence; emitted route manifests and credential isolation are not proved here. |
| Preserve current behavior and authorization through relevant browser workflow | Origin defect is diagnosed and fixed; authenticated probe passed through claims/owner checks; disposable-fixture save/reload/publish/download/disable and anonymous-denial journeys passed at 390px and 1440px. | Met for this Admin contacts workflow. |
| Run typecheck, lint, unit tests, fresh production build and relevant E2E | Typecheck passed; lint passed with 13 warnings; 41 files / 274 tests passed; fresh isolated production build passed; full local contacts E2E passed 6/6 across 390px and 1440px with verified fixture retirement. | Met for this Phase 1 validation slice. |
| Keep the existing Public Supabase lookup classified correctly | `/b/[slug]` closure and RPCs are documented as current behavior; removal is assigned to the later Public-delivery phase. | Recorded; not a Phase 1 failure. |

The local draft authorization and persistence journey are verified, and the newly created fixture was retired after the run. All criteria in the Phase 1 row of [migration specification](migration-spec.md) have evidence recorded above. This closes Phase 1 implementation acceptance for review; it does not establish deployment separation, hosted behavior, or later-phase acceptance.

## Acceptance evidence ledger

| Area | Foundation finding | Future acceptance |
| --- | --- | --- |
| Performance | Current dynamic Supabase page fails the target architecture | zero ordinary Portfolio Supabase requests and measured targets |
| Security | Private Storage/RLS and role gates documented | exactly two isolated app deployments; Public cannot write/list R2 or load Admin secrets; privacy negatives pass |
| Publishing | DB revision rules exist; R2 coordination absent | deterministic/idempotent publish, CAS generation, last-good and crash recovery |
| Revocation | 60-second visibility is proposed, not approved or measured | owner approves bound; purge/cache failures and regions prove maximum |
| Staging isolation | Selected project/RLS facts verified | guard rejects Production; sanitized data; no external side effects |
| Production recovery | account backup state unavailable | independently restore DB and object bytes; owner-approved RPO/RTO |
| DX/AX | existing npm/CI/test system inventoried | reproducible pinned Worker path, exact SHA and useful repair evidence |

No future criterion is reported complete.

## Approval ledger and owner decisions

| Action | Current authorization |
| --- | --- |
| Read-only inspection, preserve dirty state, safe worktree and five docs | Authorized for this assignment; complete |
| Main authority and Staging alignment direction | Confirmed by owner on 2026-10-30; documentation updated only. Code/schema promotion and hosted operations still require their separate gates |
| Phase 1 modular foundation in the approved worktree | Approved and implemented locally for review; no later phase is authorized |
| Supabase migration/AVIF registration, R2 setup or Staging data overwrite/copy | Not approved |
| Production data/schema/resource change or deployment | Not approved |
| Main integration, push/merge or CI trigger | Not approved |
| DNS/nameserver/TLS/Auth callback cutover | Not approved |
| Vercel retirement or media cleanup | Not approved |

Owner decisions (recommendation and effect of delay):

1. Deactivation freshness: approve max 60 seconds plus purge acceleration; shorter bound needs more coordination/cost. Delay blocks cache design.
2. Public media: immutable hash URLs with purge/retention policy recommended; per-request private URL authorization is stronger but adds runtime/cost. Delay blocks bucket policy.
3. Staging-copy scope/sanitization/overwrite: minimize/synthesize and back up Staging first; broader copy increases privacy risk. Delay blocks any copy.
4. Independent DB/object backup budget and RPO/RTO: fund separately and test restores; without that recovery remains unproven. Delay blocks Production readiness.
5. Image processor: choose after Worker benchmark and image/privacy matrix; retain current Vercel path meanwhile. Delay blocks media parity.
6. Release/cutover: canary with Vercel retained and DNS rollback rehearsal recommended. Delay blocks Production routing only.

## Next allowed step

Review the Phase 1 worktree diff and its recorded acceptance gap. Any later phase, hosted operation, deployment or source integration requires its own authorization.
