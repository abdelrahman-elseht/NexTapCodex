---
Status: current model and active Cloudflare migration target
Owner: NexTap Core engineering
Supersedes: none
Path globs: supabase/**, src/lib/business/**, src/lib/cards/**, src/lib/auth/**, src/lib/media/**, workers/**, infra/cloudflare/**
Topic tags: database, migration, publication, authorization, cards, media, routing
---

# NexTap Core Data Model

This document distinguishes the current Supabase model from the active Cloudflare migration target. It is a logical map, not a physical schema definition. Checked-in Supabase migrations and database tests remain authoritative for legacy behavior and parity discovery. Cloudflare development and staging resources exist, and candidate D1 migrations `0001`-`0003` are applied there; that does not mean the replacement application runtime or full target schema is implemented or approved. Target requirements follow the [Landing Delivery and Supabase Exit PRD](specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md) plus owner-approved phase decisions that explicitly supersede conflicting clauses.

## Authority and current stage

| Concern | Current source of truth | Target direction |
| --- | --- | --- |
| Domain terms | [CODEBOOK](../CODEBOOK.md) | Preserve business ID, page, slug, alias, draft, publication, and card-token meanings. |
| Current routes and code ownership | [Architecture map](ARCHITECTURE.md) | Keep Next.js current until the migration phase proves and replaces each boundary. |
| Product and migration requirements | [Landing delivery PRD](specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md) | D1 owns mutable Core records; R2 owns immutable publication output and public media; KV is a non-authoritative lookup cache. |
| Current relational behavior | [`supabase/migrations/`](../supabase/migrations/) and [`supabase/tests/`](../supabase/tests/) | Port behavior to application services and integrity constraints; do not copy SQL procedures as the target design. |

Supabase is the current system of record for Core and is treated as the compatibility and rollback baseline during migration. The public route, admin, identity, media, card operations, and publication workflow still depend on it. Cloudflare is the active destination. Phase 0 and Phase 1 remain incomplete; this document must not be used to claim a migration phase has passed.

## Current logical model

The current model was introduced in [`202610080001_initial_schema.sql`](../supabase/migrations/202610080001_initial_schema.sql) and extended by later migrations. The following is a conceptual inventory; exact columns, checks, RLS policies, and RPC behavior are defined only by those migrations.

| Concept | Current representation | Relationship and role |
| --- | --- | --- |
| Staff identity/admission | Supabase Auth user plus `public.owner_users`; later `private.admin_admissions` and an `admin_role` capability | Internal NexTap staff only. It is not business-owner self-service identity. Authorization is implemented through current application checks and database policies. |
| Business | `public.businesses` | Stable UUID identity, shared profile metadata/provider profiles, and active/archive lifecycle. A business can have a main page and branch pages. |
| Page | `public.business_pages` | Belongs to a business; has a canonical public slug, page type/template, optional parent/branch data, active state, draft revision, and current published-version pointer. |
| Draft sections | `public.page_sections` | Ordered, enabled section records attached to a page; typed by section kind with structured JSON content. Current content size and shape constraints are in migrations. |
| Publication | `public.page_publications` | Immutable snapshot associated with a page and monotonically increasing version. A page points to its active snapshot. The snapshot contains publication-ready business/page/section data. |
| Slug history | `public.page_slug_aliases` | Previous slugs resolve to their original page after a rename. The slug is a route address, not an identity. |
| Card batch and card | `public.card_batches`, `public.cards` | A batch groups manufactured card inventory. A card has a stable token and serial, lifecycle state, and optional current page assignment. |
| Card transition history | `public.card_assignment_history` | Records assignment/status transitions, actor, reason, and time; card identity is retained. |
| Media metadata | `public.media_assets`, private publication-media references | Tracks business media metadata and the relationship between immutable publications and retained objects. Actual bytes are in Supabase Storage today. |
| Audit and idempotency | `public.audit_logs` and private operation receipts/request records | Records administrative actions and makes sensitive inventory operations retryable without duplicate effects. Exact private support tables are migration-defined. |

Important current behaviors include immutable publication rows, a page pointer to its active publication, application and database authorization, atomic draft operations, append-only card history, private media objects readable only when a current publication references them, and idempotent card-batch operations. Use the migrations and their SQL contracts for exact semantics; this table is not a replacement for them.

## Target identity and relationships

The target model retains stable IDs across the migration. Public identifiers must never become primary identity merely because they appear in URLs.

| Target concept | Identity and relationship | Integrity responsibility |
| --- | --- | --- |
| Business | Stable opaque Core business ID; parent for one main page and zero or more branch pages | Enforce valid business lifecycle and one main page. Admin-only application services authorize access. |
| Page | Stable opaque page ID; belongs to one business and may belong to a parent page for branch grouping | Enforce business relationship, page type, branch uniqueness where required, and valid active-publication reference. |
| Canonical slug | Globally unique route name for a page | Application validates normalized slug syntax and reserves it atomically. Database unique constraints prevent collisions. |
| Slug alias | Historical slug mapped to the same stable page ID | Aliases cannot point to a different page after creation and cannot be reclaimed by a new page. A rename reserves the old canonical slug as an alias in the same logical operation. |
| Draft | Mutable admin editing state for a page, including ordered sections and associated business-level values | Only application-level admin authorization can read/write it. Draft data must never be published from public storage or public cache paths. |
| Publication | Immutable version of the complete public page projection, keyed by publication ID and page/version | Version uniqueness and immutability are integrity constraints. The current-publication pointer can only refer to a verified publication for that page. |
| Card | Stable card ID plus permanent opaque token and manufacturing serial; optional assigned page | Token and serial uniqueness, valid status, and assignment references are constrained. Authorization, eligible-page rules, transitions, and idempotency live in application services. |
| Assignment history | Append-only record relating a card to old/new page and status, actor, reason, and time | Preserve auditability; do not rewrite prior transitions to represent current state. |
| Media asset | Stable media record and content hash; owned by a business and referenced by draft/publication data | Validate ownership, object key, format, size/dimensions, and publication reference before it is made public. |
| Admin identity/capability | External identity-provider subject mapped to allowed Core capabilities | Cloudflare Access controls entry to the admin host; application services still authorize every operation. Do not infer an admin role from user-editable profile metadata. |
| Audit event | Actor, operation, entity reference, bounded metadata, and timestamp | Append-only by application convention and constrained references where appropriate. Never store secrets, full card tokens, or uploaded content in audit details. |

Business owners do not directly administer their landing pages. Core is operated by NexTap staff. No per-business owner account, Menu-owned entity, order, or menu content belongs in this model.

## Publication and storage boundary

The target separates mutable admin state from the public read model:

1. Application services validate an authorized draft and its media references.
2. The publisher creates a new immutable publication version and writes its complete output and manifest to R2 using versioned keys.
3. The publisher verifies object existence, hashes, and all referenced public derivatives before changing the active publication metadata/pointer.
4. It updates stable URL artifacts and cache/purge metadata as required by the route design proven in the migration PRD. A failed step leaves the prior publication usable.
5. Rollback selects a retained immutable version and restores the stable public route to it; it does not reconstruct a version from a mutable draft.

D1 and R2 do not share a transaction. Therefore D1 must never point at an unverified object set. Publication state should distinguish staging/incomplete work from active verified output, and reconciliation must detect orphaned versions or stale pointers. Do not expose drafts, private originals, upload credentials, or unpublished snapshots through public buckets or cache keys.

The public profile hot path is a static/CDN delivery requirement in the [migration PRD](specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md). D1 is not queried per profile visit. KV is only a non-authoritative fallback lookup cache and must not decide canonical slug ownership, card status, revocation, or access authorization. R2 holds immutable publication objects and content-hashed media; stable public URLs have explicit freshness and invalidation behavior.

## Slug, card, and menu invariants

- `/b/{slug}` is a public route; the slug is not a tenant/business ID.
- A slug rename preserves prior addresses as aliases to the same page. The slug namespace includes current slugs and retained aliases, so an old address can never be assigned to another business.
- Printed direct-profile QR/NFC destinations already contain `/b/{slug}` and have no card-token lookup. The owner-approved Phase 1 decision requires every historical slug to remain an alias to the same page indefinitely and never be reassigned. This decision supersedes the conflicting PRD retention clause; see the [Phase 1 execution spec](specs/NEXTAP_PHASE_1_EXECUTION_SPEC.md).
- `/c/{token}` uses a stable card token. An active card resolves to its currently eligible published page; unassigned, disabled, replaced, inactive, and invalid cards retain distinct public unavailable behavior where required.
- Card state is canonical mutable state. KV may accelerate a fallback lookup only within a bounded freshness policy; it is not the revocation authority.
- A publication includes Core-controlled `has_menu`. The owner-approved profile link when true is `/b/{slug}/menu`; when false, no Menu action appears. This decision supersedes the conflicting PRD URL clause. Core stores no Menu data and performs no Menu API/database/Worker request to render a profile. Phase 1 records the contract; it does not implement the Menu page or static publication.
- Contact VCF output is derived only from published contact fields and is not an independent source of profile truth.

## D1 target boundaries

D1 is proposed for mutable Core records, not public page rendering. Logical record groups are:

| Group | Logical responsibilities | Keep out of the database layer |
| --- | --- | --- |
| Business and page | Stable IDs, lifecycle, page/branch relationship, canonical slug, draft revision, active publication reference | Template rendering and field-level business decisions. |
| Draft content | Ordered section rows or a validated versioned document, provider/contact configuration, media references | User-facing validation copy, publication HTML generation, menu calls. |
| Slug ownership | Canonical slug and immutable historical aliases | Cache freshness or edge routing implementation. |
| Publication registry | Publication ID/version, immutable artifact keys, manifest/hash, publish actor/time, verified/active state | HTML serialization, image transforms, non-transactional object orchestration. |
| Card inventory | Batches, cards, token/serial, status, assignment, revision/idempotency identifiers | Permission policy, eligibility workflow, QR drawing/export formatting. |
| Audit and operation records | Administrative audit entries and bounded idempotency receipts needed for safe retries | Request-specific control flow or large payloads. |
| Admin identity mapping (if needed) | Stable external subject identifier and minimal capability/allowlist mapping | Authentication/session issuance; Cloudflare Access remains the edge identity gate. |

Use database constraints for relational integrity, uniqueness, allowed states where stable, and referential safety. Keep authorization decisions, publication sequencing, card transition rules, slug rename workflows, media processing, and cross-service coordination in typed application services. Do not add SQL stored procedures, triggers, Redis, Durable Objects, or a second database unless an observed requirement proves they are necessary and the architecture contract is revised.

For transaction design, group only the D1-owned changes that must be atomic (for example a canonical-slug rename plus alias reservation, or a card state plus its history/audit record). Keep R2 upload, image processing, cache purge, and other external effects outside D1 transactions. Use idempotency keys and reconciliation for operations spanning D1 and R2. The exact D1 transaction API and batch size limits must be verified against current Cloudflare documentation during schema implementation.

## Media model and lifecycle

Supabase Storage and `public.media_assets` are current. The target uses R2 for versioned publication output and public derivatives on `media.nextap.services`; private originals/drafts remain outside public access. Each public derivative should be content-addressed and immutable. Publication manifests retain the exact media keys used by each version so old versions remain renderable during rollback. Media deletion is permitted only after no retained publication references the object and the configured retention period has passed.

The current AVIF upload acceptance and publication-registration behavior has had a mismatch; review [`20261028070727_allow_avif_business_media.sql`](../supabase/migrations/20261028070727_allow_avif_business_media.sql), the publication-media migrations, and media tests before making format decisions. The migration PRD currently favors compatible WebP output and requires real-file testing before AVIF is retained as an output format. Do not infer format support from a file extension alone.

## Migration and reconciliation rules

1. Inventory current tables, constraints, indexes, RLS policies, RPC behavior, Storage objects, Auth admissions, and audit/inventory operations from every migration and test. The current migrations are the source; this document is not a substitute for a migration-by-migration map.
2. Define target IDs and deterministic mappings before copying data. Preserve business/page IDs, canonical slugs, all aliases, publication IDs/versions, card tokens/serials, assignment history, audit references, and media ownership where compatible.
3. Make imports repeatable and idempotent. Re-running an import must not duplicate a business, publication, card, history record, or object.
4. Compare source and target counts plus per-record hashes/behavior for all active pages, publications, aliases, cards, assignments, media references, and required admin state. Explain every mismatch.
5. Test authorization and negative access cases independently; successful migration counts do not prove tenant/admin isolation.
6. Reconcile final deltas before cutover. Preserve the old source and verified exports for the rollback window; do not disable Supabase until the PRD's final exit criteria pass.

## Open design decisions

These are intentionally not guessed in this document. Resolve and record them in the migration PRD or an ADR before the related schema/contract is implemented.

| Decision | Why it remains open | Required evidence/owner |
| --- | --- | --- |
| Final D1 table layout and field types | The current schema has evolved through migrations and the target should not be a mechanical copy. | Migration inventory, query/write paths, expected scale, and database contract tests. |
| Admin identity provider and subject mapping | Access protects the host, but the Core capability mapping and recovery lifecycle still need an explicit identity design. | Staging Access configuration, sign-in/MFA/recovery tests, least-privilege role map. |
| Exact public artifact key/routing shape | The `/b/{slug}` static-hit constraint and `/menu/*` coexistence must be proven on the real hostname. | Phase 0 routing test and measured worker invocation/cache behavior. |
| Publication invalidation/freshness mechanism | R2, D1, KV, and CDN do not share atomic commits; deactivation and rename need bounded stale behavior. | Measured purge semantics, failure injection, stale-state tests, approved freshness SLO. |
| Media derivative formats and retention | Device support and old publication rollback needs must be balanced against storage/transfer. | Representative real images, low-end-device decode/performance evidence, rollback-retention tests. |
| Audit/idempotency retention | Required operational history and storage/cost policy are not fully specified here. | Admin requirements, recovery drills, and the approved retention schedule. |

## Change rules

- Update this document when the target model, identity boundary, slug/publication/card/media relationship, transaction boundary, or migration mapping changes.
- Update [CODEBOOK](../CODEBOOK.md) only when a domain term or invariant changes; do not duplicate this design there.
- Update the landing migration PRD when product requirements or phase acceptance gates change.
- For current Supabase behavior, add or update migrations and SQL contract tests; do not edit this document as a substitute.
- Before a schema implementation, review this document with the migration PRD, current migrations/tests, and the relevant Supabase/Cloudflare provider guidance. Record substantive unresolved trade-offs in an ADR.

## Source references

- [CODEBOOK](../CODEBOOK.md)
- [Architecture map](ARCHITECTURE.md)
- [Landing delivery and Supabase exit PRD](specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md)
- [Initial model and policies](../supabase/migrations/202610080001_initial_schema.sql)
- [Slug aliases](../supabase/migrations/202610080002_publish_and_slugs.sql)
- [Immutable publications](../supabase/migrations/202610080005_immutable_publications.sql)
- [Card manufacturing/idempotency](../supabase/migrations/20261008171345_external_printer_batches.sql)
- [Publication media privacy](../supabase/migrations/20261024021635_publication_media_privacy.sql)
- [Internal admin capabilities](../supabase/migrations/20261024020834_internal_admin_capabilities.sql)
- [Current database contracts](../supabase/tests/)
