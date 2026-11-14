---
Status: approved contracts recorded; physical schema remains subject to the listed review gates
Owner: NexTap Core engineering
Supersedes: none
Path globs: ["infra/cloudflare/d1/**", "tests/fixtures/phase1-d1/**", "tests/unit/phase1-d1-schema.test.ts"]
Topic tags: cloudflare, d1, schema, migration, parity
---

# Phase 1 D1 Schema Decisions

This record captures approved Phase 1 contracts and their physical representation. It is not owner approval of the complete schema or data-import contract. Migrations `0001_phase1_core_schema.sql`, `0002_permanent_slug_aliases.sql`, and `0003_approved_page_publication_contracts.sql` are applied to development and staging; keep them immutable. Migration `0003` adds the approved page-level Menu flag.

## Approved owner decisions

- Preserve the owner-approved profile link contract at `/b/{slug}/menu`. This supersedes conflicting URL wording in the Landing Delivery PRD, which has not been revised. The Menu application remains separate. Phase 1 does not implement a Menu page, menu data, or a Core runtime dependency.
- Every existing profile slug and direct-profile QR/NFC destination must continue resolving to the same profile indefinitely. This supersedes the conflicting post-cutover retention clause in the Landing Delivery PRD. A historical slug remains an alias to its original page and is never reassigned. This does not change tokenized card routes.
- Recovery objective: RTO is 4 hours. This schema record does not claim the objective has been measured or proven.
- RPO is owner-approved at a maximum of 24 hours of data loss. Backup capability and operational attainment of this objective remain unproven pending a representative restore rehearsal and validation of backup cadence.
- `has_menu` is page-level state, defaults to false, and is copied into each immutable publication snapshot as `page.hasMenu`.
- The version-1 contact projection is stored only inside each immutable publication snapshot. It contains published contact values, never a separately indexed or mutable projection; draft contact configuration remains page state.
- Staff capabilities are global and initially match legacy roles: administrator=`read, edit, media, publish, inventory, export, delete`; publisher=`read, edit, media, publish`; editor=`read, edit, media`; inventory=`read, inventory, export`; auditor=`read`. Unknown/unadmitted staff and unknown roles are denied. Every business operation must name an explicit business target.

## Physical model candidate

Migration `0001` uses application-supplied text IDs and timestamps, relational foreign keys, uniqueness constraints, stable-state checks, and query indexes. It covers businesses, pages/branches, ordered draft sections, slug ownership, immutable-publication metadata, media references, card batches/cards/assignment history, audit events, and idempotency receipts. JSON is stored as validated text with candidate byte limits. `0002` constrains slug registry rows to `canonical` or `alias`; historical aliases have no expiry field and are retained as resolvable rows.

The SQL has no triggers or stored procedures. Application services must implement authorization, alias creation on rename, publication verification and activation, append-only publication/card/audit history, revision conflict handling, idempotency semantics, and cross-service D1/R2/KV coordination. SQL constraints provide integrity checks; they do not make rows immutable against a privileged application writer.

## Legacy parity facts

- Businesses/pages have stable UUID identities; slugs are route addresses. Branch pages belong to a business and may reference a parent page.
- Legacy slug rename records the previous slug against the same page and rejects collisions. Owner decision now fixes retention to indefinite and forbids reassignment.
- Draft writes validate revisions and commit related changes atomically. The D1 candidate carries revisions, but the transaction and conflict behavior belongs to application services.
- Publication versions are immutable in the legacy behavior; a page points to its active version. D1 has publication IDs, versions, snapshot/manifest metadata, and a same-page composite pointer reference. Immutability requires an application service contract because SQL triggers are out of scope.
- Cards have stable IDs, unique tokens and serials, lifecycle state, optional page assignment, and assignment history. The candidate has these records and their basic integrity constraints; valid transition rules remain application-owned.
- Contact download content is derived from published contact values, not drafts. The approved version-1 projection lives only in each publication snapshot.
- Legacy staff identity is provider-authenticated and allowlisted with capabilities. The approved initial capability set matches the legacy role matrix above; business operations require a specific business target.

These facts are sourced from `docs/research/PHASE_1_LEGACY_PARITY_INVENTORY.md` and its cited legacy migrations/tests. They establish parity requirements, not approval of this physical layout.

## Remaining review gates

- Content contract: confirm section kinds, JSON field shapes and size bounds, slug normalization/length, timestamp representation, publication manifest shape, and stable-ID serialization against migration inputs.
- Retention: approve audit and idempotency receipt retention and the archival/export policy for historical records.
- Enforcement boundary: application-service tests must prove rename creates and preserves aliases, publication/card history is append-only, and authorization is enforced. Direct SQL constraints cannot enforce these workflow guarantees without triggers or restricting all writers to a service boundary.
- Recovery: the 4-hour RTO and 24-hour maximum RPO are owner-approved objectives, but neither is operationally proven. A representative rehearsal with explicit start/end boundaries and evidence that backup cadence can meet the RPO is still required.

No production schema or data operation is authorized by this record. Any change to an applied migration must be made in a new numbered migration and reviewed before application.
