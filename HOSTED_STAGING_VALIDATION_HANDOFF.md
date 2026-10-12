# NexTap Hosted Staging Validation Handoff

Date: 2026-10-13
Branch: `chore/hosted-staging-validation`
Base: `chore/staging-schema-reconciliation`
Latest commit: `6f7ea7c` (`fix: preserve CI flag for e2e app process`)
Draft PR: https://github.com/abdelrahman-elseht/NexTapCodex/pull/1

## Current result

The repository, Staging database, and CI checks are ready for hosted
validation. The hosted gate is still blocked because Vercel classifies both
Git-triggered and direct `--target preview` deployments as `production` in the
existing `nextap` project. Each accidental deployment was removed immediately;
there are currently zero Vercel deployments and zero aliases. No Production
domain or Production Supabase data was changed.

The GitHub quality check initially failed because the e2e app process dropped
GitHub Actions' `CI=true` while using the safe placeholder Supabase URL. The
one-line fix in `e2e.config.ts` was pushed and the rerun passed. The remaining
failed GitHub check is Vercel because its only deployment was removed for the
staging safety gate.

## Vercel configuration

Project: `abdelrahman-867e/nextap`
Project ID: `prj_XZKEV6TOqxSy9Hqiw43gZtdz5dZQ`
Team: `abdelrahman-867e` (`team_j1AHLbF49M6Ob2sm2QBz7sA5`)
Connected repository: `abdelrahman-elseht/NexTapCodex`
Production branch reported by Vercel: `beta01` (the checklist expected
`main`; this was not changed because changing the Production branch is outside
the staging-only gate).

Preview variables are project-wide and point only to Staging:

| Name | Preview value/state |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://flkakuysakgwfoemgbwn.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | encrypted Preview value; secret omitted |
| `NEXT_PUBLIC_SITE_URL` | `https://staging.nextab.services` |

Production variables remain mapped to the separate Production Supabase project
and `https://nextab.services`; no Production value was read or changed.

The exact command to re-authenticate/connect Vercel if the local CLI loses the
team grant is:

```powershell
npx.cmd --yes vercel login
npx.cmd --yes vercel git connect https://github.com/abdelrahman-elseht/NexTapCodex.git --scope abdelrahman-867e --project nextap --yes
```

The Vercel MCP session currently returns `403` for this team. The local CLI is
authenticated as `elsehtabdelrahman-6674` and can inspect the project.

## Hostinger DNS

Hostinger owns the DNS. Add exactly one record in Hostinger DNS:

| Type | Name | Target | TTL |
| --- | --- | --- | --- |
| CNAME | `staging` | `2d714148d09163d5.vercel-dns-017.com.` | default |

This creates `staging.nextab.services`. Leave proxying disabled if Hostinger
offers a proxy toggle. Do not change nameservers, the apex `@` record,
`nextab.services`, `admin.nextab.services`, mail records, or any other
Production record. Vercel's suggested apex A records are intentionally not
being applied.

After saving the record, verify from PowerShell:

```powershell
Resolve-DnsName staging.nextab.services -Type CNAME
npx.cmd --yes vercel domains verify staging.nextab.services --scope abdelrahman-867e
```

Before the record is added, Chrome DevTools and PowerShell both report
`ERR_NAME_NOT_RESOLVED` for the staging hostname. Cloudflare has no active
`nextab.services` zone, so no Cloudflare authorization or change is required.

## Supabase Staging

Project ref: `flkakuysakgwfoemgbwn` (`NexTabCodex`, `eu-west-1`,
`ACTIVE_HEALTHY`). All 21 migrations are present, including the Phase 6
publication cache and ACL reconciliation migrations. Read-only SQL verified:

- `public.get_publication_pointer(text)` exists and is executable by `anon`
  and `authenticated`.
- `public.get_publication_snapshot(uuid)` exists and is executable by `anon`
  and `authenticated`.
- Both public functions delegate to the private readers.
- `assign_card` is not executable by `anon` and is executable by
  `authenticated`.
- `rls_auto_enable` is not executable by either role.

Supabase Auth URL configuration was not writable through the available MCP
surface. In the Staging Auth dashboard, add the callback URL for the final
Preview origin and keep the staging callback:

```text
https://staging.nextab.services/auth/callback
https://<generated-preview-hostname>/auth/callback
```

Keep public signup disabled and verify password login, logout, callback, session
refresh, and password reset stay on the Staging origin. Do not add Production
URLs to the Staging allowlist.

The current Staging security advisors report two warnings: the intentional
authenticated access to `create_card_batch` and leaked-password protection is
disabled. Performance advisors report six unused-index informational findings.
No advisor change was made in this deployment-validation task.

## Verification

Passed locally or in CI:

- `npm.cmd run typecheck`
- `npm.cmd run lint` (0 errors, 11 existing warnings)
- `npm.cmd test` (18 files, 101 tests)
- `npm.cmd run test:db` (migration and SQL contracts)
- `npm.cmd run build`
- `git diff --check`
- targeted local desktop/mobile e2e and the full local regression suite
- GitHub Actions quality check after the CI environment fix
- Supabase Staging project, migrations, advisors, and Phase 6 read-only checks
- Sentry searches for Staging errors, logs, and traces in the last 24 hours: no
  results

Hosted desktop/mobile e2e cannot start until a deployment whose Vercel target
is `preview` exists. The public staging hostname currently has no DNS answer,
so login/session refresh, Draft -> Preview -> Publish, public updates, aliases,
card mutation, redirect headers, hosted media, and payment/social/quick-action
destinations remain unverified on Vercel.

## Required next actions

1. Add the single Hostinger `staging` CNAME record above.
2. Re-authenticate the Vercel CLI or Vercel MCP for team `abdelrahman-867e` if
   prompted, then obtain a Git-connected deployment whose API metadata says
   `target: preview` before opening it in a browser.
3. Add that generated Preview callback URL to Staging Supabase Auth.
4. Run the complete hosted desktop and mobile e2e suite against the generated
   Preview URL and `https://staging.nextab.services` after DNS resolves.
5. Capture Chrome console/network output, Vercel runtime logs, Sentry results,
   and Phase 6 pointer/snapshot evidence in this handoff.

## Merge recommendation

Do not merge the draft PR into `integration/preprod` yet. Merge only after a
Git-connected Vercel Preview deployment is Ready, the Hostinger DNS record and
Staging Auth redirects are verified, and the complete hosted validation passes.
Do not merge into `main`, change the Vercel Production branch, activate
Production domains, or run `vercel --prod` as part of this gate.
