---
Status: approved-scope / active Cloudflare migration target; implementation not started
Owner: abdelrahman-elseht
Supersedes: none
Path globs: ["src/app/b/**", "src/lib/business/**", "src/lib/cards/**", "src/lib/media/**", "workers/**", "infra/cloudflare/**", "supabase/**"]
Topic tags: migration, cloudflare, landing, database, media, cards
---

# NexTap Landing Delivery and Supabase Exit

**Status:** Active migration direction; target implementation and cutover have not started
**Owner:** abdelrahman-elseht
**Date:** 2026-11-12
**Scope:** NexTap Core business profiles, internal administration, cards, and media. The Menu & Ordering application remains a separate product.

## Executive Brief

NexTap business pages are simple mobile profiles, but the current public route renders dynamically through Vercel and reads published data from Supabase. In a fresh Chrome profile on Slow 3G with 4× CPU slowdown, `/b/abdelrahman` measured 10.88 seconds LCP and 2.17 seconds TTFB. The reported real-world visit was about 16 seconds. The current request returned `Cache-Control: private, no-cache, no-store`, and Vercel reported a cache miss.

This project replaces Supabase across the Core application while making published profiles static at the point of delivery. D1 will hold canonical mutable admin records; business rules and authorization will live in application code; R2 will hold immutable publication output and public media; KV will cache slug/version lookups only on fallback paths. A warm profile request must be served as a static/CDN response without a database query or Worker execution. Existing profile, card, QR/NFC, contact-download, and media URLs must keep working through a zero-downtime migration.

## Problem

**Customer problem:** A customer opening a business profile from a QR code, NFC card, or shared link waits too long to see basic business information and contact actions, especially on a weak mobile connection.

**Business problem:** Public pages depend on a dynamic application route and Supabase. The internal team also depends on Supabase Auth, Postgres RPCs and RLS, and Supabase Storage for administration, publishing, cards, and media. NexTap wants to operate this product on Cloudflare while keeping public delivery fast, affordable, and independent of database availability.

The available evidence points to both origin and asset delays. In the cold synthetic run, TTFB was 2.17 seconds. The 58 KB cover image was the LCP element and took 6.12 seconds to download. The page transferred approximately 355 KB across 32 requests, including about 157 KB of JavaScript and 75 KB of fonts. Compressed HTML was about 7.3 KB, already under the proposed 15 KB budget. Replacing the database alone will not address the image and request waterfall.

## Why Now

- The current public business route is dynamic and does not have a public CDN cache policy.
- Warm browser caching improved FCP from 7.20 seconds to 2.27 seconds, but TTFB remained about 2.16 seconds because the HTML was still uncached.
- Current managed media is routed through a Next.js endpoint with a 60-second cache policy, cookie/router variation, and observed Vercel cache misses.
- The AVIF upload path accepts AVIF, while the current publication media registration logic excludes AVIF paths. The migration must correct this contract and verify it with real files.
- The current product already has immutable publication snapshots and stable card tokens. Those concepts can be retained while moving ownership to D1 and R2.

The performance run is one synthetic lab sample, not a field percentile. The first phase will repeat it across representative profiles and devices before the release target is treated as a production SLO.

## Audience and Core Journeys

**Business customer:** Opens `/b/{slug}` or scans/taps a card. Sees the business identity, hours, and primary contact actions immediately; follows phone, WhatsApp, directions, reviews, menu, payment, or social links.

**NexTap internal admin:** Creates or edits a business and its pages, previews unpublished work, publishes changes, manages branches, cards, batches, assignments, exports, and media. Business owners do not directly administer these pages.

**Manufacturing operator:** Uses batch exports, QR assets, and NFC manifests. Permanent card tokens must continue resolving to the current active page.

**Menu customer:** Follows a menu link from the profile to the separately deployed Menu & Ordering application. The profile renderer does not query Menu data or call the Menu Worker.

## Goals

1. Make public profile visits independent of Supabase and database availability.
2. Serve a warm profile request as static/CDN content without running application code for that request.
3. Remove Supabase Auth, database, RPC, RLS, and Storage dependencies from NexTap Core after migration and rollback gates pass.
4. Preserve published profile behavior, existing URLs, QR/NFC tokens, media references, contact downloads, and internal admin workflows.
5. Support 100 to 10,000 businesses without introducing a database query into the public profile path.
6. Make routine publication, slug changes, deactivation, rollback, and media updates operationally measurable.
7. Connect to the Menu product using a published availability flag and stable URL/identifier, with no runtime dependency between the products.

## Non-Goals

- Rebuilding Menu & Ordering, its authentication, its database, or its ordering flows.
- Adding visitor analytics or click tracking as part of this migration.
- Supporting business-owner self-service profile administration.
- Replacing all Vercel-hosted NexTap marketing pages unless needed to preserve routes or DNS behavior.
- Introducing D1 sharding, Redis, Durable Objects, or another database without measured evidence that the selected design cannot meet its gates.
- Claiming that the migration alone fixes the reported 16-second visit; image delivery and client payload must also meet the performance gates.

## Product and Architecture Principles

- The published profile is a read model generated when content changes, not rendered from drafts on each visit.
- D1 is the authority for mutable business, page, slug, card, and admin state. D1 stores constraints and indexes; business rules do not live in SQL procedures or triggers.
- KV is a non-authoritative cache for slug/version data on Worker fallback paths. A direct static/CDN hit does not consult KV. KV must not control revocation, card status, or canonical slug ownership.
- R2 stores revisioned publication output and content-hashed public media. Published objects are immutable.
- Public HTML and media use Cloudflare static/CDN delivery. The Workers Cache API alone does not satisfy the warm-hit requirement.
- Drafts, originals, credentials, admin endpoints, and private exports are not public cache content.
- Arabic RTL and English LTR remain supported. Public content and primary actions remain usable without JavaScript.
- Existing public URLs stay valid. Old business slugs remain aliases according to a product-approved retention rule.

## Success Measures

The “baseline” column is the single synthetic test from 2026-11-12. Targets below are proposed release gates and must be validated on repeated runs and representative real devices before production rollout.

| Measure | Baseline | Proposed release gate |
| --- | --- | --- |
| Cold LCP, 390×844, Chrome Slow 3G, 4× CPU | 10.88 s | p75 at or below 5.0 s |
| Warm LCP, same lab profile | Not separately measured | p75 at or below 3.0 s |
| Public HTML TTFB | 2.17 s cold and warm | p75 at or below 500 ms on a CDN hit |
| Profile HTML response | `no-store`, Vercel `MISS` | Static/CDN `HIT`; zero Worker invocations on a warm hit |
| Compressed HTML | 7.3 KB | At or below 15 KB; no regression from current page |
| Requests before/through LCP | 32 total | At or below 15, with no third-party requests |
| Mobile cover derivative | 58 KB; 6.12 s download | At or below 35 KB for the tested mobile size, subject to image-quality review |
| First-load JavaScript | About 157 KB across 11 resources | No hydration needed for core profile content/actions; defer optional interactions until needed |
| Public DB access | Supabase RPC on dynamic route misses | Zero D1/Supabase access on all profile visits |
| Data/URL parity | Approved functional fixtures and exported migration manifest | Active pages, aliases, card states, contact files, and media references satisfy the same user-facing contract |
| Rollback | Existing Vercel/Supabase deployment | Keep a 30-day recovery target and rehearse restoration, accounting for Free-plan pause behavior |

Additional field measures: p75 FCP/LCP/INP/CLS, image bytes before LCP, edge cache-hit ratio, cache-miss rate, Worker invocations by route, publish-to-visible time, card deactivation time, error rate, 404/alias rate, D1 read/write load, and monthly R2/KV/Worker usage. No monthly cost total is asserted until traffic and retention are measured.

## Product Requirements

### Public Profiles

**P0** The stable `/b/{slug}` URL returns a complete published page with metadata, business identity, enabled sections in saved order, and primary actions.

**P0** A warm profile request is served as static/CDN content. It does not execute a Worker, query D1/KV/Supabase, or invoke an application origin. The routing spike in Phase 0 must prove this against the real custom hostname and `/menu/*` route.

**P0** Public profile content preserves the existing feature set: cover/logo, name/category/tagline, phone and WhatsApp, location and hours, reviews, social links, externally provided payment information, services, gallery, branches, and the current interactive payment details. No page implies NexTap processes payments.

**P0** Core content and links work without client-side hydration. Optional interactions may load a small script on user action, but must not delay the first content render.

**P0** Unknown, unpublished, inactive, or invalid slugs return a branded recovery state and reveal no draft or internal data.

**P0** The public page supports Arabic RTL and English LTR, touch-sized actions, keyboard focus, and the supported viewport range from 320 px through desktop widths.

### Publishing and Freshness

**P0** Publishing validates a complete draft, verifies media, writes a new immutable publication version, and only activates it after all referenced output exists.

**P0** Failed publication leaves the previous live version available. A rollback can reactivate a prior immutable publication without rebuilding source content.

**P0** Routine publication and slug changes become visible within five minutes. Slug changes create a new canonical route and preserve all prior URLs as aliases through migration and cutover; post-cutover retention or expiry is an open product decision. Do not implement automatic expiry before approval, and never reassign a historical slug, including after expiry. Takedown becomes visible within one minute.

**P0** Unpublish/deactivation and takedown have an explicit maximum stale period. D1 is authoritative; a stale KV value must not keep an inactive or deleted profile live beyond that approved period.

### Menu Directory Integration

**P0** The published profile contains a boolean `has_menu` value controlled by NexTap Core admin, plus the stable Core business identifier and current slug required by the Menu integration.

**P0** When `has_menu` is true, the profile renders a normal link to the agreed `/menu/{businessSlug}` route. When false, no menu action appears.

**P0** Profile rendering makes no request to Menu storage, APIs, authentication, or Worker. Menu route and asset routing must coexist with `/b/{slug}` on the shared hostname.

### Media and Contact Files

**P0** Public media is delivered from `media.nextap.services` backed by R2/CDN with content-hashed immutable names. Public cache responses do not vary by cookies or Next.js router headers.

**P0** Uploads are validated from file bytes and bounded by file size, dimensions, pixel count, and supported format. Public derivatives are optimized for mobile display; private originals and draft uploads remain private.

**P0** WebP is the default compatible output. AVIF is retained only where browser coverage, content type, fallback, and real-device decode tests demonstrate value. Existing AVIF publication gaps are corrected.

**P0** “Add to Contact” preserves `/b/{slug}/contact.vcf` and `/c/{token}/contact.vcf` behavior. Files contain only published contact fields, use valid VCF syntax and UTF-8, and use suitable attachment/cache headers.

### Cards and QR/NFC

**P0** Preserve both existing QR/NFC URL forms: token routes (`/c/{token}`) and direct-profile routes (`/b/{slug}`). Token routes retain their token and resolve active assignments to the current eligible published page; unassigned, inactive, invalid, and disabled cards show the existing branded unavailable state. Direct-profile URLs have no token mapping, so their original slug remains reserved as the canonical slug or an alias to that same business page through migration and cutover. The post-cutover retention period is an open product decision; do not implement automatic expiry before approval, and never reassign a historical slug to another business.

**P0** Admin card workflows preserve search, batch creation, QR previews, ZIP/CSV exports, assignment/reassignment, deactivation, assignment history, and copyable NFC/QR links.

**P0** Card deactivation is visible within one minute; reassignment is visible within five minutes. KV is not the sole authority for a card status transition.

### Internal Administration and Data

**P0** The internal team can create businesses/pages, edit settings and ordered sections, preview drafts, publish, manage branches, upload images, and inspect current publication state.

**P0** Admin authentication remains restricted to authorized NexTap staff through Cloudflare Access on the dedicated `admin.nextap.services` hostname and an approved identity provider. Application-level authorization still determines which admin actions each authenticated staff member may perform. Sign-out, MFA/recovery expectations, and denial of non-admin users must be verified in staging. Create the Access application and record its generated audience only after the admin route is established in staging.

**P0** D1 is the canonical mutable store for businesses, pages, drafts, slug aliases, cards, assignments, audit records, and publication metadata. Application services own authorization and business rules.

**P0** No workflow depends on Supabase Auth, Postgres, RPC, RLS, or Storage after final cutover. Data export/import is idempotent and repeatable until the final reconciliation.

## Phased Delivery Plan

Each phase has an exit gate. Do not route production traffic to the next phase while a gate is failing. Calendar estimates are intentionally omitted; phase completion depends on evidence, not a guessed duration.

### Phase 0 — Baseline and Routing Proof

**Outcome:** Confirm the performance cause and prove the route architecture before migration work enters production.

**Work:** Repeat cold/warm measurements on multiple representative profiles (large cover, no cover, gallery, Arabic, menu-enabled), capture an actual low-end Android/local mobile-network run, and measure page, media, and card flows. Build disposable Cloudflare routes and objects to test static delivery for `/b/{slug}`, direct media delivery, cache purge, slug updates, `/menu/*` coexistence, and actual Worker invocation counts.

**Exit gate:** A warm `/b/{slug}` hit returns static/CDN content with no Worker invocation and no D1/KV/Supabase request, while `/menu/*` still reaches the separate menu app. If this cannot be proven, pause and resolve the route design with the product owner before choosing a weaker guarantee.

### Phase 1 — Cloudflare Environments and Data Contract

**Outcome:** Create isolated development, staging, and production resources without changing production routing.

**Work:** Define D1 schema and application-level authorization boundaries; create D1, R2, and KV resources per environment; establish private/public media separation, service bindings, secrets, backups, logging, rate limits, and deployment gates. Define publication schema/version, `has_menu`, stable business identifier, slug aliases, contact projection, and card-state contracts.

**Exit gate:** Staging and production bindings are isolated; restore is rehearsed; migrations are repeatable; no production DNS or public route has changed; schema and URL contracts have owner approval.

### Phase 2 — D1 Migration and Internal Admin Replacement

**Outcome:** The NexTap internal team can operate Core data without Supabase.

**Work:** Inventory the business outcomes, authorization rules, records, card history, media metadata, and exports that must survive migration. Use the old schema and service behavior as migration reference material; do not mechanically port every RPC, policy, or database test. Import data to D1, gate the internal admin app with Cloudflare Access, retain application-level authorization for admin actions, and implement business logic in application services. Preserve required transactional behavior with short D1 transactions and idempotency; keep database constraints for integrity, not business procedures. Validate imports with approved manifests, counts, checksums, and focused functional fixtures.

**Exit gate:** Business/page edits, preview/publish administration, branch handling, user authorization, audit history, and supported card workflows pass isolated staging tests. Cross-tenant authorization tests pass. Imported data has no unexplained mismatch, and restore succeeds.

### Phase 3 — Static Publication and CDN Media

**Outcome:** Profiles and media are generated at publish time and served without a per-visit application path.

**Work:** Generate immutable HTML/snapshot versions and optimized image derivatives. Publish stable `/b/{slug}` files and aliases using the route proven in Phase 0. Move public images to `media.nextap.services`, set long immutable cache policies for hashed objects, and set short explicit freshness/purge behavior for mutable page URLs. Implement VCF output and the `has_menu` link contract. Correct AVIF registration and fallback tests.

**Exit gate:** Staging verifies every existing page shape, URL, image format, contact file, language, payment interaction, and menu state. Repeated edge requests show the expected static/CDN hit and do not invoke Worker or database code. Rollback to the prior publication is demonstrated.

### Phase 4 — Card and Manufacturing Parity

**Outcome:** Existing cards, QR codes, NFC tags, and manufacturing flows continue working against the new Core data.

**Work:** Replace card resolution, assignment/reassignment, activation/deactivation, batch creation, assignment history, inventory filters, and ZIP/CSV manufacturing exports. Keep public profile rendering separate from card resolution. Make token and serial migration idempotent and preserve existing token destinations.

**Exit gate:** Scanned/tapped active cards resolve to the expected current slug; disabled/unassigned cards show correct states within the approved freshness bound; exports match stored tokens; no old card URL is broken.

### Phase 5 — Canary, Cutover, and Rollback

**Outcome:** Traffic moves gradually with existing URLs intact and a tested recovery path.

**Work:** Backfill and reconcile final data, publish a complete production artifact set, inventory and classify every printed destination as `/c/{token}` or `/b/{slug}`, verify token assignments and reserve direct-link slugs, route a canary group, compare page output, headers, CDN hits, performance, media, contact files, card redirects, errors, and publish freshness. Expand traffic by measured gates. Retain the Vercel/Supabase rollback path for 30 days, subject to the Free-plan pause limitation; verify the recovery runbook and restoration time rather than promising uninterrupted availability.

**Exit gate:** Production acceptance metrics pass for the canary and broader rollout; no unresolved data or URL mismatch remains; rollback via route/origin switch is rehearsed; monitoring and owner runbooks are in place.

### Phase 6 — Supabase Decommission

**Outcome:** Supabase is no longer a runtime or deployment dependency for NexTap Core.

**Work:** Disable legacy writes after the rollback window, reconcile final deltas, export/archive data under the approved retention policy, remove Supabase credentials and packages, retire migrations/RPC deployment steps, and verify all environments point to D1/R2/KV and the approved identity provider.

**Exit gate:** Source and deployment scans find no Core runtime Supabase calls or secrets; auth, media, cards, audit, backups, and exports are owned by the replacement; production smoke and restore tests pass.

## Migration Test Strategy

Migration tests are organized around product behavior and Cloudflare runtime boundaries. Default CI does not run Supabase/PostgreSQL implementation suites, Vercel-hosted journeys, or measurements of legacy routes. Those scripts remain available only for an explicit rollback investigation. Do not add new tests whose sole assertion is that a legacy provider, policy, RPC, deployment, or hosting behavior still works.

For each phase, test domain behavior deterministically, exercise Worker/D1/R2/KV boundaries with isolated target fixtures, and run end-to-end URL, authorization, cache, publication, and recovery checks against Cloudflare-local or staging resources when the phase requires them. Data migration integrity is checked with approved export manifests, counts/checksums, schema validation, and business fixtures; it does not require a standing test connection to the legacy platform. Keep the user-visible URL, security, and recovery requirements below as the acceptance contract.

## Rollout and Recovery

- Production URLs remain unchanged. Use route-level canary or equivalent Cloudflare routing only after static delivery is proven in staging.
- Keep the old Vercel/Supabase path as the rollback target for 30 days. Supabase Free may pause low-activity projects after seven days, so this is a recovery target, not a guarantee of always-on rollback. Rehearse reactivation and measure its recovery time before cutover; preserve a verified export and deployment artifacts for recovery if the project is paused.
- Retain the five most recent immutable profile versions per business for immediate rollback. Content-hashed media can be shared across versions and retained independently.
- Publications are immutable. A failed publish keeps the previous version live; rollback selects a previous version and purges the stable URL.
- D1 backups and export/import restore are verified before D1 becomes the only writable source.
- No production DNS, data, or configuration changes occur during Phase 0 or Phase 1.
- Rollback triggers include elevated 404s, broken card routes, missing media, invalid publication output, authorization failure, data mismatch, or performance falling outside the agreed gate.

## Security, Privacy, and Reliability Requirements

- Separate admin and public route privileges, bindings, secrets, and deployment environments. Serve the admin application on `admin.nextap.services`; keep public profiles and Menu on their own host/path boundaries.
- Restrict admin access to NexTap staff through Cloudflare Access; separately enforce application-level authorization and cross-tenant access controls. Do not treat Access as a replacement for application authorization.
- Do not expose draft content, originals, credentials, card tokens, or admin exports through public buckets or cache keys.
- Validate uploads by bytes and resource limits; normalize and strip unsafe metadata from derivatives.
- Cache only public GET/HEAD output. Normalize slugs and reject untrusted host/query variations that could poison cache keys.
- Avoid logging contact data, auth tokens, full card tokens, or uploaded image content.
- Rate-limit card resolution, admin sign-in, uploads, and publishing. Public profile reads should not write to D1 or create per-visit logs.
- Monitor D1 busy errors, request failures, CDN cache status, stale publication versions, failed purge, storage growth, and restoration readiness.

## Dependencies and Assumptions

- Cloudflare controls DNS/edge for `nextap.services`; Hostinger remains registrar. The actual current request path observed in this audit is Vercel, so Cloudflare route/cache behavior must be demonstrated on the production hostname before cutover.
- The separate Menu repository specifies `/menu/{businessSlug}` and a stable Core business ID/slug for tenant identity. Core admin owns `has_menu`; the landing publication links to Menu without a runtime dependency or provisioning callback.
- The admin application is planned for `admin.nextap.services`, protected by Cloudflare Access. `CLOUDFLARE_ACCESS_AUD` is deployment-generated and remains unset until the staging Access application is created for that hostname.
- NexTap currently uses the Supabase Free plan. Supabase documents that low-activity Free projects may be paused after seven days; the 30-day rollback window therefore requires a tested reactivation/recovery procedure and cannot mean guaranteed always-on legacy availability without a plan change.
- Current route and schema evidence is from the repository and prior staging handoffs. Authoritative production counts and a verified export are required before capacity or migration sizing.
- Current observed profile HTML is about 7.3 KB compressed, but image, request, and latency budgets—not HTML alone—determine mobile performance.
- Initial platform budget assumes the $5/month Workers Paid plan and a $10/month total recurring platform spend review threshold. The threshold is a review trigger, not a hard availability cap. Supabase and Vercel are currently on Free plans during migration; any paid identity or service cost counts toward the same threshold. Actual spend depends on traffic, cache-hit ratio, media storage/retention, and other usage, which remain unknown.

## Decision Status

One product decision remains open: the retention/expiry policy for old business-slug aliases after a slug change. Keep aliases working through migration and cutover. Before implementing automatic expiry, the product owner must choose a retention duration or an indefinite-retention policy and update MIG-04 acceptance. Revisit the cost threshold after a month of measured usage or before adding a paid service.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Stable `/b/{slug}` cannot bypass Worker execution | Violates the explicit hot-path requirement | Prove routing in Phase 0; stop and return with concrete route options if it fails. |
| KV stale state serves a renamed, disabled, or deleted page | Stale public data or card routing | Keep D1 authoritative, bound TTL, purge, tombstone, and test the approved freshness SLA. |
| D1/R2/KV do not share a transaction | Partial publication or stale pointer | Stage immutable artifacts, verify manifests, switch pointer only after verification, reconcile, retain old version. |
| Auth replacement weakens existing access control | Admin data exposure or lost recovery path | Gate staff access with Cloudflare Access; test deny-by-default, MFA/recovery, logout, and application-level authorization. |
| Media migration preserves slow or uncached delivery | LCP remains poor after database migration | Optimize responsive derivatives, use direct R2/CDN, remove cookie variation, verify edge hits. |
| Required product behavior is missed in D1 port | Admin or manufacturing regressions | Map user outcomes and authorization contracts, reuse the story catalog, and run isolated D1/application behavior tests. |
| Menu path or deployment conflicts with Core routes | Menu link, assets, or auth break | Test shared hostname path routing and assets before route freeze. |
| Production traffic changes before rollback is proven | Downtime or broken QR/NFC links | Canary, preserve old origin, rehearse route rollback, keep URLs fixed. |
| Supabase Free pauses during the 30-day rollback window | Legacy rollback may need project reactivation before serving traffic | Rehearse reactivation and recovery timing; retain verified logical exports and deployment artifacts; do not claim always-on rollback on Free. |

## Definition of Done

- All phases pass their exit gates and owner decisions are resolved.
- Existing profile, slug alias, token-based and direct-profile QR/NFC URLs, contact VCF, public media, admin, and manufacturing contracts pass staging and production smoke tests.
- A warm `/b/{slug}` response is served statically without Worker execution or database access.
- Proposed performance gates pass on repeated cold/warm lab runs and representative real devices; field data is monitored after release.
- D1 authorization, backup/restore, rollback, and publication reconciliation are tested.
- The Menu application remains independent and is reachable through the agreed link contract.
- Supabase credentials, runtime dependencies, and deployment steps are removed only after the rollback window and final reconciliation are complete.

## Source Documents

- [EGM concepts brief](../../concepts_brief.md)
- [Architecture audit and measured baseline](../research/LANDING_PAGE_CLOUDFLARE_MIGRATION_AUDIT.md)
- [NexTap product contract](../product/PRODUCT.md)
- [NexTap user and admin stories](USER_ADMIN_STORIES.md)
- [Supabase production readiness and Free-plan pause behavior](https://supabase.com/docs/guides/platform/going-into-prod)
