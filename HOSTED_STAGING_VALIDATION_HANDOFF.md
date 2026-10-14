# NexTap release handoff

Updated: 2026-10-14 (Africa/Cairo)
Repository: `F:\projects\NexTabCodex-integration-preprod`
Release flow: `feature/* → staging → main → Production`

This is the current operational handoff. Values that are credentials or keys
are intentionally omitted.

## Completed release actions

- Read `AGENTS.md`, `docs/ARCHITECTURE.md`, and `docs/README.md` before acting.
- Hosted Staging acceptance passed on source commit
  `645768a32aae61a32578a886acc6569c2e7f26ef`.
- Merged PR #1 into protected `staging` with merge SHA
  `87e60eb6d97e93e0bf7a7a7c2304099c2305b66f`.
- Advanced protected remote `staging` and created remote `main` from that same
  accepted SHA. GitHub default branch is `main`.
- Verified `main` protection: required `quality`, one approval, last-push
  approval, strict status checks, administrator enforcement, linear history,
  conversation resolution, and no force pushes or deletions.
- Bound `staging.nextap.services` to the protected `staging` branch. The domain
  is Vercel-verified and currently resolves to a Ready Preview deployment.
- Configured the GitHub `Production` Environment with the single available
  account as required reviewer, protected-branch deployment policy, and admin
  bypass disabled.
- Applied the nine migrations missing from the empty Production project through
  Supabase MCP. Production now has 20 migration-history entries and all 11
  application tables remain empty with RLS enabled.
- Configured Vercel Production Sentry variables without exposing values:
  server/browser DSNs, `SENTRY_ENVIRONMENT=production`,
  `NEXT_PUBLIC_SENTRY_ENVIRONMENT=production`, and
  `SENTRY_TEST_ERRORS_ENABLED=0`.
- Added and verified `www.nextap.services` as a Vercel project domain with a
  permanent `308` redirect to `nextap.services`.

## Current provider state

### GitHub

Repository: `abdelrahman-elseht/NexTapCodex`.

| Item | State |
| --- | --- |
| PR #1 | Merged into `staging`; merge SHA `87e60eb6d97e93e0bf7a7a7c2304099c2305b66f` |
| `staging` | Same accepted SHA |
| `main` | Same accepted SHA; default branch |
| Production Environment | Required review by `abdelrahman-elseht`; admin bypass disabled |
| Branch protection | `quality` required; one approval; last-push approval; strict; linear; conversation resolution; no force push/delete |

There is one GitHub account. The required-reviewer rule is therefore a
single-account approval gate; it is not a second-person review.

### Vercel

Project `abdelrahman-867e/nextap`, ID `prj_XZKEV6TOqxSy9Hqiw43gZtdz5dZQ`.

| Item | State |
| --- | --- |
| Connected repository | `abdelrahman-elseht/NexTapCodex` |
| Production Branch | **Still `beta01`**; this is the remaining release blocker |
| Staging domain | `staging.nextap.services` → Git branch `staging`, verified |
| Apex/admin | `nextap.services` and `admin.nextap.services`, verified |
| `www` | Verified project domain, `308` redirect to `nextap.services` |
| Production environment | Dedicated Production Supabase values already present; Sentry production values now present |
| Production deployment | Not created yet; changing Production Branch to `main` must happen first |

The authenticated CLI works with `npx.cmd --yes vercel`. Vercel MCP returns a
team-scope `403`, so the CLI is the fallback. The CLI's public project/link
endpoints do not expose a working Production Branch mutation; use the Vercel
dashboard Git settings after signing in.

### Supabase

| Environment | Project | State |
| --- | --- | --- |
| Staging | `flkakuysakgwfoemgbwn` | `ACTIVE_HEALTHY`, 21 migrations, hosted acceptance data isolated to Staging |
| Production | `jezpobjlfvihikplxrta` | `ACTIVE_HEALTHY`, 20 migrations after release migration application, all application tables empty |

Production read-only SQL confirmed the publication pointer/snapshot functions
and both draft-save RPC signatures. Security advisors report the intentional
authenticated `create_card_batch` SECURITY DEFINER warning. Performance advisors
report 22 currently unused-index informational findings; no indexes were
removed. Production Auth URL/redirect settings and the first real owner account
still require the Supabase dashboard because the available MCP surface does not
expose Auth configuration writes.

Never link or mutate Production from a local shell. If a future Staging
migration is needed, first run:

```powershell
npx.cmd --yes supabase link --project-ref flkakuysakgwfoemgbwn
```

Stop and ask the operator to enter the database password if the CLI requests
one.

### Sentry

Sentry organization/project identifiers are `abdelrahman-0n` / `nextap`.
Preview read-only searches found no Staging errors or warning logs and did find
Staging traces. The hosted diagnostic journeys were intentionally skipped.
Production DSN and environment variables are configured in Vercel; no
Production deployment has run yet.

### Hosted E2E

Authoritative GitHub run: [38476685140](https://github.com/abdelrahman-elseht/NexTapCodex/actions/runs/38476685140).

- 66 checks selected; 64 executed; 63 passed; 0 failed; 2 controlled Sentry
  diagnostic cases skipped; 0 unselected.
- One desktop `media-upload` first attempt was retried successfully and is
  recorded as flaky. Zero flaky results were not made a release gate.
- The run verified the Ready deployment and the isolated Staging Supabase
  project before and after the journeys.

## Exact verification commands and results

```powershell
git ls-remote --heads origin staging main
# staging and main both: 87e60eb6d97e93e0bf7a7a7c2304099c2305b66f

npx.cmd --yes gh-axi api /repos/abdelrahman-elseht/NexTapCodex/pulls/1
# state=closed, merged=true, base=staging, merge_commit_sha=87e60eb6...

npx.cmd --yes gh-axi api /repos/abdelrahman-elseht/NexTapCodex/branches/main/protection
# quality required; one approval; strict; admin enforcement; linear history;
# conversation resolution; force pushes/deletions disabled

npx.cmd --yes vercel api /v9/projects/prj_XZKEV6TOqxSy9Hqiw43gZtdz5dZQ
# link.productionBranch=beta01 (must be changed to main in the dashboard)

npx.cmd --yes vercel api /v9/projects/prj_XZKEV6TOqxSy9Hqiw43gZtdz5dZQ/domains
# staging branch=staging; www redirect=nextap.services, status=308; all verified

npx.cmd --yes vercel env list production --scope abdelrahman-867e
# Production Supabase variables, Sentry DSNs, production Sentry environments,
# and SENTRY_TEST_ERRORS_ENABLED are present; values were not printed
```

The accepted hosted suite and prior local quality/build/unit/database checks
were not rerun because no application source changed after acceptance.

## Remaining blockers and exact user actions

1. **Vercel Production Branch.** Sign in to Vercel, open
   `abdelrahman-867e/nextap` → Settings → Git, set **Production Branch** to
   `main`, and save. Reply when complete so the resulting Ready Production
   deployment can be verified.
2. **Production Supabase Auth.** In the Production Supabase project, set Site
   URL to `https://nextap.services`, add
   `https://nextap.services/auth/callback` to the redirect allowlist, keep
   public signup disabled, and create/confirm the real owner account. Add only
   that account's UUID to `public.owner_users` using the reviewed dashboard or
   SQL Editor path. Do not add Staging URLs to Production.
3. **Production deployment approval.** Once `main` is selected and a deployment
   is created, approve the pending GitHub `Production` environment deployment
   from the same account, then report the deployment run/URL.
4. **Production smoke test.** After approval, run the public homepage, login,
   owner mutation, logout/session-refresh, published page, and `www` redirect
   checks against `https://nextap.services`. Keep fixture data isolated and
   remove only the run's own records.

## Continuation prompt

```text
Continue F:\projects\NexTabCodex-integration-preprod from this handoff.
Read AGENTS.md, docs/ARCHITECTURE.md, docs/README.md, and this file first.

Release flow is feature/* -> staging -> main -> Production. PR #1 is merged;
staging and main both point to 87e60eb6d97e93e0bf7a7a7c2304099c2305b66f and
main is the GitHub default branch. beta01 is legacy and must remain unused.

Hosted acceptance run 38476685140 passed 63/63 executed checks with two
controlled Sentry diagnostic skips and one successful media-upload retry. Do
not repeat passed suites unless source or provider state changes.

Production Supabase is jezpobjlfvihikplxrta, isolated and empty; its reviewed
source migrations are applied through Supabase MCP. Production Vercel values
are configured without printing secrets, including Sentry production values.
www.nextap.services is verified and permanently redirects to nextap.services.

The remaining gates are: set Vercel Production Branch to main in the dashboard;
configure Production Auth Site URL/redirect and create the real owner; approve
the protected Production environment deployment; verify the Ready deployment;
run controlled Production smoke checks; and record the final deployment ID.

Never print secrets. Never link or mutate Production Supabase from a local
shell. Before any future Staging migration, run:
npx.cmd --yes supabase link --project-ref flkakuysakgwfoemgbwn
and stop if a database password is requested.
```
