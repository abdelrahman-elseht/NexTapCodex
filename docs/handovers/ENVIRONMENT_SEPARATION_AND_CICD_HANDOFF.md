# NexTap environment separation and CI/CD handoff

Updated: October 13, 2026.

Current provider state (October 14, 2026) supersedes the dated **Starting
state** below: PR #1 is merged, protected `main` is the GitHub default branch
and Vercel Production Branch, and its accepted release SHA is
`856bbd42d59fb3c6f92a6ad5eacd7f12c4923f31`. Protected `staging` has since
advanced with documentation-only commits. `staging.nextap.services` follows
protected `staging`; Production migrations are applied through Supabase MCP;
the GitHub Production Environment requires approval by the single available
account; and `www.nextap.services` is a verified Vercel `308` redirect to
`nextap.services`. The first Production deployment is
`dpl_6u6SXJEnWqQRDLmGcZopJ4sbhoMY` and is READY/PROMOTED. The only remaining
operator work is Production Auth owner setup and an authenticated owner smoke.


## Goal

Create a release system in which Staging can receive frequent code and data
changes while Production remains isolated, reviewable, and recoverable. A
change is complete only when the exact source SHA tested against Staging can be
promoted to Production without sharing credentials, databases, Storage objects,
Auth users, mutable fixtures, or deployment state between the environments.

The required operating model is:

```text
feature/* --PR--> staging --release PR--> main
                    |                     |
       staging Vercel + Supabase   production Vercel + Supabase
```

`staging` is the continuous validation lane. `main` is the production release
lane. A release promotes an accepted commit; it does not copy a Staging
deployment or production data into another environment.

## Starting state

This handoff is based on source commit `ab7968728704e29afcf07cc6151585d5fadf41b1`
on `chore/hosted-staging-validation`.

- Remote `staging` exists at `bc30d529`, which is an ancestor of the current
  validated candidate. It must be advanced through a reviewed change before it
  becomes the permanent Staging source.
- `staging.nextap.services` is currently bound to
  `chore/hosted-staging-validation`, not `staging`.
- The existing Vercel project is `nextap` (`prj_XZKEV6TOqxSy9Hqiw43gZtdz5dZQ`)
  in team `abdelrahman-867e`.
- Vercel's Production Branch is still `beta01`. This is legacy configuration
  and is not an authorized release source.
- `main` does not yet exist.
- Staging Supabase is `flkakuysakgwfoemgbwn`; Production Supabase is
  `jezpobjlfvihikplxrta`.
- The current Ready Staging Preview is protected and reachable through the
  authenticated Vercel CLI. Hosted authenticated E2E is not complete.
- Hosted Sentry variables and Supabase Auth redirect readback still require
  verification.
- `www.nextap.services` has a DNS CNAME but is not attached to Vercel and does
  not have a valid certificate. Decide whether to support it before launch.

Treat this section as an observation of the handoff date. Re-check provider
state before changing it.

## Target separation contract

| Concern | Staging | Production |
| --- | --- | --- |
| Git branch | `staging` | `main` |
| Vercel project | Preferred: dedicated `nextap-staging` project | Existing `nextap` project |
| Hostnames | `staging.nextap.services` and protected Preview URLs | `nextap.services`, `admin.nextap.services` |
| Supabase project | `flkakuysakgwfoemgbwn` | `jezpobjlfvihikplxrta` |
| `NEXT_PUBLIC_SITE_URL` | `https://staging.nextap.services` | `https://nextap.services` |
| Auth users | Staging owner and non-owner fixtures | Production owner only, separately provisioned |
| Storage | Staging bucket/path namespace | Production bucket/path namespace |
| Sentry environment | `staging` | `production` |
| Data policy | Synthetic, namespaced, disposable | Real customer/owner data, controlled smoke checks |
| Deployment trigger | Merge to `staging` | Approved release PR merged to `main` |

If a second Vercel project cannot be created, keep one project with strict
Preview/Production environment variables and branch bindings. The two-project
arrangement is preferred because it reduces accidental cross-target deployment
and makes access review clearer.

## Non-negotiable guardrails

1. Production credentials, database URLs, publishable keys, Storage secrets,
   Auth credentials, Sentry auth tokens, and deployment bypass secrets are
   available only to protected GitHub/Vercel Production contexts. They never
   enter pull-request jobs, Preview builds, source files, logs, artifacts, or
   chat.
2. No direct pushes, force pushes, branch deletion, or unreviewed merges on
   `staging` or `main`. Require pull requests and passing checks. Require an
   explicit reviewer approval for `main`.
3. `beta01`, temporary validation branches, and generated Preview URLs are not
   production release sources. A release source is an identified SHA on
   `main`.
4. Staging and Production never share a Supabase project, Auth user, Storage
   object, fixture, or mutable secret. A subdomain alone is not an isolation
   boundary.
5. Pull-request Preview deployments are read-only unless an explicitly isolated
   Supabase branch/project and fixture namespace have been provisioned. Shared
   Staging mutation credentials are not supplied to arbitrary PR builds.
6. Run Staging mutations only with synthetic records carrying a unique run ID.
   Cleanup may delete only records created by that run. Never seed, edit, or
   delete customer data in a test job.
7. All database changes are reviewed, checked-in migrations. Apply them once,
   in order, through a serialized environment job. Never reset a shared
   database or edit its schema manually as a release shortcut.
8. Prefer expand/contract migrations. The old and new application versions
   must remain compatible during deployment and rollback.
9. Build Production from the accepted source SHA with Production variables.
   Never assign a Staging-built artifact or Preview alias to Production.
10. Keep application rollback, database rollback, Auth changes, Storage
    uploads, and DNS changes as separate operations. A deployment rollback does
    not undo data or schema writes.
11. Never run `supabase db push`, a migration, a destructive SQL statement, or
    a production deployment until the target project and environment have been
    printed and independently checked in the job output.
12. Do not put card tokens, credentials, cookies, Auth codes, customer data,
    or payment identifiers in test output, screenshots, Sentry events, or Git.
13. Keep owner operations out of the public landing experience. The public
    landing page and its public navigation contain no links, buttons, menus, or
    calls to action for `/admin` or `/login`. Owner access remains available
    through the direct admin origin and authenticated route.

## Branch and promotion workflow

### Feature and Staging work

1. Branch from the current `staging` tip as `feature/*` or `fix/*`.
2. Keep application code, tests, and migrations in the same pull request when
   they must ship together.
3. Let PR CI use placeholder/local or disposable database settings only.
4. Merge to `staging` after review and green PR checks.
5. The Staging deployment job applies the reviewed migrations, deploys the
   Staging Vercel target, and runs hosted validation.

Completion criterion: the commit on `staging` has a Ready deployment using the
Staging Supabase project, and its hosted report records deployment ID, tested
SHA, origin, fixture run ID, viewport coverage, and pass/fail/skip counts.

### Production release

1. Open a release PR from `staging` into `main` after the Staging acceptance
   report is complete.
2. Freeze the tested SHA and list migrations, environment changes, domain
   assignments, smoke checks, and rollback target in the PR.
3. Require the Production environment approval and all release checks.
4. Apply reviewed forward-compatible migrations to Production through the
   serialized release job.
5. Build and deploy from `main` with Production variables. Verify the target is
   `production` and record the deployment ID.
6. Run only small, approved Production smoke checks. Use Staging for mutation
   regression coverage.
7. Monitor Vercel, Supabase, Auth, Storage, and Sentry for the release window.

Completion criterion: Production serves the approved SHA on the intended
domains, the smoke report is stored without secrets, and the last-known-good
deployment and database recovery procedure are recorded.

### Production hotfixes

Branch a hotfix from `main`, run the full release checks, and merge the exact
hotfix into `main`. Immediately merge the same change back into `staging` (or
rebase the next Staging work) before further feature work. This prevents a
production-only fix from being lost or reintroduced.

## Data, Auth, and Storage isolation

Maintain separate environment configuration for every deployment target:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `NEXT_PUBLIC_SITE_URL` and any callback/redirect allowlists.
- Server-only Supabase, Sentry, Vercel protection, and build variables.
- Auth owner accounts, non-owner denial fixtures, and recovery procedures.
- Storage buckets, object prefixes, retention, and cleanup jobs.

Staging Auth must allow only Staging origins, including the stable Staging
callback and the exact protected Preview callback used for testing. Production
Auth must allow only Production origins and any explicitly supported admin
origin. Keep public signup disabled and verify the owner allowlist separately in
both projects.

The environment guard in `src/lib/config/environment.mjs` remains a hard stop:
Production Supabase cannot run in development, Preview, or mutation E2E; a
non-production target cannot use the Production project. Extend the guard if a
new deployment mode could bypass this distinction.

## Migration discipline

Use the checked-in imperative migrations under `supabase/migrations/`.

For every schema or security change:

1. Create a migration using the Supabase CLI's current documented workflow.
2. Add or update SQL contract and RLS tests under `supabase/tests/`.
3. Run disposable PostgreSQL tests and advisors.
4. Apply the migration to Staging through one serialized job and verify the
   migration history, grants, RLS, functions, and application behavior.
5. Promote the same migration file with the accepted application SHA.
6. Back up or otherwise verify Production recovery readiness before applying
   it to Production.

Completion criterion: both projects have the intended migration history and
security behavior, with no manual or out-of-band SQL required to make the
release work.

## CI/CD shape

Refactor `.github/workflows/ci.yml` and deployment workflows into these lanes.

### Pull request quality

- `npm ci`
- lint
- typecheck
- unit tests
- disposable PostgreSQL migration/RLS contracts
- production build with placeholder CI Supabase values
- local public desktop/mobile smoke tests
- artifact upload for browser reports

This job has no Staging or Production credentials and cannot mutate a hosted
project.

### Staging deployment and acceptance

Trigger only for the `staging` branch after required checks pass.

- Confirm branch, SHA, target project, and `NEXT_PUBLIC_SITE_URL`.
- Apply only pending reviewed Staging migrations.
- Deploy to the Staging Vercel project.
- Run hosted E2E without starting a local Next.js server.
- Test public pages, Auth/session refresh, drafts, publish isolation, aliases,
  cards, redirect headers, media, external actions, mobile layout, and Phase 6
  publication reads.
- Verify console/network errors and Sentry `environment=staging` events.
- Upload sanitized counts and evidence.

### Production release

Trigger only for an approved release PR merge to `main`, using a protected
GitHub `production` environment.

- Confirm the exact accepted Staging SHA and release manifest.
- Confirm Production project, target, branch, domain, and site URL.
- Verify backup/restore readiness and migration compatibility.
- Apply reviewed migrations once.
- Build and deploy with Production variables.
- Verify apex/admin behavior, owner login/logout, anonymous denial, a synthetic
  approved public page, card redirect headers, media access, and Sentry
  `environment=production` monitoring.
- Record deployment ID, release SHA, migration set, and rollback target.

Production secrets must be unavailable to forked PRs and ordinary Preview
builds. Use GitHub environment protection and least-privilege scoped provider
tokens for CI management operations.

## Hosted E2E requirements

Add a hosted E2E configuration alongside the existing local `e2e.config.ts`.
It must accept a base URL, omit the local server command, preserve desktop
`1440x960` and mobile `390x844`, and separate Vercel Deployment Protection
access from application login.

The runner must receive Staging-only credentials and fixture paths through
ignored configuration. It must report pass, fail, skip, and unselected counts;
zero exit status alone is not acceptance. Mutation tests require an explicit
opt-in and a disposable or isolated Staging target.

The public landing journey must assert that no rendered anchor, button, menu
item, or other navigation control points to `/admin` or `/login`. This check
applies to the public landing origin in both Staging and Production. Test the
owner journey separately through the direct admin origin; removing public
landing links must not remove or weaken the authenticated admin routes.

## Domain and Vercel actions

Complete these provider actions in a reviewed change:

1. Bind `staging.nextap.services` to the permanent `staging` deployment
   source, or to a dedicated Staging Vercel project.
2. Create `main` from the accepted Staging source and set the Production Branch
   to `main`. Remove `beta01` from the release path.
3. Keep `nextap.services` and `admin.nextap.services` on the Production target.
4. Decide whether `www.nextap.services` is supported. If supported, attach it
   to Vercel and configure/test the canonical redirect; otherwise remove the
   dangling DNS record.
5. Verify all domains, certificates, aliases, and deployment targets after
   each binding change.

## Release and rollback evidence

Every Staging acceptance and Production release report must include:

- source SHA and branch;
- Vercel project, deployment ID, target, and URL;
- Supabase project ref and migration set;
- Auth/fixture identity class, never credentials;
- domains and viewport coverage;
- pass/fail/skip/unselected counts;
- Sentry environment/release and sanitized event evidence;
- known limitations and operator decisions;
- last-known-good deployment and recovery procedure.

If the application must be rolled back, switch traffic to the compatible
last-known-good deployment and inspect schema compatibility first. Do not claim
that this reverses database writes, Auth changes, Storage uploads, or DNS. Use
the reviewed data recovery procedure for those systems.

## Definition of done

This handoff is complete only when every item below is evidenced:

- `staging` is the only continuous Staging source and `main` is the only
  Production source.
- Branch protection, required checks, and Production approval are active.
- Staging and Production Vercel targets and domains are verified.
- Staging and Production use distinct Supabase projects, Auth settings, Storage
  configuration, secrets, and Sentry environments.
- Pull-request CI has no hosted mutation credentials.
- Staging migration/deploy/E2E jobs are serialized and produce sanitized reports.
- Production release promotes the tested SHA and uses a protected environment.
- Hosted Auth, publishing, card redirects, media, mobile, and monitoring checks
  pass on Staging.
- The public landing page exposes no entry point to the admin dashboard or
  login, while direct owner access through the admin origin remains functional.
- Production schema parity, backup/restore readiness, Auth, Storage, domains,
  and controlled smoke checks are verified.
- `www` has an explicit supported/unsupported decision.
- A rollback target and data recovery procedure are recorded.

Until all of these are true, the system is Staging-ready or release-preparing;
it is not production-launch-ready.

## References

- [Repository architecture](../ARCHITECTURE.md)
- [Staging validation and production release handoff](STAGING_VALIDATION_AND_PRODUCTION_RELEASE_HANDOFF.md)
- [Staging schema reconciliation](STAGING_SCHEMA_RECONCILIATION_HANDOFF.md)
- [Launch architecture handoff](LAUNCH_ARCHITECTURE_HANDOFF.md)
- [User and admin stories](../specs/USER_ADMIN_STORIES.md)
