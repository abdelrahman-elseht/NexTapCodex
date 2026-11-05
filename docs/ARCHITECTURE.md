# Repository architecture

NexTap is a Next.js App Router modular monolith. The source tree is organized by runtime role first, then by domain.

## Where code belongs

| Path | Responsibility |
| --- | --- |
| `src/app/` | URL routes, layouts, route handlers, loading and error states. Keep UI used by one route in a nearby `_components/` folder. |
| `src/components/ui/` | Small reusable interface primitives such as branding, submit controls and confirmation controls. |
| `src/components/admin/` | Reusable owner dashboard controls and inventory UI. |
| `src/components/business/` | Public business-page rendering and payment/social/media presentation. |
| `src/lib/business/` | Business content, provider rules, draft/editor helpers and public publication reads. |
| `src/lib/cards/` | Permanent card URLs, QR codes and manufacturing exports. |
| `src/lib/admin/` | Helpers shared by owner business and card administration, including pagination and card inventory query/loading. |
| `src/lib/auth/` | Owner authorization and identity checks. |
| `src/lib/media/` | Image inspection, preparation, optimization and storage. |
| `src/lib/supabase/` | Supabase adapters for server, public and middleware clients. |
| `src/lib/observability/` | Sentry sanitization and operation telemetry. |
| `src/lib/config/` | Environment and startup configuration guards, including Staging/Production project mapping. |
| `supabase/migrations/` | Ordered database migrations. |
| `supabase/tests/` | SQL contract and security tests. |
| `tests/unit/` | Vitest tests for library modules and route handlers. |
| `tests/e2e/` | Browser journeys run by the e2e runner. |
| `scripts/database/` | Seed and database verification scripts. |
| `scripts/media/` | Media maintenance scripts. |
| `scripts/observability/` | Performance and observability lab scripts. |
| `docs/` | Product specs, handovers, implementation notes and research. |
| `assets/` | Source artwork and design references; runtime-served files belong in `public/`. |
| `artifacts/` | Generated screenshots and QA evidence. |

## Import and placement rules

- Use the `@/*` alias for imports from `src/`; it resolves to `src/*`.
- Keep route-specific modules in the route segment. Prefix non-route folders with `_` so Next.js does not treat them as route segments.
- Put reusable behavior behind a small domain interface in `src/lib/<domain>/` instead of duplicating it in route files.
- Keep browser-only modules in `src/components/` or a route `_components/` folder and keep server actions/route handlers in `src/app/`.
- Add new unit tests under `tests/unit/` and browser tests under `tests/e2e/`; do not mix generated evidence with source tests.
- Keep root-level files for repository configuration and discovery (`next.config.ts`, Sentry configs, test/build configs, `README.md`, `AGENTS.md`, and environment examples). Next.js middleware and instrumentation live directly in `src/` beside `src/app/`.

## Common change paths

- Public business rendering: `src/app/b/[slug]/` → `src/lib/business/public-publication.ts` → `src/components/business/public-snapshot.tsx`.
- Owner business editing: `src/app/admin/businesses/` and its `_components/` folder → `src/lib/business/`.
- Card inventory/manufacturing: `src/app/admin/cards/` → `src/lib/admin/card-inventory.ts` for owner query parsing, listing and pagination → `src/lib/cards/` for permanent URLs and manufacturing output.
- Managed images: `src/app/api/admin/media/` → `src/lib/media/`.
- Auth/session: `src/app/auth/`, `src/lib/auth/`, `src/lib/supabase/`, and `src/middleware.ts`.

- Owner editor transport: `src/app/api/admin/businesses/draft/route.ts` receives the editor's same-origin JSON save/publish requests; `src/app/admin/businesses/draft-actions.ts` validates and persists them.
- Capability mapping: `src/lib/auth/owner.ts` enforces the internal admin role, while `src/lib/config/environment.mjs` owns the Staging/Production project mapping.

## Current workflow and trust boundaries

| Workflow | Route and domain path | Data/security boundary | Evidence |
| --- | --- | --- | --- |
| Owner edits and publishes a business page | `src/app/admin/businesses/[id]/` and `src/app/api/admin/businesses/draft/route.ts` -> `src/app/admin/businesses/draft-actions.ts` -> `src/lib/business/draft.ts`, media helpers and `save_contact_draft` RPC | Same-origin write route; `requireOwner("edit"/"publish")` checks the authenticated subject against `owner_users` and `admin_has_capability`; expected page/business revisions reject stale writes. Supabase RLS and the RPC perform the durable write. | `tests/unit/draft-route.test.ts`, `draft-compatibility.test.ts`, `editor-save.test.ts`, `editor-isolation.test.ts`; `tests/e2e/business-editor-actions.e2e.ts`, `phase5-incremental-saves.e2e.ts`; `supabase/tests/phase5-incremental-saves.sql`, `phase123-contracts.sql`. |
| Public business page | `src/app/b/[slug]/page.tsx` -> `src/lib/business/public-publication.ts` -> anonymous `src/lib/supabase/public.ts` RPCs -> `src/components/business/public-snapshot.tsx` | Public client has no owner cookie/session. Slugs are validated and rate limited. The live pointer RPC admits only active business/page state and the current published snapshot; drafts remain inaccessible. | `tests/unit/public-publication.test.ts`, `tests/unit/payment-public.test.ts`, `tests/e2e/public-journey.e2e.ts`, `tests/e2e/public-security.e2e.ts`, `supabase/tests/phase6-publication-cache.sql`, `supabase/tests/preprod-publication-security.sql`. |
| Owner card inventory | `src/app/admin/cards/page.tsx` checks the owner session and renders; `src/lib/admin/card-inventory.ts` validates query values, reads batches/cards/pages, applies stable cursor ordering and determines assignment eligibility. | The route still requires the internal owner allowlist. The loader receives that authenticated client; untrusted filter values are normalized before PostgREST filters. Only active business pages with an active page and current published snapshot are eligible for a new assignment. | `tests/unit/card-inventory.test.ts`, `tests/unit/pagination.test.ts`, `inventory-api.test.ts`, card assignment/manufacturing tests; `tests/e2e/owner-cards.e2e.ts`, `owner-card-journey.e2e.ts`, `admin-no-reload.e2e.ts`. |
| Card QR/NFC resolution | `src/app/c/[token]/route.ts` -> anonymous `resolve_card` RPC -> active assignment redirect; contact download uses `src/app/c/[token]/contact.vcf/route.ts` -> `src/lib/business/contact-download.ts` | Token shape and request rate are bounded. Resolution exposes the currently assigned public page, not inventory details; contact export rechecks current publication/assignment. Owner inventory, assignment and deletion paths require capability checks. | `tests/unit/card-route.test.ts`, `card-assignment-route.test.ts`, `contact-download.test.ts`; `tests/e2e/card-state.e2e.ts`, `owner-card-journey.e2e.ts`, `public-security.e2e.ts`; related card/inventory SQL contracts. |
| Owner authentication and authorization | `src/app/auth/` and `src/middleware.ts` -> `src/lib/supabase/proxy.ts`, `src/lib/supabase/server.ts` -> `src/lib/auth/owner.ts` | Middleware refreshes cookies for protected route groups. `requireOwner` validates claims, internal allowlist membership and, for writes, a named capability. Do not equate a valid Supabase user with an authorized internal owner. | `tests/unit/auth-session.test.ts`, `environment.test.ts`; `tests/e2e/auth-refresh.e2e.ts`, `non-owner-access.e2e.ts`; Supabase RLS/security SQL tests. |
| Media upload and delivery | `src/app/api/admin/media/route.ts` -> `src/lib/media/optimize.ts`, `store.ts`; reads through `src/app/api/media/[...path]/route.ts` and `src/lib/media/read-object.ts` | Upload is same-origin, owner/capability checked, rate and byte limited, optimized, and stored through the authenticated Supabase client. Delivery validates the managed path; public published objects get short public caching, while unpublished objects require an authenticated session and return private no-store. The handler is explicitly Node runtime. | `tests/unit/media-upload-route.test.ts`, `media-prepare.test.ts`, `media-store.test.ts`, `private-media-route.test.ts`, `read-managed-object.test.ts`; `tests/e2e/media-upload.e2e.ts`, `media-rendering.e2e.ts`. |

### Public publication read behavior

`src/app/b/[slug]/page.tsx` is `force-dynamic`. `getPublicPublication` shares the render/metadata promise with React request caching and maintains a bounded process-local slug cache for five seconds (256 entries, at most 32 in-flight resolutions). On a cache miss it calls `get_publication_pointer` through the anonymous client. A valid publication UUID then loads an immutable snapshot through Next's `unstable_cache` keyed by publication ID with `revalidate: false`; the live pointer is still consulted to discover the current publication after the short slug window. If the phase-6 pointer RPC is absent, the process remembers that capability miss and uses the `get_published_page` compatibility fallback, cached for five seconds. A cold snapshot/pointer miss can also use that fallback. Rate-limit exhaustion and malformed slugs return no publication.

The phase-6 SQL functions independently require an active business, an active page, and the page's current `published_snapshot_id`; aliases resolve through `page_slug_aliases`. Superseded, unpublished, disabled or archived content must not become public because a snapshot is immutable or cached. These are local source/database contracts, not proof of current hosted Staging RPC availability or a zero-Supabase-read design.

## Risk candidates from current responsibilities

| Candidate | Change risk and evidence to preserve | Existing focused evidence |
| --- | --- | --- |
| `src/lib/business/public-publication.ts` and phase-6 publication SQL | Cache key/freshness, compatibility fallback, alias resolution and live revocation eligibility span framework cache behavior and database security. A refactor must preserve pointer-on-miss, active/current checks and recovery behavior. | `tests/unit/public-publication.test.ts`; phase-6 and pre-production publication security SQL tests. |
| `src/app/admin/cards/page.tsx` and `src/lib/admin/card-inventory.ts` | Route owns owner authorization and presentation; the loader owns query normalization, database selection, cursor pagination and eligible-page shaping. Keep authorization in the route and preserve selected-batch visibility, URL filters, page ordering and assignment eligibility. | `tests/unit/card-inventory.test.ts`, `pagination.test.ts`, `inventory-api.test.ts`, card assignment/manufacturing tests; owner-card, owner-card journey and admin no-reload browser tests. |
| `src/lib/business/providers.ts` | Provider normalization, destination strategies and payment/deep-link safety are shared by editing and public rendering. A rule change can alter external destinations across many provider types. | `tests/unit/providers.test.ts`, `delivery-providers.test.ts`, `payment-public.test.ts`, `provider-item-editing.test.ts`; provider-links journey. |
| `src/lib/cards/card-manufacturing.ts` | Stable serial/token/QR/NFC exports are a manufacturing contract; edits affect physical cards and vendor-facing files. | `tests/unit/card-manufacturing.test.ts`; `tests/e2e/card-manufacturing.e2e.ts`. |
| `src/app/api/admin/media/route.ts` and managed media helpers | Authorization, request-size limits, image processing and storage writes have different failure/recovery behavior; uploads and public/private cache policy must remain aligned. | Media upload/store/prepare unit tests, private media route test and media upload/rendering browser journeys. |

These are candidates for review, not an instruction to split them. Task 1.5 should select a slice only when a specific responsibility boundary, test seam and mutation evidence support the change. File length alone is not a risk argument.

## Gradual target boundaries

- Keep URL parsing, request/response semantics, framework caching and route-only orchestration at their existing route/framework edges. Move shared domain rules only when a second caller or meaningful test seam exists.
- Keep public reads on the anonymous Supabase client and owner writes on the authenticated server client with explicit capabilities. Any future provider/cache boundary must preserve the current live eligibility, freshness, alias and revocation contract.
- Keep media transformation/storage adapters separate from route validation only when the existing domain helpers own the behavior; do not introduce a generic provider layer ahead of a real second implementation.
- Keep card manufacturing formats and token resolution as separate responsibilities: physical QR/NFC output and live database assignment have distinct contracts.

Task-specific code placement, imports, budgets, deprecation and removal rules belong in [`docs/CODEBOOK.md`](CODEBOOK.md), added in Phase 1 Task 1.2.
