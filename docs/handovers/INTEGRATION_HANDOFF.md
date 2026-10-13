# NexTap integration handoff

Audit date: 2026-10-10. Branch: `integration/preprod`.
Worktree: `F:/projects/NexTabCodex-integration-preprod`.

This report supersedes environment and test counts in the deployment agent's historical `docs/handovers/DEPLOYMENT_HANDOFF.md`. No hosted configuration, Production data, DNS, original branch, or existing worktree was modified by this integration. Only uniquely named QA fixtures were written to the approved staging database through application/API workflows. They remain available for inspection.

## 1. Branches and commits integrated

- Authoritative application: `beta01.6`, `44fa12e2b4cf838cc7635db1681469329a4b2406` (user-confirmed).
- Infrastructure: `chore/production-setup`, `a431c079ae67c1b4e60727142bc5edf2a29b85cb`.
- Common ancestor: `90fddfaa72242feab39b63246f5809cc5e704032`.
- Integration merge commit: `b4f8f875a474d22d906c4d9a4cb08987e4e75cda`.
- Created an isolated worktree from the authoritative application and merged infrastructure with `--no-ff --no-commit`, then reviewed and tested the combined result before committing.
- Preserved application commits `c28383a` (provider actions/layout), `0643ac4` (optimization phases 1-3), `a3076c2` (admin pagination/history), `a39449b` (atomic saves), and `44fa12e` (publication caching).
- Both source branches and their checkouts were clean and unchanged. No push, main merge, worktree deletion, or remote workflow/deployment was performed.

## 2. Conflicts and resolutions

Git reported **no textual merge conflicts**. Semantic compatibility required the following repairs:

1. The manufacturing ZIP route existed in the original checkout but was ignored by `*.zip`, so it was absent from the user-confirmed application commit despite a clean Git status. Recovered that exact reviewed source at `src/app/admin/cards/batches/[id]/manufacturing.zip/route.ts` and added a narrow ignore exception. Owner authentication and private/no-store downloads are preserved.
2. Fresh migration replay exposed a deferrable `(page_id, section_key)` uniqueness constraint incompatible with the incremental save's `ON CONFLICT`. Added forward migration `20261010132029_preprod_contract_repairs.sql` to restore a non-deferrable key constraint while retaining deferrable position uniqueness and all rows/IDs.
3. Publication-cache public SECURITY INVOKER wrappers lacked permissions on their private read functions. The same repair grants execution only on those two functions. SQL tests cover anonymous publication reads, draft isolation, superseded/disabled/archived publication denial, and non-owner mutation denial. The private schema must remain outside the Data API.
4. Production-build card assignment persisted successfully but stalled on its Server Action/RSC redirect. Replaced only assignment/deactivation transport with authenticated native POST/303 at `/api/admin/cards/assignment`, retaining the atomic database RPC and confirmation. Same-origin, claims, owner allowlist, UUID, and mode checks are covered by nine unit cases. The exact upstream Next/React cause was not established.
5. After successful draft save, route revalidation through Server Actions could keep Save/Publish disabled and leave the deferred Live Preview stale while newer edits remained in the input. The editor now uses authenticated same-origin JSON POST at `/api/admin/businesses/draft`, calling the existing validated save/publish routines and retaining cache invalidation. It tracks the mutation promise explicitly and clears its busy state in `finally`. Revision tracking, deferred preview, upload locks, error recovery, and atomic save behavior are retained. Seven endpoint unit cases cover authorization, mode selection, failures, and private responses; delayed-save browser tests verify newer edits and Live Preview stay current.
6. Browser tests now wait for streamed tables using retrying assertions, scope assignment controls precisely, search the target page rather than assuming it is in the first 100 results, and use a uniquely seeded fixture for media and one-page card selection. Gallery geometry is measured after scrolling it into view because offscreen sections use content-visibility optimization. No failing assertion was replaced with a sleep or a reload workaround.

No wholesale branch/file selection or unrelated UI redesign was performed.

## 3. Infrastructure compatibility

- Next.js 15.5.27, React 19.1.1, TypeScript 5.9.2, Node 22.23.2 locally; Vercel/CI target Node 22. Existing security headers and build configuration retained.
- Integrated ESLint and CI dependencies/scripts. Added pinned PGlite 0.5.8 for disposable PostgreSQL contract tests. Lockfile and package declarations agree.
- CI now includes `beta01.6` and `integration/preprod`, runs lint/typecheck/unit/SQL contracts/build and public desktop/mobile browser smoke. It uses placeholder public environment values and does not deploy. Owner mutation tests are local against approved staging, not enabled with Production credentials in CI.
- E2E can run the production build (`E2E_SERVER_MODE=production`) or its isolated development output directory. Generated artifacts, temporary Supabase CLI files, environment files, and build output remain ignored.
- TypeScript includes generated Next types; artifacts are excluded. ESLint excludes isolated Next output directories. Existing lint warnings remain, with no errors.
- Environment guard in `src/lib/config/environment.mjs` runs before Next and E2E startup. Development/Preview/staging/test reject Production and unknown hosted project URLs. Production requires the dedicated project, rejects dev mode and mutation-enabled E2E. Vercel target conflicts fail closed. `NODE_ENV=production` alone is not treated as a Production deployment. Local Supabase is allowed; the CI placeholder is allowed only in CI.
- Environment names: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, optional `NEXT_PUBLIC_CONTACT_WHATSAPP`, and `NEXTAP_ENV` for explicit non-Vercel targets. No service-role key is required. `.env.example` documents staging. Integration `.env.local` contains staging-only settings and ignored test credentials; no original Vercel OIDC token was copied.
- Protected routes retain owner allowlist authorization. New card endpoint independently verifies claims and owner membership; public/anonymous access tests cover protected downloads and routes.

## 4. Actual validation results

**Final production-build E2E: 54/54 passed, 0 failed, 0 skipped, retries disabled**, across desktop (1440x960) and mobile (390x844). Run `01a12664-c080-7caa-a871-aec6543e7ca5`, 204.59 seconds. Evidence: `artifacts/e2e-verified/report.json` and `summary.md`. Coverage includes owner login/session refresh/authorization, business creation/editing, dynamic section reordering, Live Preview, dirty drafts/save/retry/preview/publish, provider/social/payment actions, card manufacturing/activation/deactivation/reassignment, public pages/old-slug aliases/permanent redirects, responsive layout and Arabic RTL.

- `npm ci`: passed; the final pinned PGlite dependency was subsequently installed and lockfile updated.
- `npm run lint`: pass, **0 errors / 13 existing warnings** (`artifacts/final-lint.log`).
- `npm run typecheck`: pass (`artifacts/final-typecheck.log`).
- `npm test`: **84 tests in 15 files pass** (`artifacts/final-unit.log`).
- `npm run test:db`: **18 migrations replayed, 4 SQL contract suites pass**, plus anonymous publication RPC calls (`artifacts/final-db.log`). Entirely disposable in-memory PostgreSQL; no hosted migration executed.
- `npm run build`: pass (`artifacts/build-editor-transport.log`). Includes recovered manufacturing route and authenticated card/draft POST endpoints.
- Focused production media/editor/card regression run: **10/10 pass**, desktop and mobile, no retries (`artifacts/e2e-transport-fix/report.json`). Earlier card-only run: 4/4 pass.
- `git diff --check`, staged whitespace check, and unresolved-entry check: pass.
- Browser visual inspection: Arabic `lang=ar` / `dir=rtl`, actual 390px viewport and 390px content width (no horizontal overflow); inspected demo screenshot `artifacts/mobile-demo-390.png`. Demo had no console errors.

Earlier runs are retained for diagnosis: initial development suite found the missing manufacturing route; full production suite found card transport failures; focused and full reruns found the editor transition/Live Preview lock and pagination/visibility assumptions in the tests. These were fixed and their affected workflows rerun rather than marked as passing retroactively.

Scope/limits: browser tests run local `next start` against real staging Auth/Storage/database. Staging lacks phase6 RPCs, so hosted public-page E2E exercises the compatibility fallback. The publication-cache fast path and its privileges are validated on disposable PostgreSQL, not yet in hosted staging. PGlite uses minimal Auth/Storage SQL scaffolding and does not emulate those services. Updated GitHub Actions have not run remotely because no branch was pushed.

## 5. External environment status (read-only audit)

### Supabase

| Environment | Project | Status |
| --- | --- | --- |
| Development/test/staging | `NexTabCodex`, `flkakuysakgwfoemgbwn` | ACTIVE_HEALTHY, eu-west-1, PostgreSQL 17.11; approved test data; one owner allowlist row |
| Production | `NexTapProduction`, `jezpobjlfvihikplxrta` | ACTIVE_HEALTHY, eu-west-1, PostgreSQL 17.11; zero businesses/cards/owners/Auth users at audit |

- All 11 public tables have RLS enabled in both projects.
- Production has only the original 11 migrations through Quick Actions; provider profiles and later optimization/save/cache changes are absent.
- Staging has 17 remote migration records, including provider/phase5 fixes and admin indexes, but lacks phase6 cache RPCs. Its remote constraint repair was not represented in the repository until this integration repair.
- Remote migration names/timestamps differ from local history in BOTH projects. **Do not blindly run `supabase db push`.** Reconcile actual definitions and recorded history before proposing a forward deployment.
- Both Auth site URLs are `http://localhost:3000`; redirect allowlists are empty; general and email signup are enabled. Hosted staging and Production Auth settings still need explicit environment-specific configuration.
- API exposes `public` and `graphql_public`, not `private`. Staging REST access to private schema was denied (406/PGRST106).
- Advisors: Production warns about authenticated execution of `public.create_card_batch`; code and local contracts verify owner checks. Staging additionally has publicly callable SECURITY DEFINER `rls_auto_enable()` and disabled leaked-password protection. Review before release; nothing remotely patched.

### Vercel

- Project `nextap`, `prj_XZKEV6TOqxSy9Hqiw43gZtdz5dZQ`, team `team_j1AHLbF49M6Ob2sm2QBz7sA5`.
- Next.js / Node22.x / `npm ci` / `npm run build`. No deployments, `live=false`, no GitHub link.
- Preview URL points to staging; Production URL points to the dedicated Production project. Public keys have sensitive metadata and were not decrypted during audit.
- Preview site URL: `https://staging.nextab.services`; Production: `https://nextab.services`.
- No Development variables; configure staging/local values before using Vercel Development. Guard rejects absent or unsafe values.
- No custom staging environment: staging uses Preview. `staging.nextab.services` is bound to branch `staging`, not this integration branch. Apex/admin/staging domains are attached and verified, but DNS activation remains pending.
- MCP account scope returned403; authenticated CLI with explicit team scope supplied the read-only evidence.

### Cloudflare and GitHub

- Cloudflare `nextab.services`, zone `e6df0803efd4b1bdaac8e20a07dc360a`, remains pending/non-authoritative. Nameservers: `carl.ns.cloudflare.com`, `stella.ns.cloudflare.com`.
- Existing DNS-only records unchanged: apex A `76.76.21.21`, admin/staging CNAME `cname.vercel-dns.com`. No live DNS or registrar change.
- GitHub `abdelrahman-elseht/NexTapCodex`: public, default `beta01`, no `main` branch. Staging protection requires strict `quality`, one review, last-push approval, conversation resolution, and disallows force push/deletion; administrator enforcement is off.
- No repository Actions secrets. This integration did not trigger workflows, alter protections, or link Vercel to GitHub.

## 6. Remaining issues and manual actions

- Reconcile migration histories and apply the reviewed forward changes to staging before claiming hosted cache validation. Production remains behind and is not release-ready.
- Configure hosted Auth URLs/redirects, signup policy, and owner onboarding independently per environment. The app's owner allowlist is not a substitute for an explicit signup policy.
- Resolve dependency audit findings before Production: **11 advisories (2 moderate, 7 high, 2 critical)** in the captured audit, including sharp/native image dependencies, Next/PostCSS and lint transitives, and Vitest/tinypool. `artifacts/npm-audit.json` contains details. No forced major dependency upgrade was made during integration.
- Address Supabase advisor findings, verify backup/PITR entitlement and restore procedure, and validate monitoring/alerts before release.
- Existing create-business HTML slug pattern emits a browser regex warning; server-side slug validation remains active. This was not changed in the integration.
- QA businesses/cards/publications/media remain in staging. Fixture IDs are in ignored `artifacts/preprod-fixture.json`; test-created names use QA/E2E prefixes. No bulk cleanup or deletion performed.
- Local artifacts and screenshots are ignored, not committed. Preserve them separately if transferring this worktree.

## 7. Readiness for staging

**Ready for hosted Staging validation; local integration checks are green. Not ready for Production activation.** Both source commits are parents of the integration merge, no unresolved conflicts remain, and source branches are unchanged. Supabase URL isolation is enforced and tested. Hosted migration reconciliation, Auth configuration, deployment setup and cache-fast-path E2E remain explicit staging/release gates.

The integration is prepared for a reviewed Preview/Staging deployment. It does not activate hosted infrastructure. Existing staging domain binding and absent Vercel GitHub integration mean pushing this branch alone is not evidence of a deployed staging app.

## 8. Exact recommended next steps before Production

1. Review this branch and its two-parent merge against `44fa12e`. Push only `integration/preprod` when ready and run the updated GitHub `quality` workflow. Use the protected staging review process; do not merge main as part of this task.
2. Snapshot/back up staging, inventory remote migration bodies and history against the 18 local files, and prepare a reviewed history-reconciliation plan. Do not mark migrations applied merely by matching names. Apply only the confirmed missing forward changes to staging, including phase6 and the contract repair; retain a rollback/recovery plan.
3. Confirm staging still targets `flkakuysakgwfoemgbwn`, private schema is unexposed, and public cache RPCs work anonymously while draft/non-owner checks fail. Configure staging Auth site/allowed redirects for the actual Preview domain and choose signup policy.
4. Create a Vercel Preview deployment from the integration commit using Preview variables only. Review GitHub linkage/automatic deployment policy and branch/domain binding before enabling them. Do not use `--prod`. Build separately for each environment: Next public variables are embedded in the browser bundle, so never reuse a Production build for Preview or promote a staging bundle as a Production build. A Vercel preview URL can be validated while Cloudflare is pending.
5. Rerun all core owner/public/RTL/mobile flows on that hosted Preview, explicitly verifying the phase6 fast path, old-slug aliases, permanent card URLs, activation/deactivation/reassignment, uploads and protected exports. Record hosted results and resolve audit/security advisories with focused tests.
6. Separately prepare Production: backup/restore checks, reconciled migrations, dedicated owner account/allowlist, Production Auth settings, correct isolated environment keys, monitoring, and rollback plan. Verify the Production database has the full tested schema without copying test data.
7. Obtain explicit approval for Production deployment and registrar/DNS activation. Review all existing DNS records (including any mail/service records) before any nameserver change. Only then activate and perform post-release smoke checks; never reuse staging credentials.

### Local reproduction (PowerShell)

With ignored staging-only `.env.local` and owner E2E credentials configured:

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:db
npm.cmd run build
$env:E2E_ALLOW_MUTATIONS='true'
$env:E2E_FIXTURE_PATH='artifacts/preprod-fixture.json'
# Seed once for a fresh workspace; existing fixtures can be reused.
npm.cmd run test:e2e:seed
$env:E2E_SERVER_MODE='production'
npx.cmd e2e run --output artifacts/e2e-verified --reporter list,markdown --retries 0
git diff --check
```
