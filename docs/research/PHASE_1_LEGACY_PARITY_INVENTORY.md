---
Status: Phase 1 parity inventory; factual baseline, not target schema approval
Owner: NexTap Core engineering
Supersedes: none
Path globs: ["supabase/migrations/**", "supabase/tests/**", "src/lib/auth/**", "src/lib/admin/**", "src/lib/business/**", "src/lib/cards/**", "src/lib/media/**"]
Topic tags: migration, parity, authorization, data-contract
---

# Phase 1 Legacy Parity Inventory

This inventory records behavior to preserve or explicitly disposition during Phase 1 contract work. Legacy SQL is evidence of existing behavior; it is not a D1 table design or permission to copy PostgreSQL functions, triggers, or RLS policies into the target.

## Verified Legacy Behavior

| Area | Verified behavior | Source evidence | Target implication |
| --- | --- | --- | --- |
| Staff admission | Internal staff are allowlisted; `admin_admissions` binds an Auth user to one of administrator, publisher, editor, inventory, or auditor. `owner_users` is global staff access, not per-business tenancy. | `supabase/migrations/20261024020834_internal_admin_capabilities.sql`; `src/lib/auth/owner.ts` | Preserve staff-only admission and explicit capability checks. Do not infer business-owner self-service or tenant roles. Exact target capability mapping needs owner approval. |
| Capability map | Read is available to admitted staff; edit/media to administrator, publisher, editor; publish to administrator/publisher; inventory/export to administrator/inventory; delete to administrator. | `supabase/migrations/20261024020834_internal_admin_capabilities.sql`; `supabase/tests/internal-admin-capabilities.sql` | Use as legacy parity input; target service authorization remains authoritative and must be tested independently. |
| Mutation boundary | Current server mutations verify same-origin, authenticated claims, and `owner_users`; elevated operations call `admin_has_capability`. | `src/lib/admin/mutation.ts`, `src/lib/auth/owner.ts` | Preserve origin/session checks as legacy outcomes; replace provider-specific checks with the approved Access plus application capability boundary. |
| Business/page identity | Businesses and pages use stable UUIDs; pages relate to businesses and may represent branches. Slugs are unique route addresses, not identity. | `supabase/migrations/202610080001_initial_schema.sql`; `docs/DATA_MODEL.md` target identity section | Preserve stable IDs and relationships; the target schema and exact types remain unresolved. |
| Slug rename | Updating a page slug records the old slug as an alias to the same page; a new canonical slug collision is rejected. | `supabase/migrations/202610080002_publish_and_slugs.sql`; `supabase/tests/phase123-contracts.sql` | Preserve atomic reservation and never reassign historical aliases. Expiry/retention after cutover is still an owner decision. |
| Draft saves | Draft saves validate revisions and perform related business/page/section changes atomically; stale revisions conflict instead of silently overwriting concurrent changes. | `supabase/migrations/202610080009_atomic_draft_save.sql`, `supabase/migrations/20261010060000_phase5_incremental_atomic_saves.sql`; `supabase/tests/phase5-incremental-saves.sql` | Preserve conflict detection, ordering, and all-or-nothing user outcomes. D1 schema/API mechanism is not inferred here. |
| Publication | Published snapshots are immutable; a page points to its active publication. Failed validation must not expose partial draft state. | `supabase/migrations/202610080003_publish_page.sql`, `supabase/migrations/202610080005_immutable_publications.sql`; `supabase/tests/phase6-publication-cache.sql` | Preserve immutable versions and verified activation. R2/D1 orchestration belongs to the approved target contract. |
| Card identity/state | Cards have stable IDs, unique token and serial, lifecycle state, optional page assignment, and append-only assignment history. Batch creation and assignment support idempotency. | `supabase/migrations/20261008171345_external_printer_batches.sql`, `supabase/migrations/20261014210855_admin_inventory_operations.sql`; `supabase/tests/card-resolver-contract.sql`, `supabase/tests/inventory-deletion.sql` | Preserve token/serial identity, status outcomes, history, and retry behavior. Do not make KV authoritative. |
| Contact/media privacy | Contact output is derived from published values; draft/private media is not public until referenced by a valid publication. | `supabase/migrations/20261020063654_contacts.sql`, `supabase/migrations/20261024021635_publication_media_privacy.sql`; `supabase/tests/contacts.sql`, `supabase/tests/publication-media-privacy.sql` | Preserve publication gating and private-original boundaries; exact target media lifecycle remains open. |

## Verified Facts and Unresolved Assumptions

- Verified: current source uses Supabase Auth claims and database allowlisting for staff; capability checks are server-side, and current owner access is global rather than tenant-scoped.
- Verified: current SQL includes business workflows in RPCs/triggers and RLS. The target PRD intentionally moves business rules to application services and uses D1 constraints for integrity; the legacy implementation must not be mechanically ported.
- Verified: current application and migration history provide observable compatibility outcomes, but the final D1 physical schema, capability names, role ownership, backup format, recovery objectives, and deletion retention are not specified by this inventory.
- Assumption awaiting approval: capability behavior may be preserved one-for-one at the product boundary. The role-to-capability mapping needs review against actual staff operations before target authorization is finalized.
- No production data or credentials were queried for this inventory. No D1 schema, migration, or restore was created or applied.

## Phase 1 Contract Work Still Needed

Use this inventory to review logical entity ownership and negative authorization cases. Before writing target migrations, the owner must approve the physical D1 schema and migration format, staff capability map, migration forward/rollback policy, logical export format and protection, backup retention, and RPO/RTO. A D1/KV/R2 dev/staging resource matrix must identify distinct verified resources before any Cloudflare mutation workflow can run.
