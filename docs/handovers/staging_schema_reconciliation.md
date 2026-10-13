# NexTap — Staging Schema Reconciliation & Hosted Validation

Work on a new branch:

`chore/staging-schema-reconciliation`

Base it on:

`fix/launch-architecture-readiness`

Use `LAUNCH_ARCHITECTURE_HANDOFF.md` as the source of truth.

## Goal

Safely reconcile the local Supabase migration history with the existing
`NexTabCodex` Staging project, deploy the missing forward-only changes to
Staging, and verify the hosted application behavior.

Do not touch Production.

## Phase Checklist

- [ ] Phase 1 — Backup and read-only inventory
- [ ] Phase 2 — Migration-history reconciliation
- [ ] Phase 3 — Staging-only migration rollout
- [ ] Phase 4 — Hosted security and functional verification
- [ ] Phase 5 — Handoff and release recommendation

## Phase 1 — Backup and Inventory

1. Create a logical backup of the Staging database before changing it.
2. Do not print or commit connection strings, passwords, tokens, or customer data.
3. Inspect:
   - local migration files;
   - remote `supabase_migrations.schema_migrations`;
   - remote tables, functions, constraints, triggers, ACLs, and RLS policies.
4. Run `supabase migration list` and record the exact divergence.
5. Confirm the current definitions of:
   - `resolve_card`;
   - `get_published_page`;
   - `assign_card`;
   - `rls_auto_enable`;
   - `create_card_batch`;
   - `save_page_draft`;
   - `publish_page`.

## Phase 2 — Reconciliation Plan

1. Do not run a blind `supabase db push`.
2. If remote schema changes exist outside Git migrations, capture and review them
   using the appropriate `db pull` or schema diff workflow.
3. Use `migration repair` only when the actual remote schema proves that a
   migration was already applied but its history entry is missing or incorrect.
4. Do not mark unapplied schema changes as applied.
5. Prepare an explicit forward-only migration sequence.
6. Do not edit already-shared historical migrations merely to force matching.
7. Document every reconciliation decision before applying it.

## Phase 3 — Staging Rollout

Apply changes to Staging only after:

- the backup is verified;
- the reconciliation sequence is forward-only;
- the expected SQL diff is reviewed;
- no destructive table or data operation is required.

Deploy and verify:

1. Phase 6 publication cache functions:
   - `get_publication_pointer`;
   - `get_publication_snapshot`.
2. The preproduction publication contract repair.
3. The launch architecture security migration.
4. Any required migration-history reconciliation records.

Ask for approval only if a destructive operation, guessed repair, data rewrite,
or rollback is required.

## Phase 4 — Verification

Verify through catalog queries that:

- Phase 6 functions exist with the expected signatures.
- Anonymous callers can execute only the intended public read RPCs.
- `anon` cannot execute `assign_card`.
- `authenticated` can still execute `assign_card`.
- `anon` and `authenticated` cannot execute `rls_auto_enable`.
- Existing RLS policies remain enabled.
- No public table access was unintentionally introduced.

Run:

- database contract tests;
- Supabase security and performance advisors;
- typecheck;
- lint;
- unit tests;
- production build;
- hosted Preview/Staging E2E tests.

Test these hosted journeys:

- Owner login and session refresh;
- Draft → Preview → Publish;
- public business page update;
- old-slug alias redirect;
- card activation and deactivation;
- card reassignment;
- `/c/:token` returning `302` with `no-store`;
- media loading;
- Arabic RTL;
- no unpublished content leaking publicly.

Confirm the application uses the Phase 6 pointer/snapshot path instead of the
five-second compatibility fallback.

## Safety Rules

- Staging only.
- No Production project changes.
- No DNS changes.
- No deployment to the Production domain.
- No destructive migration.
- No force reset or blind history repair.
- Never expose secrets.
- Preserve the compatibility fallback until hosted Phase 6 verification passes.

## Acceptance Criteria

- Local and Staging migration histories are explicitly reconciled.
- The hosted schema matches the reviewed migration intent.
- Phase 6 RPCs work on Staging.
- Security execute grants are corrected.
- Owner workflows remain functional.
- Hosted Draft/Publish/Card journeys pass.
- No Production or customer environment is affected.
- Rollback or recovery steps are documented.

## Deliverable

Create `STAGING_SCHEMA_RECONCILIATION_HANDOFF.md` containing:

1. Backup evidence without secrets.
2. Before/after migration histories.
3. Schema drift found.
4. Reconciliation decisions.
5. Migrations applied to Staging.
6. ACL/RLS verification results.
7. Advisor results.
8. Test and E2E results.
9. Remaining launch blockers.
10. Exact recommendation for merging into `integration/preprod`.

Do not merge into `main` and do not activate Production.