# NexTap Hosted Staging Validation Handoff

Date: 2026-10-13
Branch: `chore/hosted-staging-validation`
Base: `chore/staging-schema-reconciliation`
Validation commit: `b83f376` (`chore: prepare hosted preview upload`)

## Result

The repository and Staging database are ready for hosted validation. The
hosted deployment gate is still blocked: the existing Vercel `nextap` project
has no Git repository connection, and its local-source CLI deployments were
classified as Production even when `--target=preview` was supplied. Both test
deployments were removed immediately. The project now has zero deployments and
zero aliases, and no Production domain is active.

The first CLI attempt also auto-attached `nextab.services` to its temporary
Production-classified deployment. That alias and deployment were removed before
any hosted validation or customer-data request; the final Vercel state was
verified afterward.

No Production Supabase data, DNS traffic, or customer data was modified.

## Environment mapping

The existing Vercel project is `abdelrahman-867e/nextap`
(`prj_XZKEV6TOqxSy9Hqiw43gZtdz5dZQ`). The current Preview variables are:

| Name | Preview value/state |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://flkakuysakgwfoemgbwn.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | configured as an encrypted Preview value; secret omitted |
| `NEXT_PUBLIC_SITE_URL` | `https://staging.nextab.services` |

Production variables remain mapped to the separate Production Supabase ref and
`https://nextab.services`; no Production value was read or changed.

The Preview values are currently project-wide Preview values, not branch-scoped
values, because branch-scoped variables require a connected Git repository.

## Supabase Staging

Project: `flkakuysakgwfoemgbwn` (`NexTabCodex`, `eu-west-1`,
`ACTIVE_HEALTHY`). The 21 migration entries are present. Read-only SQL verified:

- `public.get_publication_pointer(text)` exists and is executable by `anon` and
  `authenticated`.
- `public.get_publication_snapshot(uuid)` exists and is executable by `anon`
  and `authenticated`.
- Both public functions delegate to their `private.*` readers.
- `assign_card` is not executable by `anon` and is executable by
  `authenticated`.
- `rls_auto_enable` is not executable by either role.

This is concrete Phase 6 evidence that the hosted application can use the
pointer/snapshot path once a deployment exists. No temporary application
diagnostic was added.

Supabase Auth redirect configuration was not changed or verified through the
available MCP surface. It must be checked after the Preview URL is generated.

## Domain and DNS

The domain is registered with Hostinger. Cloudflare inspection found no active
`nextab.services` zone, so Cloudflare authorization or DNS changes are not
required for this setup.

Vercel has a third-party `nextab.services` project domain and an existing
`staging.nextab.services` binding recorded for the `staging` branch. The
staging hostname currently has no DNS record at Hostinger: Chrome DevTools
reported `ERR_NAME_NOT_RESOLVED`, and PowerShell DNS resolution returned no
answer. No nameserver, Hostinger record, Vercel domain, or Production alias was
changed.

## Verification results

Passed locally:

- `npm.cmd run typecheck`
- `npm.cmd run lint` (0 errors, 11 existing warnings)
- `npm.cmd test` (18 files, 101 tests)
- `npm.cmd run test:db` (20 migrations and SQL contracts)
- `npm.cmd run build`
- `git diff --check`
- targeted desktop/mobile e2e: media rendering and observability baseline,
  4 files and 8 tests passed
- full local desktop/mobile e2e: 32 tests passed; fixture-dependent tests were
  then rerun with the synthetic Staging fixture and passed 8/8

The full hosted journeys were not run because no safe Preview deployment is
available. Therefore login/session refresh, Draft -> Preview -> Publish,
public update, alias resolution, card mutation, redirect headers, hosted media,
and payment/social/quick-action destinations remain unverified on Vercel.

Sentry read-only searches for the `nextap` project returned no staging errors,
traces, logs, or unresolved issues in the last 24 hours. This is expected while
the hosted app has no deployment.

## Remaining blockers

1. Authorize Vercel's GitHub App for `abdelrahman-elseht/NexTapCodex` in the
   `abdelrahman-867e` team, then connect the repository to the existing
   `nextap` project.
2. Add the Hostinger DNS-only record for `staging.nextab.services` targeting
   the Vercel-provided staging target. Do not change nameservers or Production
   records.
3. Add the generated Preview URL to Supabase Staging Auth redirect allowlists.
4. Trigger a Git-connected Preview deployment for
   `chore/hosted-staging-validation`, verify its environment is Preview, and
   run the complete hosted validation before any merge recommendation.

## Exact authorization command

Vercel CLI authentication is already available. After accepting the GitHub App
installation/organization access in the Vercel dashboard, run:

```powershell
npx.cmd --yes vercel git connect https://github.com/abdelrahman-elseht/NexTapCodex.git --scope abdelrahman-867e --project nextap --yes
```

The initial device login command, if needed on another machine, is:

```powershell
npx.cmd --yes vercel login
```

No Cloudflare or Supabase credential command is needed for the current blockers.
GitHub CLI is already authenticated with `repo` scope; the missing permission
is the Vercel GitHub App connection, not GitHub CLI authentication.

## Merge recommendation

Do not merge into `integration/preprod` yet. Merge this branch only after a
Git-connected Preview deployment is Ready, Hostinger DNS and Staging Auth
redirects are verified, and the complete hosted desktop/mobile validation
passes against the generated Preview URL. Do not merge into `main`, activate
Production, or attach `nextab.services` to a deployment as part of this gate.
