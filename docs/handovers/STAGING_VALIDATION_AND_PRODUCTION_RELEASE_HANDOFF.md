# NexTap staging validation and production release handoff

Updated: October 13, 2026, approximately 13:26 Africa/Cairo (UTC+03:00).
Workspace: `F:\Abdelrahman\projects\NexTap\NexTapCodex`.
Branch: `chore/hosted-staging-validation`.
Current source commit: `814b5892ad2778079434f52232b713b51edc0083`
(`fix: use nextap services domain`).

This is the current operational handoff. It supersedes the DNS, deployment,
branch-binding, and next-action statements in the older deployment handovers.
The correct domain spelling is `nextap.services`.

## 1. Objective and current result

Finish hosted validation against isolated Supabase Staging, prepare a concrete
production release from validated source, and activate production when launch
is authorized. This documentation task does not perform or authorize a
production deployment, merge, database change, or new DNS change.

DNS and HTTPS are working for apex, admin, and staging. Vercel reports all three
domains as verified with valid DNS configuration. Staging serves a Ready
Preview when accessed through the authenticated Vercel CLI.

Main/admin return Vercel's `404 DEPLOYMENT_NOT_FOUND`: their DNS and certificates
work, but they do not yet serve an assigned production application. Staging's
unauthenticated Vercel-login redirect is Deployment Protection.

Complete hosted application validation remains pending. A `200` homepage
response proves reachability, not successful login, publishing, cards, or
monitoring.

## 2. Resources and environment separation

| Resource | Identifier or current state |
| --- | --- |
| Vercel project | `nextap` |
| Project ID | `prj_XZKEV6TOqxSy9Hqiw43gZtdz5dZQ` |
| Team slug / ID | `abdelrahman-867e` / `team_j1AHLbF49M6Ob2sm2QBz7sA5` |
| Connected repository | `abdelrahman-elseht/NexTapCodex` |
| Vercel Production Branch currently configured | `beta01`; legacy setting, rejected by the owner as the release source |
| Staging hostname branch | `chore/hosted-staging-validation`, freshly inspected |
| Ready Preview deployment | `dpl_CCGxHYZ9hGgeRZRz9cSfNPQo7W3r` |
| Deployment target | `preview`, freshly inspected |
| Preview URL | `https://nextap-m6quxxab7-abdelrahman-867e.vercel.app` |
| Stable staging URL | `https://staging.nextap.services` |
| Staging Supabase | `flkakuysakgwfoemgbwn` (`NexTabCodex`) |
| Production Supabase | `jezpobjlfvihikplxrta` (`NexTapProduction`) |
| Sentry identifiers in source | Organization `abdelrahman-0n`, project `nextap` |
| Earlier draft PR | `https://github.com/abdelrahman-elseht/NexTapCodex/pull/1`; checks not re-inspected here |

Inspection of `staging.nextap.services` resolves to the Ready deployment above.
The hostname binding changed from `staging` to
`chore/hosted-staging-validation` during the earlier continuation.

Public URL values and target metadata were re-inspected without decrypting
encrypted or sensitive keys:

| Vercel target | Supabase URL | `NEXT_PUBLIC_SITE_URL` |
| --- | --- | --- |
| Preview | `https://flkakuysakgwfoemgbwn.supabase.co` | `https://staging.nextap.services` |
| Production | `https://jezpobjlfvihikplxrta.supabase.co` | `https://nextap.services` |

Each target has `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: encrypted for Preview,
sensitive for Production. Secret values are omitted. Preview variables are
project-wide, with no branch override. Future Preview branches share Staging
unless explicitly isolated.

The source guard in `src/lib/config/environment.mjs` rejects Production
Supabase in development/Preview/tests and rejects Staging Supabase for a
Vercel Production build. Preserve it in hosted test configuration.

Vercel uses Node `22.x`, install `npm ci`, and build `npm run build`.

### Source branches and worktrees

The owner explicitly confirmed that `beta01` is not the intended production
branch. Its appearance above records Vercel's existing configuration only.
Do not push release work to `beta01` or select it as the launch source.

A fresh `git ls-remote --heads origin` and local worktree inventory confirmed:

| Branch or workspace | Role and current state |
| --- | --- |
| `chore/hosted-staging-validation` | Current candidate source at `814b589`; hosted validation remains pending |
| `origin/integration/preprod` | Existing consolidation/release-preparation branch at `1a24315` |
| `origin/chore/production-setup` | Historical infrastructure-preparation branch at `a431c07`; not the complete current app |
| `main` | Absent locally and remotely; proposed final release branch, not an established choice |
| Current registered worktree | `F:\Abdelrahman\projects\NexTap\NexTapCodex`, on the validation branch |
| Historical production-setup folder | `F:\projects\NexTabCodex-production-setup`; this path no longer exists |
| Separate production worktree | None registered in this repository |

`origin/integration/preprod` is an ancestor of the current candidate. It is
14 commits behind, with no unique commits on its side, at this inspection.
Complete validation and integrate the accepted candidate there before deriving
a release branch. Do not release the older preproduction tip unchanged.

Recommended final arrangement is a dedicated `main` branch derived from the
accepted preproduction source, with a sibling release worktree such as
`F:\Abdelrahman\projects\NexTap\NexTapCodex-release`. That branch and folder have
not been created. Confirm the final branch name as part of release preparation,
then align Vercel's Production Branch with it before launch. No Vercel branch
setting was changed by this documentation correction.

See [integration history](INTEGRATION_HANDOFF.md) for the original combination
of the application and infrastructure branches. Its `F:\projects\...` worktree
paths are historical and must not be treated as existing checkouts.

## 3. DNS, certificates, and access evidence

Hostinger remains authoritative through `helios.dns-parking.com` and
`aster.dns-parking.com`. No nameserver migration is needed.

| Type | Name | Target | Configured TTL |
| --- | --- | --- | --- |
| A | `@` | `216.198.79.1` | 14400 |
| A | `@` | `64.29.17.1` | 14400 |
| CNAME | `admin` | `2d714148d09163d5.vercel-dns-017.com` | 14400 |
| CNAME | `staging` | `2d714148d09163d5.vercel-dns-017.com` | 14400 |
| CNAME | `www` | `nextap.services` | 300 |

Configured records/TTLs come from the owner's screenshot. Public DNS confirmed
both apex A records and the admin/staging CNAMEs. The old apex IP `2.57.91.91`
is absent from observed apex answers. Vercel's apex/admin/staging responses show
`misconfigured: false`, `ipStatus: no-change`, and no conflicts.

The zone export at `C:\Users\NAID\Downloads\nextap.services.txt` predates these
changes and still contains the old IP. Do not restore it as current DNS.

The missing apex/admin certificate was issued successfully with:

```powershell
npx.cmd --yes vercel certs issue nextap.services admin.nextap.services --scope abdelrahman-867e
```

Certificate `cert_wRAm2yiZA8zhvDsw2doYcDFe` covers both hosts with
`autoRenew: true`. Staging already has its own certificates.

| Host | Observed HTTP/access result | Meaning |
| --- | --- | --- |
| `nextap.services` | HTTPS `404`, `X-Vercel-Error: DEPLOYMENT_NOT_FOUND` | DNS/TLS work; production assignment is pending |
| `admin.nextap.services` | HTTPS `404`, same error | DNS/TLS work; production assignment is pending |
| `staging.nextap.services` | Unauthenticated `302` to Vercel SSO | Deployment Protection |
| `staging.nextap.services` | Authenticated CLI `200`, HTML | Preview is reachable |
| Generated Preview hostname | Earlier unauthenticated check redirected to Vercel login | Protected Preview |
| `www.nextap.services` | Certificate-name validation failure | DNS exists; `www` is absent from inspected Vercel project domains |

If `www` should be supported, add it to the existing Vercel project with a
redirect to `https://nextap.services`, then verify its certificate and redirect.
This is a pending Vercel decision; do not change working apex records to fix it.
It was not performed in this task.

Cloudflare is not authoritative for this domain. Earlier resources using
`nextab.services` are historical context, not current DNS instructions.

## 4. Working provider access and verification commands

Vercel MCP returned team-scope `403`, including its protected-deployment fetch.
The separately authenticated CLI works through `npx.cmd`; bare `vercel` was
not found on PATH. Observed CLI version: `63.1.2`.

Do not ask the owner to authenticate again while CLI access works. If it loses
authentication, run `npx.cmd --yes vercel login` and let the owner complete the
interactive login. Do not request private credentials in chat or reconnect the
already-connected Git repository just to repair authentication.

Read-only checks from the workspace:

```powershell
Resolve-DnsName -Name nextap.services -Type A
Resolve-DnsName -Name admin.nextap.services -Type CNAME
Resolve-DnsName -Name staging.nextap.services -Type CNAME

npx.cmd --yes vercel --scope abdelrahman-867e inspect https://staging.nextap.services

npx.cmd --yes vercel api "/v9/projects/prj_XZKEV6TOqxSy9Hqiw43gZtdz5dZQ/domains?teamId=team_j1AHLbF49M6Ob2sm2QBz7sA5" --method GET

npx.cmd --yes vercel api "/v6/domains/nextap.services/config?teamId=team_j1AHLbF49M6Ob2sm2QBz7sA5&projectIdOrName=prj_XZKEV6TOqxSy9Hqiw43gZtdz5dZQ" --method GET

npx.cmd --yes vercel api "/v6/domains/admin.nextap.services/config?teamId=team_j1AHLbF49M6Ob2sm2QBz7sA5&projectIdOrName=prj_XZKEV6TOqxSy9Hqiw43gZtdz5dZQ" --method GET

npx.cmd --yes vercel api "/v6/domains/staging.nextap.services/config?teamId=team_j1AHLbF49M6Ob2sm2QBz7sA5&projectIdOrName=prj_XZKEV6TOqxSy9Hqiw43gZtdz5dZQ" --method GET
```

Protected homepage check without retaining cookie headers:

```powershell
$stagingHeaders = & npx.cmd --yes vercel curl / --deployment https://staging.nextap.services --scope abdelrahman-867e -- --silent --show-error --head --max-time 20
$stagingHeaders | Where-Object { $_ -match '^(HTTP/|Content-Type:|X-Vercel-Error:)' }
if ($LASTEXITCODE -ne 0) { throw "Protected staging request failed." }
```

`vercel curl` supplies protection bypass for its requests. This does not
authenticate a separate E2E browser or Node `fetch`. Establish protected access
for both. Keep bypass secrets in ignored configuration/provider secret storage.

## 5. Remaining staging configuration

### Supabase Auth

Inspect Staging Auth URL configuration before changing it. The previous MCP
surface did not expose an Auth configuration write; configuration and readback
are pending, not confirmed complete.

Intended hosted Site URL:

```text
https://staging.nextap.services
```

Required callback allowlist:

```text
https://staging.nextap.services/auth/callback
https://nextap-m6quxxab7-abdelrahman-867e.vercel.app/auth/callback
```

Retain explicitly needed local callbacks after inspection. Add exact new
Preview callbacks when required. Do not add Production hosts to Staging Auth.
Configure Production Auth separately.

Verify public signup is disabled according to the owner-only policy and the
staging owner Auth UUID exists in `public.owner_users`. Use a dedicated
authenticated non-owner fixture to test denial.

Current source supports password login, sign-out, and an Auth callback. No
password-reset request or recovery UI was found in the inspected login/Auth
routes. Verify any administrative recovery procedure and its redirect; if
self-service reset is required, implement and test it as a separate staging
improvement. Callback configuration alone does not prove a password-reset
UI journey.

### Hosted Sentry

Current Vercel project environment metadata contains only six Supabase/site
variables. No Sentry variables were present. Runtime capture in source requires
a DSN. Prior empty searches cannot prove hosted monitoring works.

Configure supported Preview variables using existing names:

| Variable | Preview setting |
| --- | --- |
| `SENTRY_DSN` | Server runtime DSN from the connected project |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser runtime DSN |
| `SENTRY_ENVIRONMENT` | `staging` |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `staging` |
| `SENTRY_RELEASE` / `NEXT_PUBLIC_SENTRY_RELEASE` | Consistent tested-commit identifier, if explicitly supplied |
| `SENTRY_ENABLED` | `1`, if explicitly supplied |
| `SENTRY_TEST_ERRORS_ENABLED` | `0` for normal operation |
| `SENTRY_ORG` / `SENTRY_PROJECT` | `abdelrahman-0n` / `nextap`, if explicitly supplied |
| `SENTRY_AUTH_TOKEN` | Optional private build token for source-map upload; never browser-exposed |

Inspect the actual Sentry connection/project first. Rebuild Preview after
environment changes; verify its target and Supabase mapping. Record replacement
deployment ID/URL/commit. Public browser variables must be included in the build.

If controlled diagnostics are used, restrict them to Staging, verify event
receipt/redaction, then disable and rebuild before final acceptance. Production
diagnostics stay disabled. Source-map upload is a separate private build concern.

## 6. Hosted E2E setup

`e2e.config.ts` targets `http://127.0.0.1:3137` and starts local Next.js.
`E2E_SERVER_MODE=production` selects local `next start`; it does not deploy
production or test a hosted URL. No hosted base-URL override exists currently.
Running `npm.cmd run test:e2e` now cannot count as hosted validation.

The next implementation should:

1. Add hosted configuration/mode following existing `e2e` / `@e2e-dev/web`
   patterns and the environment guard.
2. Use the verified hosted URL and omit the local server command.
3. Preserve desktop `1440x960` and mobile `390x844` targets; add smaller
   viewports where stories require them.
4. Establish Vercel protection access in browsers and direct HTTP requests.
   Keep application login separate from Vercel access.
5. Supply isolated credentials and fixtures through ignored configuration.
   Explicitly report missing prerequisites and skipped coverage.
6. Audit local-only assumptions, direct `fetch` calls, fixture paths,
   diagnostics requirements, and hardcoded URLs.
7. Capture pass/fail/skip/unselected counts in dated output. A zero exit
   code can include skips.

Existing test inputs:

```text
E2E_USER_OWNER_USERNAME
E2E_USER_OWNER_PASSWORD
E2E_ALLOW_MUTATIONS=true
E2E_FIXTURE_PATH
AUDIT_FIXTURE_PATH
```

Check existing fixtures before seeding new ones. `npm.cmd run test:e2e:seed`
creates uniquely named synthetic data on approved non-production Supabase and
writes a fixture file. It requires an existing owner Auth account/allowlist
entry; it does not provision them. Clean up only the run's own records.

After implementing `e2e.hosted.config.ts`, this planned command would run hosted
tests. That file does not exist yet; this is not a currently runnable check:

```powershell
npx.cmd e2e run --config e2e.hosted.config.ts --target desktop,mobile --output artifacts/hosted-staging-20261013
```

Start with public smoke checks, then authenticated/mutation journeys. Test the
stable and generated origins, distinguishing callbacks and canonical card URLs.

## 7. Hosted acceptance and evidence

Use [the story catalog](../specs/USER_ADMIN_STORIES.md) as the behavioral
contract. Record deployment, commit, origin, viewport, fixture IDs, test window,
and outcome.

| Group | Required checks | Existing test starting points |
| --- | --- | --- |
| Landing/demo | Navigation, language, RTL/LTR, keyboard use, overflow, mobile actions | `public-journey`, `public-security`, `quick-actions-layout` |
| Auth/access | Login, invalid login, cookie refresh, logout, callback, anonymous and non-owner denial | `auth-refresh`, `owner-cards`, `public-security` plus missing cases |
| Business editor | Create/validation, draft reload, incremental save, reorder, preview/publish, public update, unpublished isolation | `owner-card-journey`, `business-editor-actions`, `editor-reliability`, `phase5-incremental-saves`, `admin-reordering` |
| Slugs/publications | Old-slug alias, changed slug, latest snapshot, missing-slug recovery | Owner journeys plus targeted assertions |
| Cards | State changes, reassignment without changing token, batches, QR/manufacturing URLs | `card-state`, `owner-card-journey`, `card-manufacturing` |
| Redirect contract | `/c/:token`: zero-body `302`, `Cache-Control: no-store, max-age=0`, `Referrer-Policy: no-referrer`, correct destination | Direct protected HTTP assertions |
| Media | Upload/validation, hosted Storage/image access, replacement/removal, mobile rendering | `media-upload`, `media-rendering` |
| External actions | Payment guidance/copy fallback, social/call/WhatsApp/maps/reviews, quick actions | `public-security`, `quick-actions-layout`, synthetic published fixtures |
| Monitoring | Console/network, runtime errors, Sentry receipt/redaction/environment/release | `observability-baseline`, `sentry-observability`, provider logs |

Record simulated mobile and physical-device results separately. A mobile
viewport cannot prove an NFC tap or installed payment-app behavior.

### Phase 6 publication path

Earlier Staging inspection confirmed the pointer/snapshot functions and grants.
Hosted use remains unproven. Load a synthetic published `/b/<slug>` and correlate
server-side evidence with `get_publication_pointer` and
`get_publication_snapshot` calls. Browser requests alone cannot show server
RPCs; cached reads need not invoke the snapshot RPC every time.

Use provider logs or temporary redacted instrumentation to distinguish this
path from the five-second compatibility fallback. RPC existence, direct SQL
success, or no Sentry errors is insufficient. Remove diagnostics and validate
the resulting deployment before closing the gate.

### Evidence handling

Store generated reports/screenshots under ignored `artifacts/` or `.e2e/`.
Link a sanitized summary with actual counts and remaining skips. Review Vercel
runtime logs and Sentry for the exact deployment/test window; inspect Supabase
errors where relevant. Distinguish controlled diagnostic events from failures.
Exclude credentials, cookies, Auth codes, card tokens, and customer data.

## 8. Prior checks and current limitations

The previous handoff reported successful local/CI checks; they were not rerun
for this documentation change:

- Typecheck and Next.js production build.
- Lint: zero errors, 11 existing warnings.
- Unit tests: 18 files, 101 tests.
- Database migration/SQL contracts on disposable PostgreSQL.
- Local desktop/mobile journeys and regression checks.
- GitHub `quality` after forwarding `CI=true` to the E2E app process.
- `git diff --check`.

Current CI builds with placeholder Supabase settings and runs public smoke
checks; it does not prove authenticated hosted journeys. Re-inspect checks for
the final release commit.

Earlier Staging evidence reported 21 remote history entries, all 11 application
tables with RLS, pointer/snapshot grants, anonymous denial for `assign_card`,
restricted `rls_auto_enable`, and corrected alias-table grants. See
[schema reconciliation](STAGING_SCHEMA_RECONCILIATION_HANDOFF.md).
Historical local/remote timestamps differ; do not blindly run `supabase db push`
or force history equality.

Earlier advisors reported authenticated security-definer `create_card_batch`
access, disabled leaked-password protection, and six unused-index informational
findings. Recheck before release and record decisions. Low Staging traffic
alone is not evidence to remove indexes.

Empty historical Sentry searches do not prove hosted capture, especially with
the absent Vercel DSNs.

Production schema, Auth/owner setup, Storage, backups, plan suitability,
rate limits, and monitoring were not revalidated in this continuation. An
older setup handoff recorded only 11 Production migrations; source contains
later changes. Inspect parity and prepare reviewed migrations before release.

## 9. Production preparation and activation

After hosted Staging passes:

1. Identify the tested SHA. `beta01` is explicitly excluded as the release
   source even though Vercel currently points there.
2. Inspect current CI/PR checks and integrate accepted work into
   `integration/preprod`. Create the agreed final release branch from that
   validated source; `main` is the recommendation and does not yet exist.
   Prepare a separate release worktree if useful, then align Vercel's
   Production Branch during the reviewed release process. A preproduction
   merge is distinct from production activation.
3. Inspect Production schema/history and prepare missing forward-compatible
   migrations, grants, RPCs, and Storage configuration. Preserve data/history.
   Establish backup/restore readiness before risky database work. Use Supabase
   and Postgres skills before database changes.
4. Configure Production Auth Site URL, exact callbacks, disabled public signup,
   owner Auth account, and owner allowlist. Include the admin-origin callback
   if login will occur there.
5. Confirm Production maps to `jezpobjlfvihikplxrta` and
   `https://nextap.services`. Configure Production Sentry separately.
6. Verify QR/NFC URLs use production origin; do not manufacture customer cards
   from staging exports.
7. Record monitoring, abuse/rate-limit controls, current provider plan
   suitability, backups, restore procedure, and launch smoke checks.
8. Prepare exact commit, checks, migration plan, domain assignments, and
   rollback as reviewable work before requesting first public-launch
   authorization.

Build validated source with Production settings. The current Preview artifact
was built against Staging; do not assign it directly to main/admin as a shortcut.

After launch authorization, execute the reviewed migration/build plan, inspect
`target: production`, and verify production alias assignment. Acceptance needs:

- Main/admin landing and intended hostname behavior.
- Owner login/logout and anonymous admin/API denial.
- Synthetic approved public page and hosted media.
- Card redirect contract and production QR/NFC origin.
- `www` redirect/certificate if that host is enabled.
- Production Sentry/runtime monitoring for the release.

Keep regression mutations on Staging; production gets small controlled smoke
checks with approved fixtures.

### Rollback

Record the last known-good production deployment before future releases and
prefer switching application traffic back while keeping compatible forward
migrations. First launch may have no prior production app; record how to
withdraw its deployment/aliases rather than promising a nonexistent rollback.

Application rollback does not undo database writes, Auth settings, or Storage
uploads. Check schema compatibility before switching versions. Data restore
requires a reviewed recovery procedure; DNS changes are not routine app rollback.

## 10. Ongoing improvements and staging workflow

Yes: `staging.nextap.services` is the hosted place to validate improvements
before exposing them to customers. Develop code on a feature/fix branch,
check locally, deploy Preview with Staging settings, validate hosted behavior,
then release validated source with Production settings.

The subdomain selects a deployment. Code changes happen in the repository.
Database isolation comes from separate environment variables, Supabase,
Auth/Storage settings, and test credentials, not the subdomain alone.

Recommended sequence:

1. Implement a feature/fix on its branch.
2. Run relevant local tests and build.
3. Deploy Preview with non-production settings.
4. Review a branch's generated URL or update stable Staging for shared acceptance.
5. Test desktop/mobile, access controls, migrations, and monitoring with
   synthetic data.
6. Merge/release through the agreed branch process.
7. Build with Production settings, smoke-test, and monitor.

The stable hostname currently follows `chore/hosted-staging-validation`.
For an enduring workflow, select a branch such as `staging` or
`integration/preprod`, place validated source there, verify its Preview, and
then update the hostname binding. This is a future choice, not an applied change.

Generated Preview URLs currently share Staging Supabase. Coordinate mutations,
use unique fixtures, and arrange separate databases/branches if simultaneous
work needs stronger isolation.

## 11. Next agent instructions

1. Read `AGENTS.md`, architecture, documentation index, and this handoff.
2. Inspect the worktree. Preserve the pre-existing `next-env.d.ts` change.
   Documentation edits are intentionally uncommitted unless later committed.
3. Reuse known Vercel scope and authenticated CLI; inspect state before changes.
   Treat its `beta01` Production Branch as legacy configuration, not the
   authorized release source. Use the branch/worktree inventory in section 2.
4. Finish Staging Auth, hosted monitoring, and hosted E2E setup.
5. Run public/authenticated/mutation/Phase 6 journeys; fix failures and capture
   sanitized evidence.
6. Record actual pass/fail/skip counts and final deployment IDs here.
   Recommend the preproduction merge only after acceptance.
7. Prepare a reviewable production release. Request first public-launch
   authorization only after preparation and explain the remaining action.

The owner authorizes autonomous continuation and will complete interactive
login when needed. Use working access before requesting help. Do not ask them
to repeat completed Hostinger DNS changes.

## References

- [Repository architecture](../ARCHITECTURE.md).
- [User/admin stories](../specs/USER_ADMIN_STORIES.md).
- [Staging schema reconciliation](STAGING_SCHEMA_RECONCILIATION_HANDOFF.md).
- [Launch architecture handoff](LAUNCH_ARCHITECTURE_HANDOFF.md).
- [Original hosted task, historical constraints](Hosted_staging_deployment_validation.md).
- [Supabase Auth redirects](https://supabase.com/docs/guides/auth/redirect-urls).
- [Vercel deployment environments](https://vercel.com/docs/deployments/environments).
- [Vercel protection bypass](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).

Provider docs informed Auth/deployment guidance. The local e2e skill and
repository configuration informed runner commands and test prerequisites.
