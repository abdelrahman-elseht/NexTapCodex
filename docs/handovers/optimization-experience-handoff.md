# NexTap optimization and experience handoff

Date: 2026-10-10
Branch: `beta01.6`
Baseline: `c28383a2a269b87cc5a10eb24ff1db9aa47e9edb` â€” Add provider payment actions and honor Quick Actions column settings

## Tasks checklist â€” start here

**Implementation status:** phases 1-5 are implemented in the worktree and verified against the isolated Supabase project through MCP. Keep this checklist current as work is verified; an unchecked item is still outstanding.

### Complete

- [x] Roll back the attempted implementation to the baseline; preserve existing untracked user artifacts. No commits or database changes.
- [x] Document the optimization choices, implementation order, acceptance criteria, and regression requirements.
- [x] Verify the restored baseline: typecheck, production build, 25 unit tests, and 30 desktop/mobile e2e tests passed.

### Prerequisites and auth â€” [phase 1](#1-establish-reliable-contracts-and-measurements)

- [x] Receive a separate instruction to implement; confirm the current branch, baseline, and isolated Supabase test project.
- [x] Reconcile the missing provider-profile migration and older live draft RPC before changing persistence.
- [x] Record production before/after fixtures and baseline timings, asset bytes, request/RPC counts, and SQL plans.
- [x] Add auth/session regression tests; verify and correct the Next.js 15 middleware registration, scope session refresh, and use cookie-free clients on public routes.

### Images â€” [phase 2](#2-managed-images-and-correct-loading-priority)

- [x] Add decoder/upload tests for valid, corrupt, oversized, animated, transparent, rotated, and extreme-dimension images, plus unauthorized access and failed-upload cleanup.
- [x] Implement managed uploads for hero, logo, payment background, map, and gallery; keep URL entry, preview/status/retry/remove controls, and pending-upload guards.
- [x] Resize, orient, strip metadata, and compress to WebP; store immutable objects and metadata with owner-scoped paths. The 5 MiB input ceiling is **per image**, not a user/business quota.
- [x] Enable responsive optimization for local/managed images with a safe external-URL fallback; prioritize hero/logo loading and lazy-load below-fold photos with reserved geometry.
- [x] Render gallery photos and verify upload â†’ draft save â†’ reload â†’ publish on desktop/mobile, including alt text, RTL/LTR, transparency, and broken-image recovery.
- [x] Document media retention and orphan auditing; preserve every image referenced by published history. Validate photo/logo compression targets against representative images.

### Loading and editing â€” [phase 3](#3-loading-fonts-and-editor-responsiveness)

- [x] Convert fonts to WOFF2, preserve Arabic glyphs/weights, and measure selective preload and actual transfer savings.
- [x] Add public/admin route-shaped loading states; verify layout stability, accessible status, and reduced motion.
- [x] Profile and separate expensive preview work from urgent typing; add unsaved-edit, pending-save, and upload guards without losing edits made during a save.
- [x] Verify preview convergence, save failure/retry, unload warnings, keyboard behavior, and mobile overflow.

### Lists and history â€” [phase 4](#4-admin-pagination-and-history-on-demand)

- [x] Add pagination tests with invalid cursors, stable cursor round-trips, filter-preserving URLs, and page-size contracts. The existing isolated e2e/database fixture does not provide 61 deterministic owner rows in this worktree, so the 61-row traversal remains an explicit follow-up verification.
- [x] Implement stable keyset pagination for business/card/batch lists and bounded shared searchable assignment/filter options; preserve assigned selections and URL filters.
- [x] Load card history only on demand, with paging/retry and owner authorization; correct dashboard totals and displayed-row labels.
- [x] Add cursor/filter/history composite indexes matching the implemented `(created_at,id)` and `(card_id,created_at,id)` ordering. Typecheck, full Vitest, production build, and diff checks pass; live EXPLAIN/advisor and mutation e2e require the authorized isolated Supabase environment and were not run here.

### Saves and database â€” [phase 5](#5-incremental-atomic-saves-and-authorization-overhead)

- [x] Add database contract coverage for no-op/one-row edits, stable section IDs, reorder/add/remove, validation failures, and transaction rollback. MCP execution passed; concurrent saves also passed with page-lock serialization and no partial rows.
- [x] Implement incremental atomic section saves with a verified return contract; remove destructive repair behavior and preserve supported legacy-schema handling.
- [x] Add request-local owner-check memoization and constant-per-query RLS predicates. MCP inspection confirmed `(select private.is_owner())` policies and authenticated-only draft RPC grants; disposable owner fixtures verified save isolation and provider-profile preservation.

### Cache and delivery â€” [phase 6](#6-publication-caching-with-immediate-visibility-checks)

- [x] Add the phase-6 resolver and SQL contract for live publication pointers, immutable snapshot reads, cache-fill fallback, and draft/history isolation. Full publish/archive/race lifecycle execution remains an isolated-project check.
- [x] Implement immutable snapshot caching behind live eligibility checks. The pointer RPC is uncached; the snapshot RPC revalidates current business/page/publication state. Before/after cold/warm production measurements remain required before rollout.
- [x] Reuse the request-local publication result for public metadata without duplicate reads; preserve immediate deactivation, 302/no-store card redirects, and 404/error recovery.
- [ ] Run the isolated database lifecycle suite, advisors, and before/after production metrics. Local database execution is blocked because Docker/Podman is unavailable; public e2e and browser evidence are recorded below.

### Required testing and tools â€” [verification workflow](#required-verification-workflow-and-tools)

- [x] Use the installed e2e runner for repeatable public journeys on both configured desktop/mobile targets. Phase-6 regression: 30/30 passed. Report: `.e2e/phase6-public/report.json`.
- [x] Use `chrome-devtools-axi` to inspect the public route at desktop/mobile sizes. Captured `.e2e/phase6-public/chrome-demo-desktop.png` and `.e2e/phase6-public/chrome-production-mobile.png`.
- [x] Inspect browser console and network for errors and failed resources. The clean production Chrome pass found no console errors; the public page reported Arabic RTL metadata and remained usable in the configured mobile viewport.
- [ ] Capture desktop/mobile screenshots and production-mode before/after performance evidence with the same fixtures; verify responsive image selection and eager/lazy priorities under throttling.
- [ ] Run typecheck, Vitest, production build, SQL transaction/RLS checks, Supabase advisors, Impeccable's detector, and diff checks. Typecheck, Vitest (56), production build, and `git diff --check` passed. MCP SQL/RLS checks passed against `flkakuysakgwfoemgbwn`; live migrations include `incremental_atomic_draft_save` and `draft_save_constraint_resolution`. Security advisors report existing warnings for executable `public.rls_auto_enable`/`public.create_card_batch` SECURITY DEFINER functions and disabled leaked-password protection; performance advisors report 11 unused indexes. Impeccable's detector remains unavailable in this worktree.

## Status and authorization

Implementation is authorized for phases 1-5 in this worktree. Changes remain uncommitted and undeployed. The isolated NexTabCodex project (`flkakuysakgwfoemgbwn`) already contained the deployed Phase 5 migration; MCP was used for read-only inspection and disposable transaction/concurrency verification, with cleanup completed. Existing untracked user artifacts were preserved. See [the implementation report](../implementation/optimization-phase123-implementation.md) for earlier evidence; Phase 5 evidence is recorded in the checklist and local e2e outputs.

## Verified baseline

The project uses Next.js 15.5.27, React 19.1.1, Supabase Auth/Postgres/Storage, TypeScript, Vitest, and the e2e runner. Most route rendering is on the server; interactive islands and the owner editor run in the browser.

Already present:

- Immutable publication snapshots; public pages retrieve a snapshot through one RPC.
- Unique slug/token indexes and indexes for page relationships, section order, batches, and history.
- Parallel independent dashboard queries, selected query columns, count-only requests, and row limits.
- Local draft editing until Save/Publish, memoized derived editor data, and transition-based saving.
- A local 23,174-byte WebP payment background, SVG icons, self-hosted fonts, and reduced-motion styles.
- Permanent card redirects use 302 and `no-store` to reflect current assignment and activation.
- Owner authorization, RLS, constrained URLs, and separate unpublished/published content.

Observed gaps:

- Public pages are dynamic; there is no persistent publication payload cache.
- Image URLs are stored in section JSON and copied into publications. There is no application upload flow. `media_assets` and the public `business-media` bucket exist but are not wired to the editor.
- Next image optimization is disabled. Hero/payment photos use CSS backgrounds; logos/map photos use ordinary images. There are no responsive image variants or consistent dimension reservations.
- Gallery content currently goes through the generic item renderer; a gallery URL becomes a link rather than an actual photo gallery.
- Admin business/card lists stop at 300 results. Card history eagerly fetches up to 1,000 events. Assignment options repeat in every card row.
- Dashboard business statistics use the six recently fetched rows as the count, rather than a real total.
- Draft saving deletes/reinserts all sections and reads them back. A compatibility repair path uses separate direct delete/insert requests; this can lose atomicity. Its inserted repair rows also omit `page_id`.
- Fonts are TTF, approximately 500,564 bytes total on disk. A discarded WOFF2 conversion experiment produced 187,724 bytes with the same glyph coverage. That is a file-size result, not a measured network or Core Web Vitals improvement.
- The production middleware manifest is empty. `proxy.ts` exists, but it is not registered by this Next.js 15 build. Verify the supported middleware entry point and session refresh before making auth/request-path changes; the presence of the file is not evidence it executes.

Read-only inspection of project `flkakuysakgwfoemgbwn` found 98 businesses and 322 cards at inspection time. This confirms that the 300-card cap can hide records. The remote migration list includes Quick Actions but does not include `202610090002_provider_profiles.sql`; the inspected draft RPC has the older eight-argument signature. Reinspect before implementation: local migrations and the connected schema are not identical.

Authoritative code map:

- `src/components/business/public-snapshot.tsx`: public rendering, background photos, logo/map rendering, generic gallery behavior.
- `src/app/admin/businesses/_components/business-editor.tsx`: local draft state and live preview.
- `src/app/admin/businesses/actions.ts`: validation, save/publish, compatibility fallback, and activation.
- `src/app/admin/businesses/page.tsx`, `src/app/admin/cards/page.tsx`: filters, row limits, repeated options, and eager history.
- `src/app/admin/page.tsx`: dashboard counts and recent businesses.
- `src/lib/auth/owner.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/proxy.ts`, `proxy.ts`: auth/session handling.
- `next.config.ts`, `src/app/globals.css`, `public/fonts/`: image delivery, fonts, and layout.
- `supabase/migrations/`: intended database contracts; inspect live functions and migration history separately.
- `docs/implementation/payment-redirect-implementation.md`: current payment behavior that must remain intact.

## Recommended implementation order

Complete each phase with its regression checks before moving on. All selected phases belong to the eventual implementation scope; the cache phase has an explicit measurement gate.

### 1. Establish reliable contracts and measurements

Verify session refresh on the installed Next.js version and correct its entry point if needed. Keep authorization enforced in server actions, endpoints, and RLS; middleware is not the sole authorization boundary. Scope any active session-refresh middleware to routes that need a session. Public card/business routes should use a cookie-free, publishable-key client and narrow public RPCs, avoiding owner-session work.

Reconcile provider-profile migration state in a dedicated test database before optimizing saves. Preserve existing inherited provider details and per-item overrides. Do not silently apply missing migrations to the connected database or remove compatibility behavior without a verified migration path.

Record production-mode desktop/mobile measurements for the landing page, demo, a media-rich published page, a large card list, and the editor. Use the same content and conditions before/after: three runs, compare medians, cold/warm cache, throttled mobile CPU/network, and a production build. Capture LCP, CLS, INP where an actual interaction exists, TTFB, transferred bytes, request count, DOM size, browser long tasks, RPC count, and relevant SQL plans. Development compilation timings are not production performance evidence.

### 2. Managed images and correct loading priority

Add an image field that accepts uploads and retains existing URL entry. Cover hero, business logo, payment background, contact/map image, and gallery images. Show an accessible preview, upload progress/status, retry, and remove-from-draft control. Save/Publish must wait for pending uploads or clearly prevent submission until they finish. Uploading alone must not publish the draft.

Recommended pipeline:

1. Validate supported still JPEG/PNG/WebP input, nonzero size, a 5 MiB input ceiling, and bounded decoded pixel count.
2. Use bounded browser preprocessing for files that would exceed the deployed request-body limit; retain a working fallback. Verify the hosting limit rather than assuming a 5 MiB multipart body is accepted everywhere.
3. Use an authenticated Node endpoint and explicitly pinned `sharp` dependency for authoritative byte decoding, orientation, metadata stripping, and resizing. Do not trust the filename or declared MIME type. Reject animations and unsupported formats.
4. Produce a WebP master, maximum long edge 1,600 px for photos and 512 px for logos, without enlarging smaller images. Start around quality 82, then inspect real text-heavy logos and photos. Preserve transparency and orientation.
5. Store bytes in `business-media/<owner UUID>/<business UUID>/<random UUID>.webp`. Store path, MIME, size, and alt text in `media_assets`; retain image URLs in section/publication JSON for compatibility. Never put base64 image bytes into Postgres JSON.
6. Use immutable filenames, `upsert: false`, and long storage caching. Clean up the uploaded object if metadata registration fails. Do not overwrite objects referenced by a published snapshot.

Working size targets are roughly 100â€“500 KiB per photo and 20â€“100 KiB per logo. For a 5 MiB original photo, that would mean about 90â€“98% reduction. These are targets to test, not guaranteed sizes or measured results; visual quality, transparency, and text readability take precedence. There is currently no cumulative storage quota per owner or business.

The bucket is public: image bytes are publicly readable by URL even before the page is published. Draft text stays private, but this bucket is not suitable for confidential media. State this accurately in implementation documentation.

Enable Next responsive image optimization for local raster assets and this project's public `business-media` path only. Preserve arbitrary existing external URLs through a direct, unoptimized fallback; do not configure an unrestricted remote image proxy. Verify behavior with a custom Supabase domain if one is configured.

Render hero photos as positioned image elements with high priority and `sizes` matching the actual layout. Load the above-fold logo and action icons promptly. Render payment/map/gallery photos with native lazy loading, asynchronous decoding, and reserved geometry. Keep the existing gradient overlay and visual composition. Do not lazy-load the hero or every tiny icon indiscriminately.

Give gallery items actual thumbnails with labels/alt text and a useful link to the full image. Keep item order, enabled state, and existing content compatible. A lightbox/cropping editor is not needed for this performance pass.

Removing or replacing an image only removes its draft reference. Published history can still reference old media. Add explicit lifecycle documentation and a safe orphan audit; do not auto-delete media based solely on current draft references. Failed uploads can be cleaned immediately, but successful unused uploads need a grace period and checks against drafts and publication history.

### 3. Loading, fonts, and editor responsiveness

Convert existing fonts to WOFF2 without losing Arabic glyphs or the existing weights. Keep `font-display: swap`. Preload only the font needed by the first screen, and measure whether unused Arabic/Latin font downloads can be avoided on each surface. Version changed asset URLs so long browser caches cannot preserve obsolete files.

Add route-shaped loading states for public business pages and admin lists. Reserve the hero/thumbnail geometry and give loaders an accessible status. Preserve reduced-motion behavior and avoid artificial minimum loading delays.

Separate preview rendering from urgent editor input using a memoized component and `useDeferredValue` if profiling confirms preview work causes long tasks. Keep immediate input feedback; the deferred preview must converge to the exact draft used for Save/Publish. Do not debounce typing or defer the persisted value.

Add reliable dirty-state and upload/pending-save guards. Warn before browser unload with unsaved edits. If the owner edits while a save is running, completion of that older save must not mark the newer edits as saved. Preserve failed-save input and give an actionable retry. Any draft recovery storage must be scoped to owner/business/page, cleared appropriately, and excluded for sensitive data unless explicitly designed for it.

Use component-level dynamic imports only for measured heavy, optional UI. Do not delay primary actions, the whole public renderer, or essential editor controls just to reduce an artificial bundle metric. Repeated sections can use CSS containment where profiling shows benefit; preserve keyboard navigation and find-in-page.

### 4. Admin pagination and history on demand

Use keyset pagination with stable `(created_at DESC, id DESC)` ordering, initially 25 rows per page and one extra row to detect a next page. Include both values in a validated cursor, support previous/next/first navigation, and preserve search/status/batch/page/business filters in the URL. Invalid cursors must fail safely; changing filters resets pagination. Avoid OFFSET for deep navigation.

Paginate manufacturing batch listings too. Large page/batch option sets need a shared searchable picker with bounded server queries, rather than silent truncation or fetching a full database into every card row. Show assigned pages even when they are outside the current option result window. Do not introduce a separate options query per card.

Fetch each card's history only when its details are opened. Page history by a stable indexed key, cache it within that mounted card UI, provide retry and Load More, and enforce owner authorization on the endpoint. Do not fetch all visible cards' history on initial load.

Correct dashboard totals independently of the recent six-row business list. Use count-only queries where the measured cost is acceptable. Make list copy accurately describe displayed rows; capped rows must never be labeled as the complete total.

Add indexes matching the actual cursor/filter/history queries after inspecting EXPLAIN plans. Add trigram indexes only if measured substring search warrants them; do not create indexes for every possible column. Leave existing uniqueness and FK constraints intact.

### 5. Incremental atomic saves and authorization overhead

Keep the owner-checked draft RPC and page-row lock. Upsert changed sections by `(page_id, section_key)`, retain IDs for existing sections, delete only removed sections, and skip unchanged values. Handle reorder constraints atomically, including swaps, additions, removals, and SMALLINT position limits. Validate section count, keys, order, kind, and content before mutation.

Return a clear committed result, such as section count/version, so the current RPC does not require a full verification read after every ordinary save. Keep explicit detection of unsupported schemas. On verification/network failure, preserve the draft and report an error; never repair a failed read by deleting rows through separate requests.

Request-local memoization of `requireOwner` can avoid duplicate layout/page allowlist checks. It must never become a cross-user cache. For owner-only policies whose predicate is constant per query, consider `(select private.is_owner())` after plan/privilege verification; never apply this transformation to row-dependent authorization.

### 6. Publication caching with immediate visibility checks

Measure snapshot payload/TTFB before adding another RPC. If payload/database savings justify it, cache immutable snapshot content by publication UUID, and resolve the current active publication pointer through a small uncached public RPC on every request. Use a cookie-free public client for cache fills. A new publish naturally changes the key.

Keep business status, page activation, canonical slug/aliases, and card assignment checks live. Anonymous direct requests to an archived/disabled page must not return a warmed snapshot. Narrow snapshot RPCs must expose only eligible current publications, with restricted grants; drafts and arbitrary historical snapshots stay private. Handle publish/archive races, missing snapshots, cache-fill failures, and schema rollout explicitly.

This design reduces repeated large snapshot transfers, not all database requests. It adds a cold-cache read; compare both paths. If the snapshot is too small for a net benefit, retain the current one-RPC public read and document that measurement-based choice. Do not add a generic TTL cache that delays deactivation.

Reuse the resolved snapshot for metadata generation without duplicate reads. Provide business title/description and an appropriate managed image without inventing claims or leaking unpublished content. Preserve true 404 recovery and useful retry for infrastructure failures.

## Explicit choices against unnecessary complexity

- No framework upgrade, visual redesign, Redis, microservice, GraphQL layer, or new state-management library is needed for this scope.
- No service worker/offline public-page cache: stale assignments and disabled businesses are operationally important.
- No blanket `memo`, preloading, lazy loading, `will-change`, or list virtualization. Server pagination and appropriate image priority address the concrete gaps first.
- No automatic deletion of historical publications/media and no fake provider deep links.
- Production telemetry should use aggregate timings only; do not log card tokens, payment recipients, signed URLs, or credentials. Select any new third-party monitoring dependency separately.

## Regression tests to add before the corresponding implementation

These are required test specifications, not tests already implemented or passed. Use isolated deterministic fixtures, not customer records. Preserve existing assertions; a changed layout may require a justified locator update, not weaker behavior checks.

### Auth and schema compatibility

- Anonymous/non-owner access to admin, exports, uploads, history, and save/publish is denied; there is no service-role key in browser bundles.
- Valid session, expired session refresh, revoked owner access, sign-out, and cross-user cache isolation work.
- Middleware appears in the production manifest if that mechanism is selected. Public assets/card resolution do not perform needless owner/session work.
- Current and supported legacy RPC contracts behave as documented. Missing migration/network errors never trigger destructive repair.
- Public functions cannot return draft tables or arbitrary unpublished/historical snapshots.

### Images and asset loading

- Real JPEG/PNG/WebP fixtures, transparent logo, EXIF-rotated photo, oversized input, zero bytes, corrupt bytes, fake MIME, animation, extreme dimensions, and rejected format.
- Correct maximum dimensions, no enlargement, orientation, transparency, stripped metadata, WebP output, and byte limits.
- Upload authorization and business ownership; deployed request-body limit; object/metadata failure cleanup; retry; simultaneous fields; upload cancellation/navigation; save while uploading.
- Upload changes draft only. Save/reload preserves the URL. Publish displays the new image. Existing external URLs still display. Old publications retain their image references.
- Hero is eager/high priority; below-fold map/payment/gallery images are lazy. Responsive variants download a suitable size at 390 px and desktop. Geometry is reserved, broken images keep content/actions usable, and no unexpected horizontal overflow occurs.
- Arabic fonts/glyphs and existing weight/layout remain intact. Keyboard upload/remove controls, alt text, and RTL/LTR labels work.

### Pagination and history

- At least 61 fixture rows, including identical timestamps: traverse both directions with no skipped/duplicate rows. Include empty state, exact 25-row boundary, last page, invalid cursor, and deletion/insertion during navigation.
- Search/status/batch/page/business filters survive navigation and reset cursors correctly. New records beyond the old 300-row boundary are reachable.
- Initial card render performs no history request. Opening one card fetches only its history; collapsing/reopening avoids duplicate fetches. Load More and errors work. Another user cannot read the endpoint.
- Assignment picker preserves current selection and supports pages outside its first result window. Selection/activation/reassignment/disable still target the correct card/page.
- Dashboard total and displayed-row counts mean what their labels say.

### Atomic saves and publication/cache lifecycle

- No-op save preserves IDs and timestamps; one content edit writes only the changed section.
- Reorder/add/remove/mixed saves retain expected IDs and valid positions. Duplicate keys/order, invalid kind/content, and overflow roll back completely.
- Forced failures and concurrent saves do not leave partial sections or mutate prior publications. Draft edits stay private until publish.
- Provider inheritance and per-item override survive save/reload/publish; Quick Actions 1â€“4 column behavior remains unchanged.
- Cache cold/warm reads, republish, archive, disable, reactivate, slug rename/old alias, missing snapshot, failed cache fill, concurrent publish/archive, and anonymous/owner transitions.
- Warmed direct business URLs and permanent card URLs observe current eligibility. Redirects stay 302/no-store, and both QR/NFC resolve current assignment.

### Existing product behavior

- Preserve payment privacy, optional provider names, supplied HTTPS destinations, copy/instructions fallback, clipboard denial, local logo fallback, dialog focus/escape, and safe URL validation.
- Preserve landing/demo/login, mobile layouts, Arabic RTL/English LTR, keyboard focus, disabled states, loading/error/empty states, section/item ordering, and branch pages.
- Preserve manufacturing idempotency, immutable card identifiers, QR payload/serial alignment, ZIP/CSV output, limits, and audit history.

Suggested future test files: `tests/unit/media.test.ts`, `tests/unit/pagination.test.ts`, `tests/e2e/media-upload.e2e.ts`, `tests/e2e/admin-pagination.e2e.ts`, `tests/e2e/public-cache.e2e.ts`, and database transaction/RLS tests in the project's selected SQL test workflow. Add these only in the implementation phase.

## Baseline validation completed after rollback

- Type checking: passed.
- Vitest: 25 tests passed across 4 files.
- Production build: passed. First-load JS: shared 103 kB; public business page 104 kB; demo 108 kB; editor 133 kB. These are Next build estimates, not measured network transfer sizes.
- Existing public journey, public security, and Quick Actions layout e2e: 30/30 passed across desktop (1440Ã—960) and mobile (390Ã—844).
- E2E run ID: `01a123d2-8b23-7ddd-92f7-8cc09ce399d4`; report: `.e2e/optimization-handoff-baseline/report.json`. Output is ignored by Git and is local evidence, not a committed artifact.
- Owner mutation tests, new optimization tests, database failure/concurrency tests, and production Core Web Vitals were not run. Do not treat these baseline results as verification of future changes.

Repeat baseline commands in PowerShell:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
$env:E2E_ALLOW_MUTATIONS = 'false'
npx.cmd e2e run tests/e2e/public-journey.e2e.ts tests/e2e/public-security.e2e.ts tests/e2e/quick-actions-layout.e2e.ts --reporter list --output .e2e/optimization-handoff-baseline
Remove-Item Env:E2E_ALLOW_MUTATIONS
```

After implementation, run the commands above plus all new focused tests. On a verified isolated Supabase test project, run the owner card journey, editor actions, admin reordering, and manufacturing suites with the existing mutation opt-in. Save desktop/mobile evidence and reports for each changed flow; distinguish skipped cases from passing cases. Run the Impeccable detector once over the changed UI and `git diff --check`. Inspect database advisors and reconcile migration history before any rollout.

## Required verification workflow and tools

Automated e2e and direct browser inspection are both required. Screenshots alone do not establish functional correctness, and passing unit tests do not establish that the interface works. Keep this work inside the implementation phase; the handoff's baseline results describe only the restored application.

### Automated checks

Use the installed `e2e` skill and the existing `e2e.config.ts`. Discover current CLI flags with `npx.cmd e2e --help` / `npx.cmd e2e run --help` before changing invocation details. Use exact assertions for deterministic values and outcomes, not fixed sleeps or weakened assertions. Use agent-driven exploration when it helps investigate uncertain behavior, then capture any defect in a repeatable regression test.

Run existing public suites and each new focused suite on both configured targets: desktop 1440Ã—960 and mobile 390Ã—844. Run the existing owner workflow suites and new upload/pagination/cache mutation cases only against a verified isolated test database with deterministic fixtures. Read the resulting report and failure traces; distinguish pass, fail, skipped, and not run. Do not claim that a skipped owner suite establishes no regression.

Test auth and publication permissions through both application flows and database/RPC access. Exercise SQL rollback/concurrency/RLS independently of browser tests. Run typecheck, Vitest, and production build; use Supabase advisors and inspect actual migration/function signatures. These are complementary checks, not alternatives to e2e.

### Real browser checks

Use the installed `chrome-devtools-axi` skill and CLI for browser inspection. Discover its current commands with `npx.cmd -y chrome-devtools-axi --help`, then each needed command's `--help`; do not copy undocumented flags from an old handoff.

Inspect the actual changed public and admin routes, not only the demo. Validate keyboard focus and dialog recovery, Arabic/English layout, upload/validation/retry, Save/Publish, preview convergence, list pagination/history, payment privacy/actions, and current QR/NFC resolution. Capture desktop/mobile screenshots with representative real-length fixture content. Keep credentials and real recipient values out of screenshots, reports, and logs.

Use browser console/network inspection to check runtime errors, hydration warnings, failed fonts/images, redirects, cache headers, selected image variants, transferred bytes, duplicate RPC/resource requests, and history requests before/after opening a card. Verify hero loading priority and below-fold photo loading with the viewport and network conditions that trigger them. Include broken-image, denied-clipboard, failed-request, loading, empty, and reduced-motion cases. Record failures and recovery, not just the happy path.

Measure performance in production mode with the same fixtures before and after: cold/warm caches, desktop/mobile, throttled CPU/network, and three-run medians. Use browser performance traces and suitable audit tools to record LCP/CLS/interaction evidence and the waterfall. A CLI audit that covers only accessibility/SEO/best practices must not be presented as a Core Web Vitals measurement. Reuse the build's actual image/font payloads and SQL plans for supporting evidence.

### Evidence and exit criteria

Keep automated reports/traces, browser screenshots, console/network findings, performance measurements, SQL/advisor results, and the final checklist status together in the implementation handoff. Choose a distinct output directory per validation pass to retain the baseline. If a tool or environment prevents a check, record the exact blocker and leave its item unchecked.

Run Impeccable's detector once over the completed changed UI and inspect desktop/mobile together in a bounded pass; fix findings and perform one confirmation pass where needed. Finish with `git diff --check`. Do not mark a feature complete merely because it compiles or its screenshot looks correct; it must satisfy the regression specifications and delivery gate.

## Acceptance and delivery gate

All baseline and new behavior tests must pass; owner/database tests must actually run on an isolated project, not be counted as passed after skipping. No unsaved draft loss, stale deactivation, payment disclosure, historical media breakage, or token/serial changes are acceptable.

For the same production fixtures, require reduced image/font transfer and initial admin rows/history payload, and no material regression in median TTFB, LCP, CLS, or interaction responsiveness. Aim for LCP â‰¤2.5 s, CLS â‰¤0.1, and INP â‰¤200 ms on the agreed representative mobile setup; report missed targets with the measured remaining cause. Lab results alone are not real-user percentile claims.

Deliver code/tests/migrations together, before/after measurements, cache/media lifecycle documentation, a rollout order for schema and app changes, and a rollback strategy. Keep the previous public read path available during a staged cache rollout. Do not reset the database, delete historical media, silently accept regression failures, or commit/deploy without the user's explicit instruction.

Resume by reading this handoff, `docs/product/PRODUCT.md`, `docs/implementation/payment-redirect-implementation.md`, the current source/migration state, and the applicable Supabase/Postgres/Impeccable/e2e/chrome-devtools-axi skills. Reconfirm the baseline SHA and connected project before starting.
