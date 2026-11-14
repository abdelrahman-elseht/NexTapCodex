# NexTap Codebook

This is the product and domain reference for NexTap Core. It defines the words, entity relationships, URL meanings, and invariants used by source code and migration documents. It describes current product behavior separately from approved Cloudflare target decisions; it does not claim future-phase behavior is implemented. For code ownership see [Repository Architecture](docs/ARCHITECTURE.md); for persistence and integrity see [Data Model](docs/DATA_MODEL.md); for target requirements and gates see the [Landing Delivery PRD](docs/specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md).

## Product Boundaries

| Term | Meaning |
| --- | --- |
| **NexTap Core** | The staff-operated product for managing businesses, public pages, publications, and NFC/QR cards. The current application uses Next.js and Supabase; Cloudflare is the active migration target. |
| **Menu** | A separate menu and ordering product. Core owns only whether a page exposes a Menu link and the link contract; it does not own Menu data, authentication, orders, or runtime behavior. |
| **NexTap staff** | Internal authorized administrators who manage Core records and card inventory. Business-owner self-service is outside the current product contract. |

## Identity and Public Content

| Term | Meaning and relationship |
| --- | --- |
| **Business** | An organization with a stable internal business ID. Its identity does not change when its name, page content, or public slug changes. A business may have a main page and branch pages. |
| **Business ID** | The stable opaque identifier used to refer to a business across administration and migration. It is not a public route. |
| **Page** | A public-facing profile owned by one business. A page has a page ID, type/template, lifecycle state, current editable draft, canonical slug, and optional active publication. A business can own multiple related pages. |
| **Branch page** | A page for a branch/location that belongs to the same business identity and may refer to a parent/main page. It has its own page identity and public slug. |
| **Slug** | A normalized human-readable route address such as `/b/{slug}`. A slug is globally reserved routing state, not a business or page identity. |
| **Canonical slug** | The current primary slug for a page. It resolves to that page while the page is eligible for public display. |
| **Slug alias** | A historical slug that resolves to the same page after rename. It is not a second page and must never be assigned to another page. The owner-approved Phase 1 target decision keeps historical aliases indefinitely. |
| **Draft** | Mutable editable page content. It can include ordered/enabled sections and media references. Draft content is private to authorized staff and must not be served as public content. |
| **Publication** | A complete visitor-visible version produced from a page's draft by a publish action. A publication is immutable and versioned; later edits create another publication. The active page pointer selects which publication is public. |
| **Publication snapshot** | The self-contained public projection of a publication: the approved profile fields, enabled sections in saved order, contact projection, language/direction, media references, and `has_menu` value. It must not require a Menu request to render. |
| **Page state** | Administrative lifecycle state such as active, disabled, or archived. Draft state and publication state are distinct; an existing snapshot does not make an ineligible page public. |

## Cards and URL Contracts

| Term | Meaning and relationship |
| --- | --- |
| **Card** | A physical NFC/QR item represented in Core inventory. It has a stable token and may have a serial, batch, lifecycle state, and assignment history. |
| **Card token** | The stable identifier in a token-based `/c/{token}` URL. It identifies the card, not its current business/page destination. Assignment and activation state determine the eligible destination. |
| **Card assignment** | The historical and current association between a card and an eligible page. Reassignment changes the card's current destination without changing its token URL. Assignment history remains part of manufacturing/audit parity. |
| **Token card URL** | `/c/{token}`. Resolution uses current card state and current eligible assignment. Invalid, unassigned, disabled, inactive, replaced, and otherwise unavailable states keep their distinct branded behavior where the current product contract requires it. |
| **Direct-profile URL** | `/b/{slug}` embedded directly in a QR/NFC item. It has no card-token indirection. After a rename, its historical slug must continue resolving to the same page indefinitely under the owner-approved Phase 1 decision; it is never reassigned. |
| **Contact VCF URL** | A downloadable contact representation associated with a supported profile/card entry point. Preserve the established `/b/{slug}/contact.vcf` and `/c/{token}/contact.vcf` contracts and their privacy behavior through migration. |

## Menu Contract

The approved target contract defines `has_menu` as a Core-controlled boolean stored on the page and copied into the public publication snapshot. When false, the target profile has no Menu action. When true, the owner-approved Core profile link is `/b/{slug}/menu`. This Phase 1 decision supersedes conflicting PRD wording; the PRD has not yet been edited. The field exists in the Phase 1 D1 schema, but the current Supabase-backed profile does not yet implement this publication behavior. Phase 1 records the decision and schema field only. It does not implement the Menu page, Menu product, static publication, or Core-to-Menu runtime calls. Menu remains separately deployed and owns its own content and ordering behavior.

## Relationships and Lifecycle

1. A business owns one or more pages; a page can represent a main location or a branch.
2. A page owns mutable draft state and may point to one active immutable publication.
3. A publication is created from the draft. Public rendering uses the publication projection, never unsaved draft data.
4. A canonical slug identifies the current route. Renaming reserves the old slug as an alias to the same page; canonical and alias slugs share one uniqueness namespace.
5. A card has a stable token and a changeable assignment. A token route resolves current eligible assignment; a direct-profile route remains tied to its printed slug.
6. The current implementation stores these records in Supabase. The migration target uses D1 for mutable Core records, R2 for immutable publication artifacts/media, and KV only as a non-authoritative bounded lookup cache. These target stores do not change the domain meanings above.

## Current and Target Authority

| Question | Current behavior evidence | Cloudflare target authority |
| --- | --- | --- |
| Exact current fields, constraints, RLS, and RPC behavior | `supabase/migrations/`, `supabase/tests/`, and current adapters under `src/lib/` | Approved target contract in the active PRD and phase-approved records; candidate D1 migrations are not complete schema approval. |
| Route rendering and administration | `src/app/`, `src/lib/business/`, `src/lib/cards/`, and mapped tests in `tests/` | The PRD plus the current phase's execution/closeout record. |
| Historical aliases and Menu link | Existing source/tests show legacy behavior; see the Phase 1 parity inventory | Owner-approved `/b/{slug}/menu` and indefinite non-reassignable aliases in [Phase 1 execution spec](docs/specs/NEXTAP_PHASE_1_EXECUTION_SPEC.md). |
| Whether a migration phase passed | Never infer from this vocabulary reference | Phase evidence and the relevant exit review linked from [docs index](docs/README.md). |

Use **page** for the editable/profile entity and **publication** for the immutable visitor-visible version. Use **business ID** for identity and **slug** for routing. Do not use “card URL” without specifying token-based `/c/{token}` or direct-profile `/b/{slug}`.
