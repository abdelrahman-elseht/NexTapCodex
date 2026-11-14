---
Status: review complete; recommendation is revise and hold physical-schema approval
Owner: NexTap Core engineering
Supersedes: none
Path globs: ["infra/cloudflare/d1/**", "tests/fixtures/phase1-d1/**", "tests/unit/phase1-d1-schema.test.ts"]
Topic tags: cloudflare, d1, schema, parity, review
---

# Phase 1 D1 Schema Review

## Recommendation

Revise and hold owner approval of the physical schema. The candidate is useful for isolated Phase 1 testing, but it does not yet cover all approved logical contracts and several integrity guarantees depend on application behavior that has not been implemented or tested. Do not import production data or treat dev/staging application as approval. Keep the applied migrations unchanged; revise with a new numbered migration after the open contract decisions and review findings below are addressed.

## Candidate Identity

The review applies to Wrangler config `infra/cloudflare/d1/wrangler.toml` and these exact migration bytes:

| Migration | SHA-256 |
| --- | --- |
| `0001_phase1_core_schema.sql` | `478cf395ae7e861de607848b1ebd1f3d5d48fe0377f5778a19f98d084f6a483a` |
| `0002_permanent_slug_aliases.sql` | `bcba868fcdf45783b33072323f6ed97f21c16a2a5c25f5b1c4a5eb79f0d5aee3` |

Both migration IDs are reported applied in development and staging by the current environment/runbook records. That establishes deployment state and a recorded migration ledger only. It does not show production-scale content fit, runtime contracts, authorization, recovery, or owner acceptance of the physical layout. The applied SQL must remain immutable; follow-up changes belong in a new migration.

## Approved Contracts

- `has_menu` is page-level state with a false default and is copied into each immutable publication snapshot as `page.hasMenu`. Migration `0003_approved_page_publication_contracts.sql` adds the physical source field.
- The version-1 contact projection is stored only inside each immutable publication snapshot. Contact downloads consume published values, never draft state; no separate projection table is used.
- Staff capabilities are global and initially match the legacy role matrix. Unknown staff and roles are denied, and every business operation requires an explicit business target.
- When `has_menu` is true, the profile link target is `/b/{slug}/menu`. Menu remains separate; Phase 1 does not build the Menu page or add a runtime Core-to-Menu dependency.
- Historical direct-profile slugs remain resolving aliases to their original page indefinitely and are never reassigned. This does not change token-based card routes. Migration `0002_permanent_slug_aliases.sql` removes the non-resolving `reserved` state and converts any such row to `alias`.

The URL and alias decisions are recorded in [Phase 1 Execution Spec](../../../docs/specs/NEXTAP_PHASE_1_EXECUTION_SPEC.md:81). The approved contracts above resolve the earlier questions about `has_menu`, contact projection, and initial staff capabilities.

## Concrete Findings

- `manifest_json` in `0001` is checked for valid JSON but has no byte-size limit, unlike candidate limits on snapshot, sections, provider profiles, contact configuration, and audit details. Set and validate a limit against representative export/publication fixtures.
- `0001` did not contain page-level `has_menu`; `0003` adds it with a false default. The publication builder must copy it as `page.hasMenu`.
- The version-1 contact projection lives only in each immutable snapshot; contract tests must ensure it derives from published content.
- The partial unique index permits at most one canonical slug per page but cannot require one. The SQL also cannot ensure a page's canonical registry row matches a page publication or that aliases only ever retain their original owner. Rename plus alias reservation, exactly-one-canonical checks, and append-only slug/history behavior need an application transaction and contract tests.
- SQL records publication/card/audit history but does not prevent a privileged writer from changing or deleting those rows. With procedures/triggers excluded, enforce append-only behavior through the service boundary and test it. The same boundary must verify publication artifacts before activation, validate active card eligibility, and reject idempotency-key reuse with a different request fingerprint.
- Exact section/content and slug-normalization contracts, timestamp/ID serialization, publication manifest format, retention periods, identity admission, and migration forward/rollback policy remain unapproved. The [schema decisions note](SCHEMA_DECISIONS.md) lists the remaining gates.

## Evidence

### What passed

- `tests/unit/phase1-d1-schema.test.ts` applies `0001` and `0002` through Wrangler to a temporary local D1 database. It checks that a synthetic `reserved` row becomes an alias, alias rows have no expiry column, the canonical unique index and page foreign key exist, `PRAGMA foreign_key_check` is clean, and duplicate slug, missing-page, unsupported-state, and malformed-token inserts fail.
- A separate manual Wrangler local run applied the migration and synthetic business/page/slug/section/publication/card/history/audit/receipt fixture; reapplying migrations reported no pending work. Duplicate slug, cross-page publication pointer, and malformed serial probes failed at their constraints.
- Remote dev/staging verification recorded zero slug rows and clean foreign-key checks. Since those tables were empty, this did not exercise conversion of existing aliases or application resolution.
- Legacy parity references: [Phase 1 inventory](../../../docs/research/PHASE_1_LEGACY_PARITY_INVENTORY.md:17) summarizes current outcomes; [`202610080001_initial_schema.sql`](../../../supabase/migrations/202610080001_initial_schema.sql:9) defines the legacy relationships and base integrity checks; [`202610080002_publish_and_slugs.sql`](../../../supabase/migrations/202610080002_publish_and_slugs.sql:1) records old slugs; [`20261020063654_contacts.sql`](../../../supabase/migrations/20261020063654_contacts.sql:2) adds contact configuration and revision checks; [`20261014210855_admin_inventory_operations.sql`](../../../supabase/migrations/20261014210855_admin_inventory_operations.sql:186) rejects changed reuse of idempotency requests; [`20261024020834_internal_admin_capabilities.sql`](../../../supabase/migrations/20261024020834_internal_admin_capabilities.sql:3) shows legacy staff admissions and capabilities.
- Legacy behavioral SQL coverage includes `supabase/tests/phase123-contracts.sql`, `supabase/tests/phase5-incremental-saves.sql`, `supabase/tests/phase6-publication-cache.sql`, `supabase/tests/card-resolver-contract.sql`, `supabase/tests/inventory-deletion.sql`, `supabase/tests/contacts.sql`, `supabase/tests/publication-media-privacy.sql`, and `supabase/tests/internal-admin-capabilities.sql`. Those files establish parity facts; they do not test D1.

### What did not pass or remains unproven

- The earlier `0001` candidate allowed `kind='reserved'`, which conflicted with the approved indefinitely-resolving alias policy. `0002` corrects that state in development/staging; the current local migration test covers its conversion only with a synthetic row.
- No test here proves a slug rename application transaction, permanent alias resolution, canonical-slug synchronization, publication/card/audit immutability, request-fingerprint handling, or authorization. These require target application-service contracts.
- No representative production-shaped dataset has been checked against JSON limits, manifest size, ID/timestamp mapping, or R2 object references. Remote dev/staging had no slug rows; this is not migration-data acceptance.
- No restore test in this schema review proves the owner-approved four-hour RTO or 24-hour maximum RPO. The RPO is owner-approved, but backup capability and operational attainment remain unproven pending a representative restore rehearsal. Neither objective should be inferred from the 30-day legacy rollback target or from migration application.
- No production D1 was accessed. No production data was read or changed.

## Approval Gates

The approved `has_menu`, contact projection, staff capability, and business-target contracts are recorded, and migration `0003` represents the `has_menu` source field. Historical alias retention is approved as indefinite and non-reassignable in the Phase 1 execution spec. Remaining schema approval requires resolving the content and audit/idempotency-retention findings, closing writer-boundary questions, validating migration compatibility and rollback policy, and testing representative non-production fixtures plus app-shaped restore. Keep the approved `/b/{slug}/menu` and indefinite alias decisions intact.
