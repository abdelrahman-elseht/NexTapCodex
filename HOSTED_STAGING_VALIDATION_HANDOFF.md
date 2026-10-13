# NexTap Hosted Staging Validation Handoff

Date: 2026-10-13
Branch: `chore/hosted-staging-validation`
Base: `chore/staging-schema-reconciliation`
Origin correction commit: `814b589` (`fix: use nextap services domain`)
Draft PR: https://github.com/abdelrahman-elseht/NexTapCodex/pull/1

Detailed current runbook:
[Staging validation and production release handoff](docs/handovers/STAGING_VALIDATION_AND_PRODUCTION_RELEASE_HANDOFF.md).
It includes the latest verified state, hosted test prerequisites, production
preparation, rollback, and the ongoing improvement workflow.

## Current result

The repository, Staging database, CI checks, and a hosted Vercel Preview are
ready for validation. Preview deployment
`dpl_CCGxHYZ9hGgeRZRz9cSfNPQo7W3r` is `READY` from commit `814b589` on
`chore/hosted-staging-validation`; Vercel inspection confirms
`target: preview`. Its URL is
`https://nextap-m6quxxab7-abdelrahman-867e.vercel.app`. The homepage responds
through the authenticated Vercel CLI with HTTP `200`. The custom staging
domain is now bound to `chore/hosted-staging-validation`; Vercel inspection of
the hostname resolves to this same Ready Preview deployment.

The earlier accidental Production-target deployment remains canceled. No
Production deployment was promoted, and Production Supabase credentials/data
were not changed. Vercel's Production `NEXT_PUBLIC_SITE_URL` now correctly
reads `https://nextap.services`; this setting will take effect on a future
Production build, but no such build was made. The misspelled `nextab.services`
and `admin.nextab.services` project-domain bindings were removed and replaced
with the intended `nextap.services` and `admin.nextap.services`.

The apex, admin, and staging domains are attached, Vercel-verified, and
correctly configured in Hostinger DNS. HTTPS certificates exist for all three.
Main/admin currently return `404 DEPLOYMENT_NOT_FOUND` because production
application assignment is pending. Staging's unauthenticated Vercel-login
redirect is Deployment Protection.

The GitHub quality check initially failed because the e2e app process dropped
GitHub Actions' `CI=true` while using the safe placeholder Supabase URL. The
one-line fix in `e2e.config.ts` was pushed and the rerun passed. These are
historical results; current PR checks were not re-inspected during the
documentation update.

## Vercel configuration

Project: `abdelrahman-867e/nextap`
Project ID: `prj_XZKEV6TOqxSy9Hqiw43gZtdz5dZQ`
Team: `abdelrahman-867e` (`team_j1AHLbF49M6Ob2sm2QBz7sA5`)
Connected repository: `abdelrahman-elseht/NexTapCodex`
Production branch currently configured in Vercel: `beta01`. The owner confirmed
this is not the intended release branch; do not push release work there.
`integration/preprod` is the existing consolidation target, 14 commits behind
the current validation candidate. A final production branch has not been
established; `main` is recommended after validation and does not currently exist.
Only this checkout is registered as a worktree. The historical production-setup
folder is missing. See the detailed runbook's branch/worktree inventory.

Preview variables are project-wide and point only to Staging:

| Name | Preview value/state |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://flkakuysakgwfoemgbwn.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | encrypted Preview value; secret omitted |
| `NEXT_PUBLIC_SITE_URL` | `https://staging.nextap.services` |

Production variables remain mapped to the separate Production Supabase
project. Only the Production `NEXT_PUBLIC_SITE_URL` was corrected to
`https://nextap.services`; the Production Supabase URL and key were not
changed or decrypted.

Vercel project domains now contain `nextap.services`,
`admin.nextap.services`, and `staging.nextap.services`. The staging hostname
is explicitly bound to `chore/hosted-staging-validation`.

The authenticated CLI works through `npx.cmd`; no reauthentication is currently
needed. If it loses authentication:

```powershell
npx.cmd --yes vercel login
```

The Vercel MCP session returns `403` for this team, but the local CLI can
inspect the project and access its protected deployment. The repository is
already connected; do not reconnect Git merely to fix authentication.

## Hostinger DNS

Hostinger owns the DNS. The configured and verified apex/admin/staging records
are:

| Type | Name | Target |
| --- | --- | --- |
| A | `@` | `216.198.79.1` |
| A | `@` | `64.29.17.1` |
| CNAME | `admin` | `2d714148d09163d5.vercel-dns-017.com.` |
| CNAME | `staging` | `2d714148d09163d5.vercel-dns-017.com.` |

Public DNS returns both apex IPs and both subdomain CNAMEs. Vercel reports no
conflicts and `misconfigured: false` for all three. The missing apex/admin
certificate was issued successfully as `cert_wRAm2yiZA8zhvDsw2doYcDFe`.
No further Hostinger changes are needed for these hosts.

Read-only verification from PowerShell:

```powershell
Resolve-DnsName nextap.services -Type A
Resolve-DnsName admin.nextap.services -Type CNAME
Resolve-DnsName staging.nextap.services -Type CNAME
npx.cmd --yes vercel api "/v9/projects/prj_XZKEV6TOqxSy9Hqiw43gZtdz5dZQ/domains?teamId=team_j1AHLbF49M6Ob2sm2QBz7sA5" --method GET
```

Cloudflare is not authoritative for `nextap.services`; no nameserver or
Cloudflare change is required. The old downloaded zone export is stale.
`www` has a CNAME to the apex but is not attached in Vercel and fails certificate
validation; configuring its optional canonical redirect is a separate task.

## Supabase Staging

Project ref: `flkakuysakgwfoemgbwn` (`NexTabCodex`, `eu-west-1`).
Earlier inspection reported `ACTIVE_HEALTHY` and 21 migration-history entries,
including Phase 6 publication cache and ACL reconciliation. Read-only SQL
previously verified:

- `public.get_publication_pointer(text)` exists and is executable by `anon`
  and `authenticated`.
- `public.get_publication_snapshot(uuid)` exists and is executable by `anon`
  and `authenticated`.
- Both public functions delegate to the private readers.
- `assign_card` is not executable by `anon` and is executable by
  `authenticated`.
- `rls_auto_enable` is not executable by either role.

Supabase Auth URL configuration was not writable through the previously
available MCP surface. Inspect current settings and use the staging Site URL
`https://staging.nextap.services` with these callback entries:

```text
https://staging.nextap.services/auth/callback
https://nextap-m6quxxab7-abdelrahman-867e.vercel.app/auth/callback
```

Keep public signup disabled and verify password login, logout, callback, and
session refresh stay on Staging. No password-reset UI was found in the inspected
login/Auth routes; verify the administrative recovery procedure or implement
self-service recovery separately if required. Do not add Production URLs to
the Staging allowlist.

Previously inspected Staging security advisors reported two warnings: the intentional
authenticated access to `create_card_batch` and leaked-password protection is
disabled. Performance advisors reported six unused-index informational findings.
Recheck these before release. No advisor change was made in this task.

## Verification

Previously reported passes locally or in CI, not rerun for this documentation
update:

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

The Vercel Preview is ready and DNS/HTTPS verification is complete, but full
hosted desktop/mobile E2E and Auth redirects remain pending. The existing
E2E config starts a local server; a hosted mode/config is needed. The current
Vercel environment metadata contains no Sentry variables, so empty historical
Sentry searches do not prove hosted monitoring.

Login/session refresh, Draft -> Preview -> Publish, public updates, aliases,
card mutation, redirect headers, hosted media, external actions, and hosted
pointer/snapshot use remain unverified.

## Required next actions

1. Finish Staging Auth inspection/configuration and hosted Sentry setup.
2. Implement hosted E2E configuration with protected browser and HTTP access.
3. Run desktop/mobile journeys against the generated Preview and stable staging
   origin with synthetic fixtures; capture actual pass/fail/skip counts.
4. Record console/network, runtime/Sentry, and Phase 6 evidence.
5. After Staging acceptance, prepare Production schema/Auth/Storage/environment
   parity, a fresh build from validated source, and rollback.

## Merge recommendation

Do not merge the draft PR into `integration/preprod` yet. Merge only after a
Git-connected Vercel Preview deployment is Ready, the Hostinger DNS record and
Staging Auth redirects are verified, and the complete hosted validation passes.
Production release is a separate stage requiring concrete preparation and
first-launch authorization. Do not assign the Staging-built Preview artifact
to production hosts. See the detailed runbook before continuing.
