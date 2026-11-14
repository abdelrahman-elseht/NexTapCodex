---
Status: current
Owner: NexTap Core
Supersedes: none
Path globs: ["src/app/**", "src/components/**", "src/lib/**", "tests/e2e/**", "supabase/**", "workers/**", "infra/cloudflare/**"]
Topic tags: stories, e2e, public, admin, cards, migration, security
---

# NexTap Core Migration Stories

This catalog preserves existing NexTap Core user outcomes while directing new implementation and validation toward the Cloudflare migration contract in `NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md`. Stories tagged `current` describe the legacy Next.js/Supabase/Vercel baseline; they are retained for parity and compatibility checks, not as the target design. Stories tagged `migration-active` or `planned` define Cloudflare target behavior. A mapped test is not passing evidence until it has passed in its named environment; skipped tests with unmet prerequisites remain blocked.

## Coverage status and lifecycle

`Stage` describes product rollout: `current` is implemented only on the legacy baseline; `migration-active` is being replaced or validated in the Cloudflare cutover; `planned` defines target behavior not implemented yet; `retired` is no longer supported. `Coverage` describes evidence: `covered` means the mapped test has passed in the required environment; `partial` means only part of acceptance is tested or current parity evidence is absent; `blocked` means evidence depends on a missing fixture, credential, runtime, or environment; `not-covered` means no mapped test exists. Do not convert `blocked` or `planned` into passing coverage because the runner reports a skipped test.

Every E2E test declares tags in its runner options: `story:<ID>`, `domain:<name>`, `risk:<critical|high|normal>`, one or more `env:<local|staging>` values, and `mutation:<read|write>`. Risk is consequence, not complexity. Mutation tags are selection metadata, not a safety control. Preserve stable user-outcome IDs during implementation changes; add a `MIG-*` story when acceptance depends on a Cloudflare-only contract such as static CDN delivery, R2, KV fallback, D1 publication, or route coexistence.

Use `npm run select:stories -- --paths <changed-paths...> --track cloudflare-target` for migration implementation. Legacy route changes use `--track legacy-baseline` only when maintaining compatibility or gathering parity evidence. `npx e2e list --tag story:MIG-01 --target mobile` inspects a target story directly; run it only after its route/runtime fixture exists. Use `--tag-mode all` for tag intersections and `--last-failed` for a prior run's failures. The full active catalog is reserved for phase/release gates. Unknown paths or target stories without tests must be reported explicitly, never replaced with a full-suite run.

## Test actors and environments

| Actor | Goal | Required access |
| --- | --- | --- |
| Visitor | Understand NexTap and open a business page from a card or QR code. | Anonymous browser session |
| Business customer | Read a business microsite and use contact, directions, reviews, social, hours, services, and payment details. | Anonymous mobile browser |
| NexTap internal admin | Manage businesses, pages, sections, cards, batches, assignments, publishing, and exports. | Current baseline uses Supabase Auth; target identity and authorization are defined by the migration PRD |
| Manufacturing operator | Download a batch package and use its QR/NFC manifest. | Authorized internal access and an isolated target fixture |

### Credential handling

Legacy baseline E2E may use an owner account in ignored local `.env.local`:

```text
E2E_USER_OWNER_USERNAME=<local secret>
E2E_USER_OWNER_PASSWORD=<local secret>
```

The values must never be copied into this catalog, tests, screenshots, PR descriptions, or Git history. Legacy mutation tests require a dedicated disposable Supabase project. This credential pattern is not the Cloudflare target admin identity contract. Target tests must use an isolated Cloudflare environment and its approved identity path.

## Public marketing stories

### MKT-01 — Visitor understands the product

**Stage / coverage / risk / environment / fixture:** current / partial / normal / local and staging / anonymous landing route; no database fixture.

**As a visitor,** I want to understand what NexTap does within the first viewport so I can decide whether to explore the demo.

**Acceptance:** The landing page presents the NFC/QR card promise, a clear primary CTA, a product/card composition, and supporting proof without requiring horizontal scrolling.

**E2E:** `tests/e2e/public-journey.e2e.ts` landing test; responsive checks at 320, 360, 390, 768, 1024, and 1440px.

### MKT-02 — Visitor opens the demo

**Stage / coverage / risk / environment / fixture:** current / partial / normal / local and staging / public demo page.

**As a visitor,** I want to open an illustrative business page from the landing page.

**Acceptance:** Both the hero CTA and the supporting demo CTA navigate to `/demo`; sample content is clearly presented as illustrative.

**E2E:** `tests/e2e/public-journey.e2e.ts` landing and demo tests.

### MKT-03 — Visitor reaches the contact CTA

**Stage / coverage / risk / environment / fixture:** current / partial / normal / local and staging / configured and empty contact settings. Current mapped landing test only proves the empty fallback; configured-number case is not covered yet.

**As a visitor,** I want to contact NexTap from the landing page when a contact number is configured.

**Acceptance:** A configured WhatsApp destination is used once; when no number is configured, the interface does not render duplicate or misleading contact actions.

**E2E:** Landing CTA test with configured and unconfigured contact fixtures.

### MKT-04 — Visitor changes language

**Stage / coverage / risk / environment / fixture:** current / partial / normal / local and staging / Arabic and English public/login routes.

**As a visitor,** I want the marketing and login surfaces to support Arabic RTL and English LTR.

**Acceptance:** Text, direction, navigation, forms, and primary actions remain usable after switching language.

**E2E:** Login language test plus document `lang`/`dir` assertions on public routes.

## Public business microsite stories

### PUB-01 — Visitor reads a published business page

**Stage / coverage / risk / environment / fixture:** current / partial / high / local and staging / published synthetic business fixture; current baseline test requires the namespaced fixture file.

**As a customer,** I want to see the business identity immediately after tapping or scanning a card.

**Acceptance:** Cover, logo/profile mark, business name, category, tagline, and primary actions render above the content sections.

**E2E:** Published business fixture test.

### PUB-02 — Visitor takes an immediate action

**Stage / coverage / risk / environment / fixture:** current / partial / high / local and staging / published profile with configured actions; some action tests use provider fixtures.

**As a mobile customer,** I want thumb-friendly actions for calling, WhatsApp, directions, reviews, and social links.

**Acceptance:** Action URLs are correct, tappable controls are at least touch-sized, and the fixed mobile action bar does not cover content or footer links.

**E2E:** Mobile microsite action and footer tests; no-overflow assertion.

### PUB-03 — Visitor reads business sections

**Stage / coverage / risk / environment / fixture:** current / partial / high / local and staging / snapshots with enabled/disabled sections and order; full kind-by-kind fixture coverage remains open.

**As a customer,** I want to find about, opening hours, contact/address, services/menu, payments, gallery, social, branch, and reviews content when the business enables those sections.

**Acceptance:** Enabled sections render in saved order; disabled sections do not render; items preserve labels, values, and external links.

**E2E:** Snapshot fixtures covering every section kind and variable item count.

### PUB-04 — Visitor understands payment information

**Stage / coverage / risk / environment / fixture:** current / partial / high / local and staging / public payment fixture and safe external destinations.

**As an Egyptian customer,** I want to see external payment/contact instructions such as InstaPay, Vodafone Cash, Etisalat Cash (e& money), Orange Cash (Mobinil), bank transfer, or a custom note.

**Acceptance:** Payment details are presented as informational external instructions; NexTap never implies that it processes the payment.

**E2E:** Payment section fixture and copy assertion.

### PUB-05 — Visitor sees a useful unavailable state

**Stage / coverage / risk / environment / fixture:** current / partial / critical / local and staging / invalid token now; unassigned and inactive-card states require isolated card fixtures.

**As a customer,** I want a clear recovery path when a card is unassigned, inactive, replaced, or invalid.

**Acceptance:** The page explains the state in plain language, avoids technical data leakage, and links to the NexTap home or demo where appropriate.

**E2E:** Invalid token security test plus unassigned/inactive state fixtures.

### PUB-06 — Visitor sees a useful not-found state

**Stage / coverage / risk / environment / fixture:** current / partial / normal / local and staging / unknown slug and route.

**As a customer,** I want an invalid business slug to show a branded recovery page rather than a blank profile or stack trace.

**Acceptance:** The page offers home and demo recovery links and contains no `undefined`, `null`, or technical error noise.

**E2E:** `tests/e2e/public-security.e2e.ts` unknown business and unknown route tests.

### PUB-07 — Visitor downloads a contact file

**As a customer,** I want to download a valid contact file from an enabled public profile.

**Acceptance:** The VCF contains the configured business/contact fields, uses a safe filename and response headers, and does not leak an unpublished draft or private media source.

**Stage / coverage / risk / environment / fixture:** current / partial / high / local and staging / published profile with enabled contact projection. Existing `tests/e2e/contacts.e2e.ts` covers download within an owner mutation flow; an anonymous public download journey still needs isolated evidence.

**E2E:** `tests/e2e/contacts.e2e.ts`; unit contracts in `tests/unit/contact-download.test.ts`.

## Authentication and access stories

### AUTH-01 — Owner signs in

**Stage / coverage / risk / environment / fixture:** current / blocked / critical / local and staging / allowlisted owner credentials. Current browser flows rely on configured owner credentials but do not prove the standalone valid-login redirect in one tagged test.

**As an authorized NexTap owner,** I want to sign in with my Supabase email and password and reach the admin dashboard.

**Acceptance:** A valid Auth credential whose UUID exists in `public.owner_users` redirects to `/admin` and establishes a cookie-backed session.

**E2E:** Authenticated owner smoke test using the ignored local credentials.

### AUTH-02 — Invalid sign-in is safe

**Stage / coverage / risk / environment / fixture:** current / partial / critical / local and staging / invalid password that cannot mutate account state; isolated local mobile run passed, Staging remains unverified.

**As a visitor,** I want a failed sign-in to explain the problem without exposing whether an account exists.

**Acceptance:** Invalid credentials return to login with a generic message; no session is created.

**E2E:** Invalid password test.

### AUTH-03 — Authenticated non-owner is denied

**Stage / coverage / risk / environment / fixture:** current / blocked / critical / staging / dedicated non-owner account and isolated auth fixture; current test skips unless protected credentials exist.

**As a NexTap operator,** I want admin access limited to allowlisted owner accounts.

**Acceptance:** A valid Auth user absent from `public.owner_users` is signed out and receives the unauthorized message.

**E2E:** Dedicated non-owner fixture test.

### AUTH-04 — Anonymous admin routes are protected

**Stage / coverage / risk / environment / fixture:** current / partial / critical / local and staging / anonymous session; mapped tests cover selected owner paths and exports.

**As an anonymous visitor,** I should not be able to read owner data or export cards.

**Acceptance:** `/admin`, business editors, card inventory, and CSV/ZIP exports redirect to login.

**E2E:** `tests/e2e/public-security.e2e.ts` anonymous owner-route test.

### AUTH-05 — Owner signs out

**Stage / coverage / risk / environment / fixture:** current / partial / critical / local and staging / owner session with refreshable cookies.

**As an owner,** I want sign-out to invalidate the browser session.

**Acceptance:** The sign-out route clears the Supabase session and subsequent admin navigation returns to login.

**E2E:** Authenticated sign-out and post-logout redirect test.

## Business and page administration stories

### ADM-BIZ-01 — Owner views the dashboard

**Stage / coverage / risk / environment / fixture:** current / partial / high / local and staging / owner account and optionally namespaced synthetic data.

**As an owner,** I want an overview of businesses, published pages, card inventory, and next actions.

**Acceptance:** The dashboard loads with useful counts, clear navigation, empty states, loading states, and links to businesses and cards.

**E2E:** Authenticated admin smoke test.

### ADM-BIZ-02 — Owner lists and filters businesses

**Stage / coverage / risk / environment / fixture:** current / partial / high / local and staging / owner account; synthetic business fixture needed for stable filters.

**As an owner,** I want to find a business by name, slug, status, or template.

**Acceptance:** The list is readable on mobile and desktop, displays active/archive/publish status, and links to edit and preview.

**E2E:** Business list search/filter test.

### ADM-BIZ-03 — Owner creates a business page

**Stage / coverage / risk / environment / fixture:** current / blocked / high / local and staging / isolated mutation database and namespaced fixture. Existing end-to-end create journey is mutation-gated.

**As an owner,** I want to create a business and its first page using a template.

**Acceptance:** Required name, category, slug, and template validation works; a successful create redirects to the editor; duplicate/invalid slugs show recovery copy.

**E2E:** `tests/e2e/owner-card-journey.e2e.ts` create flow on an isolated mutation database.

### ADM-BIZ-04 — Owner edits business settings

**Stage / coverage / risk / environment / fixture:** current / blocked / high / local and staging / isolated mutation fixture; rename/alias and active/archive operations must not run against shared data.

**As an owner,** I want to update name, category, slug, template, and active/archive state.

**Acceptance:** Save reports success, preserves valid data, revalidates editor/public routes, and keeps old card tokens resolving to the renamed slug.

**E2E:** Owner journey rename and redirect assertions.

### ADM-BIZ-05 — Owner edits section content

**Stage / coverage / risk / environment / fixture:** current / partial / high / local and staging / namespaced editor fixture; malformed JSON and limits have incomplete browser coverage.

**As an owner,** I want a structured editor for hero, contact, about, reviews, and repeatable item sections.

**Acceptance:** Field mode supports typed fields and repeatable items; advanced JSON mode validates objects; item add/remove and limits work; malformed content cannot be saved.

**E2E:** Section editor field/JSON validation test.

### ADM-BIZ-06 — Owner adds, removes, enables, and disables sections

**Stage / coverage / risk / environment / fixture:** current / blocked / high / local and staging / isolated mutation fixture with confirmation and restore path; mapped E2E is `business-editor-actions.e2e.ts` and remains gated by `E2E_ALLOW_MUTATIONS`.

**As an owner,** I want to control which sections appear on the public page.

**Acceptance:** Add/remove actions are scoped to the page, destructive removal is confirmed, disabled sections remain editable but do not render publicly, and success/error states are visible.

**E2E:** Section lifecycle test on an isolated mutation database.

### ADM-BIZ-07 — Owner reorders sections

**Stage / coverage / risk / environment / fixture:** current / blocked / high / local and staging / isolated fixture; guarded by `E2E_ALLOW_MUTATIONS`.

**As an owner,** I want the public page to follow the editorial order I choose.

**Acceptance:** Up/down controls and drag affordance preserve order after save and reload; public rendering follows the same order.

**E2E:** `tests/e2e/admin-reordering.e2e.ts` with `E2E_ALLOW_MUTATIONS=true` only on an isolated database.

### ADM-BIZ-08 — Owner previews before publishing

**Stage / coverage / risk / environment / fixture:** current / partial / high / local and staging / draft and prior publication fixture; ensure public route remains unchanged before publish.

**As an owner,** I want to preview draft content without exposing it publicly.

**Acceptance:** Preview shows draft sections and a clear preview state; the public slug continues showing the last published snapshot until publish.

**E2E:** `tests/e2e/owner-card-journey.e2e.ts` draft privacy and preview assertions.

### ADM-BIZ-09 — Owner publishes a page

**Stage / coverage / risk / environment / fixture:** current / blocked / critical / local and staging / isolated publish fixture; draft privacy and publication atomicity are required assertions.

**As an owner,** I want to publish a reviewed draft as an immutable snapshot.

**Acceptance:** Publish reports success, public pages show the new snapshot, and unpublished changes remain private.

**E2E:** Owner journey publish assertions.

### ADM-BIZ-10 — Owner manages branches and templates

**Stage / coverage / risk / environment / fixture:** current / not-covered / high / local and staging / branch/template fixture; no mapped branch creation flow was found in current E2E tests.

**As an owner,** I want branch pages and templates to share the same editing and publish model.

**Acceptance:** Branch metadata is editable, template selection is clear, and branch/public routes preserve mobile and RTL behavior.

**E2E:** Branch creation, template selection, and preview tests.

### ADM-BIZ-11 — Owner manages public media

**As an owner,** I want to upload, crop, preview, and publish business images without exposing draft or private media.

**Acceptance:** Accepted image inputs are safely decoded and optimized; crop settings persist; upload and save failures preserve user work; published hero/logo/gallery images use correct public URLs and responsive loading; private drafts stay private.

**Stage / coverage / risk / environment / fixture:** current / partial / high / local and staging / synthetic owned business with isolated upload paths and safe image fixtures. AVIF publication/media delivery parity remains an explicit migration acceptance case.

**E2E:** `tests/e2e/image-crop.e2e.ts`, `tests/e2e/media-upload.e2e.ts`, `tests/e2e/media-rendering.e2e.ts`, `tests/e2e/contacts-ux.e2e.ts`.

## Card and manufacturing stories

### ADM-CARD-01 — Owner searches inventory

**Stage / coverage / risk / environment / fixture:** current / partial / high / local and staging / owner plus synthetic inventory; several filters are only conditionally covered when cards exist.

**As an owner,** I want to filter cards by serial/token, status, batch, and assigned page.

**Acceptance:** Filters validate safe input, show result counts, preserve mobile usability, and offer a clear reset action.

**E2E:** `tests/e2e/owner-cards.e2e.ts` read-only filter path.

### ADM-CARD-02 — Owner creates a manufacturing batch

**Stage / coverage / risk / environment / fixture:** current / blocked / critical / local and staging / isolated mutation database and required manufacturing migration.

**As an owner,** I want to create a batch of unassigned cards for an external printer.

**Acceptance:** Quantity is limited to 1–1,000, the operation is idempotent, tokens are random and stable, serials are unique, and new cards remain unassigned.

**E2E:** `tests/e2e/card-manufacturing.e2e.ts` with the migration applied to an isolated Supabase project.

### ADM-CARD-03 — Owner previews and downloads manufacturing files

**Stage / coverage / risk / environment / fixture:** current / blocked / high / local and staging / isolated batch fixture; ZIP/CSV content is verified by UI and artifact assertions.

**As a manufacturing operator,** I want a QR preview and a ZIP/CSV export that stays aligned with stored cards.

**Acceptance:** ZIP contains the manifest, NFC CSV, print instructions, and one QR SVG per card; CSV URLs match the permanent card token URLs.

**E2E:** `tests/e2e/card-manufacturing.e2e.ts`; unit coverage in `tests/unit/card-manufacturing.test.ts`.

### ADM-CARD-04 — Owner assigns or reassigns a card

**Stage / coverage / risk / environment / fixture:** current / blocked / critical / local and staging / isolated card/page fixture; same token must continue resolving after reassignment.

**As an owner,** I want to activate a card against an eligible published page and move it later when the business changes.

**Acceptance:** Only active businesses with active published pages are selectable; assignment is confirmed, history is recorded, and the same token resolves to the current slug.

**E2E:** `tests/e2e/owner-card-journey.e2e.ts` and `tests/e2e/owner-cards.e2e.ts`.

### ADM-CARD-05 — Owner disables a card

**Stage / coverage / risk / environment / fixture:** current / partial / critical / local and staging / isolated seeded card fixture; mutation tests are gated.

**As an owner,** I want to disable a lost or retired card.

**Acceptance:** Destructive action names the serial, requires confirmation, records the state transition, and routes future scans to the branded unavailable state.

**E2E:** Disable-and-scan test on an isolated database.

### ADM-CARD-06 — Owner copies NFC/QR links

**Stage / coverage / risk / environment / fixture:** current / partial / high / local and staging / owner card inventory fixture and stable token URL.

**As an owner,** I want to copy a card’s NFC URL without exposing unrelated data.

**Acceptance:** Copy control uses the stable token URL, reports copy success, and accepts `via=qr` or `via=nfc` only as analytics hints.

**E2E:** Card URL and redirect header assertions.

## System, state, and quality stories

### STATE-01 — Loading is intentional

**Stage / coverage / risk / environment / fixture:** current / not-covered / normal / local / controlled slow route or deterministic pending-state fixture; no such E2E test was found.

**As a user,** I want slow routes to show a branded loading state rather than a blank screen.

**Acceptance:** Root and admin loading screens preserve hierarchy, direction, and useful context.

**E2E:** Controlled slow-route or component-state test.

### STATE-02 — Recoverable errors are branded

**Stage / coverage / risk / environment / fixture:** current / partial / high / local and staging / invalid route/card and injected request failure fixtures.

**As a user,** I want a failed request to explain what happened and offer a next action.

**Acceptance:** Root, admin, global, 403, 404, and unavailable-card states hide technical noise and provide recovery links.

**E2E:** `tests/e2e/public-security.e2e.ts` plus injected error-state tests.

### STATE-03 — Destructive actions are protected

**Stage / coverage / risk / environment / fixture:** current / partial / critical / local and staging / isolated synthetic resource for confirm/cancel/pending keyboard cases.

**As an owner,** I want to confirm destructive card and section actions before they run.

**Acceptance:** Dialogs have unique labels, keyboard focus, cancel actions, disabled/pending states, and object-specific copy.

**E2E:** Confirmation dialog keyboard and cancel/submit tests.

### STATE-04 — Mobile is usable first

**Stage / coverage / risk / environment / fixture:** current / partial / high / local and staging / browser targets; the standard config covers 390px, not the complete 320–1440 matrix.

**As a phone user,** I want to complete public and admin tasks without horizontal overflow or tiny controls.

**Acceptance:** Layouts are validated at 320px, 360px, 390px, 768px, 1024px, and 1440px; tables have an intentional mobile strategy; fixed bars respect safe-area space.

**E2E:** Responsive viewport suite and screenshot review.

### STATE-05 — Keyboard and direction support work

**Stage / coverage / risk / environment / fixture:** current / partial / high / local and staging / public and admin keyboard flows, Arabic and English.

**As a keyboard, Arabic, or English user,** I want focus order, labels, direction, and visible focus states to remain correct.

**Acceptance:** Primary actions receive focus, form labels are associated, Arabic pages use RTL, English pages use LTR, and external links are safely marked.

**E2E:** Public focus/RTL tests plus login/admin keyboard tests. Preserve these user outcomes in the Cloudflare renderer and target admin when those surfaces are implemented.

### MIG-01 — Cloudflare publication preserves existing public contracts

**As the migration operator,** I want existing public URLs, data, and visitor behavior to remain correct through the cutover to Cloudflare.

**Acceptance:** Stable `/b/{slug}`, retained aliases, direct-profile QR URLs, `/c/{token}` QR/NFC links, VCF downloads, public media, and the `has_menu` link continue to work through cutover; warm HTML is CDN-served without Worker execution or database access; a failed publish can roll back; `/menu/*` remains owned by the Menu application.

**Stage / coverage / risk / environment / fixture:** migration-active / not-covered / critical / staging / paired legacy/Cloudflare fixtures, route/CDN header inspection, old-url registry, publish rollback fixture, and separate Menu route. Not countable until relevant migration routes exist.

**E2E:** planned migration-acceptance suite; retain existing PUB/AUTH/ADM story IDs and add this story only for cross-cutover behavior.

### MIG-02 — Published profile is a static CDN response

**As a visitor,** I want a warm business-profile URL to return the published artifact directly from the CDN.

**Acceptance:** A warm `/b/{slug}` response is a CDN hit with immutable/versioned artifact semantics and correct public cache headers. It causes no Worker invocation, D1/KV query, Supabase request, or Vercel origin request. A cold/unresolved slug follows only the explicitly approved fallback path and does not change the warm-hit contract.

**Stage / coverage / risk / environment / fixture:** planned / not-covered / critical / Cloudflare staging / synthetic publication artifact, edge headers/cache trace, and Worker invocation counter.

**E2E:** planned Cloudflare route test; assert response body, cache status, and invocation counters independently.

### MIG-03 — R2 media is immutable and device-appropriate

**As a visitor,** I want profile images served from the public media domain in a format and size supported by my device.

**Acceptance:** Published media uses content-hashed immutable URLs on `media.nextap.services`; mobile derivatives meet the migration PRD transfer/dimension budgets; AVIF publication works when supported and a compatible WebP/JPEG fallback is available; public responses have long-lived cache headers; unpublished originals and private media are not public.

**Stage / coverage / risk / environment / fixture:** planned / not-covered / high / Cloudflare staging / synthetic R2 objects in AVIF/WebP/JPEG, size variants, and a private sentinel.

**E2E:** planned R2 delivery test; verify bytes, content type, cache headers, fallback, and private-object denial.

### MIG-04 — Slug changes preserve printed and shared routes

**As a business customer,** I want old QR/NFC destinations and shared profile links to keep reaching the intended business after a slug change.

**Acceptance:** Current and retained slug aliases resolve to the same publication; reserved direct `/b/{slug}` QR URLs remain valid; `/c/{token}` continues to resolve the active assigned page; reassignment changes only the card destination; alias expiry follows the owner-approved retention rule.

**Stage / coverage / risk / environment / fixture:** planned / not-covered / critical / Cloudflare staging / old/new slug fixtures, direct-link QR inventory, and assigned/unassigned card tokens.

**E2E:** planned route compatibility test; verify old and new URLs and card redirects after a slug update/reassignment.

### MIG-05 — Publication changes invalidate cache and support rollback

**As an operator,** I want publication, unpublication, and rollback to become visible without serving a partially updated profile.

**Acceptance:** New immutable R2 artifacts are complete before the active publication pointer changes; slug resolution and edge cache reflect the new version within the agreed freshness bound; unpublish removes public access; failed publish leaves the previous version active; rollback restores a prior complete version without database work on a warm static hit.

**Stage / coverage / risk / environment / fixture:** planned / not-covered / critical / Cloudflare staging / two publication versions, injected artifact/pointer failures, purge observations, and unpublish marker.

**E2E:** planned publication contract test; inject each failure boundary and assert the active pointer and public response remain complete.

### MIG-06 — Internal admin publishes through the target control plane

**As an authorized NexTap admin,** I want to edit canonical records and publish a complete public profile without making visitors depend on admin services.

**Acceptance:** Internal admin authentication/authorization is enforced at the admin boundary; D1 stores canonical mutable business/page/card state and integrity constraints; application code owns domain rules; publish validates input, writes optimized R2 media and immutable artifacts, then atomically switches publication metadata; no public page request reads D1 or calls the admin Worker.

**Stage / coverage / risk / environment / fixture:** planned / not-covered / critical / isolated Cloudflare staging / synthetic admin, page draft, media, publication versions, and audit record.

**E2E:** planned admin publishing workflow; assert authorization, publication order, failure recovery, and public warm-hit independence separately.

### MIG-07 — Menu remains a separate application

**As a visitor,** I want an enabled menu banner to open the separate Menu & Ordering application.

**Acceptance:** Landing publication data contains only the menu availability flag and stable public menu URL/identifier needed for the link; the landing Worker does not query the Menu database or invoke the Menu Worker; `/menu/*` routing remains owned by the separate application and unaffected by profile routing/cache rules.

**Stage / coverage / risk / environment / fixture:** planned / not-covered / high / Cloudflare staging / menu-enabled and menu-disabled publications plus independent Menu route probe.

**E2E:** planned route coexistence test; verify the banner flag behavior and that `/menu/*` reaches the Menu application independently.

### OPS-01 — Diagnostics remain controlled

**As an operator,** I want diagnostic events to be generated only by an explicit test control and kept separate from ordinary user journeys.

**Acceptance:** Diagnostic routes are disabled by default, diagnostics-only requests do not run in ordinary E2E groups, and reports avoid sensitive event payloads.

**Stage / coverage / risk / environment / fixture:** current / blocked / normal / local and staging / explicit `SENTRY_TEST_ERRORS_ENABLED=1` diagnostics configuration and sanitized reporting.

**E2E:** `tests/e2e/sentry-observability.e2e.ts` (conditional; skipped runs do not count as covered).

## E2E execution plan

### Evidence and migration target status

The Cloudflare target stories `MIG-01` through `MIG-07` are intentionally planned/not-covered until target routes and isolated fixtures exist. They are the default selection for migration implementation; legacy stories remain for customer-outcome parity and old-URL compatibility. `STATE-01` is unmapped. `AUTH-02` has passing isolated-local mobile evidence; Staging remains unverified, so coverage is partial. `ADM-BIZ-06` is mutation-gated and requires a disposable database. `MKT-03` remains partial until the configured WhatsApp case is run. A story with no target test is a visible target gap; do not substitute a legacy test as proof of Cloudflare behavior.

### Selection and evidence policy

The runner supports file, test-tag, title-regex, target, agent, and last-failed selection. The path selector also supports `--track cloudflare-target` and `--track legacy-baseline`. Review each selected test with `e2e list` before execution. Use one worker for shared databases, `--retries 0` for mutation journeys unless the operation is idempotent, and retain runtime isolation guards regardless of tags. A skipped test is blocked, not evidence. Full target regression is a migration phase/release gate, not the default for every source edit.

Tag examples:

```ts
test("anonymous visitors see a branded unknown-slug state", {
  tags: ["story:PUB-06", "domain:public", "risk:normal", "env:local", "env:staging", "mutation:read"],
}, async ({ app, screen }) => { /* ... */ });
```

Use `test.skip` prerequisites and provide the concrete blocker. A tag is not authorization. Target write tests must verify the isolated Cloudflare environment and synthetic fixture before changing state. Run legacy and Cloudflare checks together only for parity/cutover gates; a legacy pass cannot stand in for a target pass.

### Safe anonymous suite

This is a legacy-baseline smoke suite; it does not validate Cloudflare delivery.

```powershell
npx.cmd e2e run --config e2e.config.ts --target mobile tests/e2e/public-journey.e2e.ts tests/e2e/public-security.e2e.ts --workers 1 --retries 0
```

This suite is read-only against the app's configured backend because it does not mutate owner data. Its purpose is to preserve current behavior during migration, not to certify the target architecture.

### Legacy owner read-only suite

Run only when legacy auth/admin compatibility is in scope. Do not use this suite as target admin evidence. Do not enable mutation tests against a shared or production database.

### Legacy isolated mutation suite

Set `E2E_ALLOW_MUTATIONS=true` only when the legacy Supabase project is explicitly disposable and isolated, with required migrations. These tests maintain baseline/parity evidence only; they do not verify the target D1/admin publishing contract. Then run:

```powershell
npx.cmd e2e run --config e2e.config.ts --target desktop tests/e2e/admin-reordering.e2e.ts tests/e2e/owner-card-journey.e2e.ts tests/e2e/card-manufacturing.e2e.ts --workers 1 --retries 0
```

### Definition of done

Every non-retired story has a stage, coverage state, risk, environment and fixture prerequisites, and mapped tests or an explicit blocker. New migration implementation changes select target-track contracts. Legacy stories remain active only for outcome parity and URL/card compatibility until the matching migration exit gate passes. Cloudflare stories gain passing evidence only from Cloudflare-compatible local/staging environments; Supabase/Vercel tests cannot prove CDN, R2, D1, KV, or Worker behavior. Mutation runs require an isolated disposable target and runtime guard; Production is rejected before mutation.
