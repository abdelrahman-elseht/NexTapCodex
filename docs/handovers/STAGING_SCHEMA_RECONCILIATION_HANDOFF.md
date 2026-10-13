# NexTap - Staging Schema Reconciliation Handoff

Audit date: 2026-10-13
Branch: `chore/staging-schema-reconciliation`
Base commit: `b737c47` (`docs: record launch architecture readiness`)
Staging project: `flkakuysakgwfoemgbwn` (`NexTabCodex`, `eu-west-1`, `ACTIVE_HEALTHY`)

## Result

Staging was reconciled and updated with forward-only migrations. Production,
DNS, customer data, and the Production project were not touched. The Phase 6
publication RPCs now exist, the launch security grants are corrected, and the
alias table no longer has anonymous Data API table privileges.

The hosted application journeys are not validated yet. The Vercel `nextap`
project has no deployment (`live: false`, `latestDeployment: null`, zero
deployments), so `staging.nextab.services` returns deployment lookup `404`.

## Backup evidence

The available Supabase MCP surface does not expose a logical backup export, the
Supabase CLI is not installed, and no database password or connection string is
available in the environment. No customer rows or credentials were exported.
Before the first hosted mutation, a read-only catalog inventory was captured
through Supabase MCP: migration history, tables and row counts, function
definitions and privileges, constraints, triggers, event triggers, policies,
and advisors. The inventory is summarized below without customer data.

The applied migrations are forward-only and contain no table drops, data
rewrites, or destructive changes. A downloadable logical backup remains an
operational follow-up before any future destructive operation.

## Migration histories

### Local Git before rollout

The base checkout contained 19 migrations, ending with:

```text
20261010122933_phase6_publication_cache.sql
20261010132029_preprod_contract_repairs.sql
20261012201228_launch_architecture_security.sql
```

The branch adds:

```text
20261013000000_staging_schema_acl_reconciliation.sql
```

### Staging before rollout

Staging had 17 entries. The names and versions were not the local filenames:

```text
20261008075239 initial_schema
20261008075330 publish_and_slugs
20261008075339 publish_page
20261008080121 constraints_indexes
20261008080451 immutable_publications
20261008080707 owner_audit_insert
20261008091935 atomic_section_reordering
20261008171345 external_printer_batches
20261008231539 template_presets
20261008231601 atomic_draft_save
20261009114308 quick_actions
20261010034627 provider_profiles
20261010043844 unambiguous_provider_draft_contract
20261010044431 unambiguous_private_legacy_draft_contract_v2
20261010065936 incremental_atomic_draft_save
20261010065943 admin_keyset_indexes
20261010070100 draft_save_constraint_resolution
```

The remote schema proved that these historical changes were already present:
the publication, draft, provider-profile, index, RLS, trigger, and constraint
definitions matched the intended pre-Phase-6 state. The remote
`draft_save_constraint_resolution` entry is retained as the hosted repair that
left `(page_id, section_key)` non-deferrable while keeping position deferrable.

### Staging after rollout

The following entries were appended by Supabase MCP `apply_migration`:

```text
20261012211522 phase6_publication_cache
20261012211523 preprod_contract_repairs
20261012211524 launch_architecture_security
20261012211702 staging_schema_acl_reconciliation
```

No `migration repair` was run. The differing historical versions were not
guessed or rewritten, and `supabase db push` was not run.

## Reconciliation decisions

1. Treat the 17 existing remote entries as applied historical work because the
   inspected definitions and constraints prove their effects are present.
2. Preserve the remote history names and versions; do not edit shared local
   migrations to force timestamp equality.
3. Apply Phase 6 first because the contract repair grants the private reader
   functions created by Phase 6.
4. Apply the preproduction contract repair, then the launch security migration.
5. Add a forward-only ACL migration to remove the anonymous table grant that
   was present on `page_slug_aliases` because the table is owner-only and public
   reads use RPCs.
6. Keep the application compatibility cache fallback. It remains required for
   older environments even though Staging now exposes the Phase 6 functions.

## Migrations applied to Staging

- `phase6_publication_cache`: created the private pointer/snapshot readers and
  public invoker wrappers, with anonymous and authenticated execution on the
  public wrappers.
- `preprod_contract_repairs`: preserved the section-key constraint contract and
  granted the private readers the privileges required by the invoker wrappers.
- `launch_architecture_security`: revoked anonymous/public execution from
  `public.assign_card` and revoked public/anonymous/authenticated execution from
  `public.rls_auto_enable()` when present.
- `staging_schema_acl_reconciliation`: revoked `public` and `anon` table
  privileges from `public.page_slug_aliases`, preserving authenticated owner
  privileges.

## Schema and security verification

The post-rollout catalog checks found:

- `public.get_publication_pointer(text)` and
  `public.get_publication_snapshot(uuid)` exist and are executable by `anon`
  and `authenticated`.
- The private pointer/snapshot readers exist as security-definer functions and
  are not exposed as public RPC endpoints; their grants only support the public
  invoker wrappers.
- `anon` cannot execute `public.assign_card(uuid,uuid,text,text)`.
- `authenticated` can execute `public.assign_card(uuid,uuid,text,text)`.
- Neither `anon` nor `authenticated` can execute `public.rls_auto_enable()`.
- All 11 public application tables have RLS enabled.
- `anon` has no table SELECT privilege on any of the 11 public application
  tables, including `page_slug_aliases` after the ACL migration.
- The `page_sections` contract is `UNIQUE (page_id, section_key)`
  non-deferrable and `UNIQUE (page_id, position) DEFERRABLE`.
- Anonymous pointer and snapshot calls for a missing key return `NULL` without
  error.

## Advisor results

Post-rollout Supabase advisors report two security warnings:

- `public.create_card_batch(...)` remains an authenticated security-definer
  RPC. Its owner check and input validation are existing behavior and require a
  separate design decision before changing.
- Leaked-password protection is disabled in Auth. This is a dashboard/plan
  setting and was not changed by this migration work.

The performance advisor still reports six informational unused-index findings
for low-traffic audit, history, batch, and publication indexes. They were not
removed because staging traffic is insufficient evidence for a safe deletion.

## Test results

Passed locally on this branch:

- `npm.cmd run test:db`: 20 migrations and all SQL contracts passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd test`: 18 files, 101 tests passed.
- `npm.cmd run lint`: passed with 0 errors and 11 existing warnings.
- `npm.cmd run build`: passed; the existing image and unused-variable warnings
  remain.

Hosted E2E journeys were not run. Vercel MCP reports the `nextap` project as
not live with zero deployments, and fetching both `/` and `/c/invalid-token`
from `https://staging.nextab.services` returned deployment lookup `404`.
The verified staging domain exists, but it has no deployed application to test.

## Remaining blockers

- Create a downloadable Staging logical backup before any destructive operation.
- Deploy this branch to the verified Staging domain, then run owner login/session
  refresh, Draft -> Preview -> Publish, public update, old-slug alias,
  activation/deactivation, reassignment, `/c/:token` no-store redirect, media,
  Arabic RTL, and unpublished-content isolation journeys.
- Re-run the hosted checks to prove the Phase 6 pointer/snapshot path is used.
- Decide how to address leaked-password protection and the authenticated
  `create_card_batch` advisor warning.
- Configure and verify WAF/rate limits, usage/error alerts, and Auth policy
  settings before launch.

## Recommendation for `integration/preprod`

Merge `chore/staging-schema-reconciliation` into `integration/preprod` only
after a Staging deployment exists and the hosted journeys above pass. The
database migrations are ready to merge now as forward-only changes, but the
branch should remain a staging validation gate until hosted evidence is
attached. Do not merge into `main`, activate Production, change DNS, or deploy
the Production domain as part of this work.
