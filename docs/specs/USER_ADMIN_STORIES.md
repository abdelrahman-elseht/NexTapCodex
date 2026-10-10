# NexTap user and admin stories

This catalog is the behavioral contract for NexTap and the source of truth for end-to-end coverage. Each story describes a user outcome, the observable acceptance criteria, and the test path that should prove it. Tests should use the public UI and real Supabase-backed routes wherever the environment is available.

## Test actors and environments

| Actor | Goal | Required access |
| --- | --- | --- |
| Visitor | Understand NexTap and open a business page from a card or QR code. | Anonymous browser session |
| Business customer | Read a business microsite and use contact, directions, reviews, social, hours, services, and payment details. | Anonymous mobile browser |
| NexTap owner/admin | Manage businesses, pages, sections, cards, batches, assignments, publishing, and exports. | Supabase Auth user linked in `public.owner_users` |
| Manufacturing operator | Download a batch package and use its QR/NFC manifest. | Owner/admin access and an isolated test database |

### Credential handling

The owner test account is configured in the ignored local `.env.local` file with:

```text
E2E_USER_OWNER_USERNAME=<local secret>
E2E_USER_OWNER_PASSWORD=<local secret>
```

The values must never be copied into this catalog, an E2E test file, a screenshot, a PR description, or Git history. Use a dedicated Supabase project or branch for mutation tests. The current `e2e.config.ts` loads these variables automatically.

## Public marketing stories

### MKT-01 — Visitor understands the product

**As a visitor,** I want to understand what NexTap does within the first viewport so I can decide whether to explore the demo.

**Acceptance:** The landing page presents the NFC/QR card promise, a clear primary CTA, a product/card composition, and supporting proof without requiring horizontal scrolling.

**E2E:** `tests/e2e/public-journey.e2e.ts` landing test; responsive checks at 320, 360, 390, 768, 1024, and 1440px.

### MKT-02 — Visitor opens the demo

**As a visitor,** I want to open an illustrative business page from the landing page.

**Acceptance:** Both the hero CTA and the supporting demo CTA navigate to `/demo`; sample content is clearly presented as illustrative.

**E2E:** `tests/e2e/public-journey.e2e.ts` landing and demo tests.

### MKT-03 — Visitor reaches the contact CTA

**As a visitor,** I want to contact NexTap from the landing page when a contact number is configured.

**Acceptance:** A configured WhatsApp destination is used once; when no number is configured, the interface does not render duplicate or misleading contact actions.

**E2E:** Landing CTA test with configured and unconfigured contact fixtures.

### MKT-04 — Visitor changes language

**As a visitor,** I want the marketing and login surfaces to support Arabic RTL and English LTR.

**Acceptance:** Text, direction, navigation, forms, and primary actions remain usable after switching language.

**E2E:** Login language test plus document `lang`/`dir` assertions on public routes.

## Public business microsite stories

### PUB-01 — Visitor reads a published business page

**As a customer,** I want to see the business identity immediately after tapping or scanning a card.

**Acceptance:** Cover, logo/profile mark, business name, category, tagline, and primary actions render above the content sections.

**E2E:** Published business fixture test.

### PUB-02 — Visitor takes an immediate action

**As a mobile customer,** I want thumb-friendly actions for calling, WhatsApp, directions, reviews, and social links.

**Acceptance:** Action URLs are correct, tappable controls are at least touch-sized, and the fixed mobile action bar does not cover content or footer links.

**E2E:** Mobile microsite action and footer tests; no-overflow assertion.

### PUB-03 — Visitor reads business sections

**As a customer,** I want to find about, opening hours, contact/address, services/menu, payments, gallery, social, branch, and reviews content when the business enables those sections.

**Acceptance:** Enabled sections render in saved order; disabled sections do not render; items preserve labels, values, and external links.

**E2E:** Snapshot fixtures covering every section kind and variable item count.

### PUB-04 — Visitor understands payment information

**As an Egyptian customer,** I want to see external payment/contact instructions such as InstaPay, Vodafone Cash, bank transfer, or a custom note.

**Acceptance:** Payment details are presented as informational external instructions; NexTap never implies that it processes the payment.

**E2E:** Payment section fixture and copy assertion.

### PUB-05 — Visitor sees a useful unavailable state

**As a customer,** I want a clear recovery path when a card is unassigned, inactive, replaced, or invalid.

**Acceptance:** The page explains the state in plain language, avoids technical data leakage, and links to the NexTap home or demo where appropriate.

**E2E:** Invalid token security test plus unassigned/inactive state fixtures.

### PUB-06 — Visitor sees a useful not-found state

**As a customer,** I want an invalid business slug to show a branded recovery page rather than a blank profile or stack trace.

**Acceptance:** The page offers home and demo recovery links and contains no `undefined`, `null`, or technical error noise.

**E2E:** `tests/e2e/public-security.e2e.ts` unknown business and unknown route tests.

## Authentication and access stories

### AUTH-01 — Owner signs in

**As an authorized NexTap owner,** I want to sign in with my Supabase email and password and reach the admin dashboard.

**Acceptance:** A valid Auth credential whose UUID exists in `public.owner_users` redirects to `/admin` and establishes a cookie-backed session.

**E2E:** Authenticated owner smoke test using the ignored local credentials.

### AUTH-02 — Invalid sign-in is safe

**As a visitor,** I want a failed sign-in to explain the problem without exposing whether an account exists.

**Acceptance:** Invalid credentials return to login with a generic message; no session is created.

**E2E:** Invalid password test.

### AUTH-03 — Authenticated non-owner is denied

**As a NexTap operator,** I want admin access limited to allowlisted owner accounts.

**Acceptance:** A valid Auth user absent from `public.owner_users` is signed out and receives the unauthorized message.

**E2E:** Dedicated non-owner fixture test.

### AUTH-04 — Anonymous admin routes are protected

**As an anonymous visitor,** I should not be able to read owner data or export cards.

**Acceptance:** `/admin`, business editors, card inventory, and CSV/ZIP exports redirect to login.

**E2E:** `tests/e2e/public-security.e2e.ts` anonymous owner-route test.

### AUTH-05 — Owner signs out

**As an owner,** I want sign-out to invalidate the browser session.

**Acceptance:** The sign-out route clears the Supabase session and subsequent admin navigation returns to login.

**E2E:** Authenticated sign-out and post-logout redirect test.

## Business and page administration stories

### ADM-BIZ-01 — Owner views the dashboard

**As an owner,** I want an overview of businesses, published pages, card inventory, and next actions.

**Acceptance:** The dashboard loads with useful counts, clear navigation, empty states, loading states, and links to businesses and cards.

**E2E:** Authenticated admin smoke test.

### ADM-BIZ-02 — Owner lists and filters businesses

**As an owner,** I want to find a business by name, slug, status, or template.

**Acceptance:** The list is readable on mobile and desktop, displays active/archive/publish status, and links to edit and preview.

**E2E:** Business list search/filter test.

### ADM-BIZ-03 — Owner creates a business page

**As an owner,** I want to create a business and its first page using a template.

**Acceptance:** Required name, category, slug, and template validation works; a successful create redirects to the editor; duplicate/invalid slugs show recovery copy.

**E2E:** `tests/e2e/owner-card-journey.e2e.ts` create flow on an isolated mutation database.

### ADM-BIZ-04 — Owner edits business settings

**As an owner,** I want to update name, category, slug, template, and active/archive state.

**Acceptance:** Save reports success, preserves valid data, revalidates editor/public routes, and keeps old card tokens resolving to the renamed slug.

**E2E:** Owner journey rename and redirect assertions.

### ADM-BIZ-05 — Owner edits section content

**As an owner,** I want a structured editor for hero, contact, about, reviews, and repeatable item sections.

**Acceptance:** Field mode supports typed fields and repeatable items; advanced JSON mode validates objects; item add/remove and limits work; malformed content cannot be saved.

**E2E:** Section editor field/JSON validation test.

### ADM-BIZ-06 — Owner adds, removes, enables, and disables sections

**As an owner,** I want to control which sections appear on the public page.

**Acceptance:** Add/remove actions are scoped to the page, destructive removal is confirmed, disabled sections remain editable but do not render publicly, and success/error states are visible.

**E2E:** Section lifecycle test on an isolated mutation database.

### ADM-BIZ-07 — Owner reorders sections

**As an owner,** I want the public page to follow the editorial order I choose.

**Acceptance:** Up/down controls and drag affordance preserve order after save and reload; public rendering follows the same order.

**E2E:** `tests/e2e/admin-reordering.e2e.ts` with `E2E_ALLOW_MUTATIONS=true` only on an isolated database.

### ADM-BIZ-08 — Owner previews before publishing

**As an owner,** I want to preview draft content without exposing it publicly.

**Acceptance:** Preview shows draft sections and a clear preview state; the public slug continues showing the last published snapshot until publish.

**E2E:** `tests/e2e/owner-card-journey.e2e.ts` draft privacy and preview assertions.

### ADM-BIZ-09 — Owner publishes a page

**As an owner,** I want to publish a reviewed draft as an immutable snapshot.

**Acceptance:** Publish reports success, public pages show the new snapshot, and unpublished changes remain private.

**E2E:** Owner journey publish assertions.

### ADM-BIZ-10 — Owner manages branches and templates

**As an owner,** I want branch pages and templates to share the same editing and publish model.

**Acceptance:** Branch metadata is editable, template selection is clear, and branch/public routes preserve mobile and RTL behavior.

**E2E:** Branch creation, template selection, and preview tests.

## Card and manufacturing stories

### ADM-CARD-01 — Owner searches inventory

**As an owner,** I want to filter cards by serial/token, status, batch, and assigned page.

**Acceptance:** Filters validate safe input, show result counts, preserve mobile usability, and offer a clear reset action.

**E2E:** `tests/e2e/owner-cards.e2e.ts` read-only filter path.

### ADM-CARD-02 — Owner creates a manufacturing batch

**As an owner,** I want to create a batch of unassigned cards for an external printer.

**Acceptance:** Quantity is limited to 1–1,000, the operation is idempotent, tokens are random and stable, serials are unique, and new cards remain unassigned.

**E2E:** `tests/e2e/card-manufacturing.e2e.ts` with the migration applied to an isolated Supabase project.

### ADM-CARD-03 — Owner previews and downloads manufacturing files

**As a manufacturing operator,** I want a QR preview and a ZIP/CSV export that stays aligned with stored cards.

**Acceptance:** ZIP contains the manifest, NFC CSV, print instructions, and one QR SVG per card; CSV URLs match the permanent card token URLs.

**E2E:** `tests/e2e/card-manufacturing.e2e.ts`; unit coverage in `tests/unit/card-manufacturing.test.ts`.

### ADM-CARD-04 — Owner assigns or reassigns a card

**As an owner,** I want to activate a card against an eligible published page and move it later when the business changes.

**Acceptance:** Only active businesses with active published pages are selectable; assignment is confirmed, history is recorded, and the same token resolves to the current slug.

**E2E:** `tests/e2e/owner-card-journey.e2e.ts` and `tests/e2e/owner-cards.e2e.ts`.

### ADM-CARD-05 — Owner disables a card

**As an owner,** I want to disable a lost or retired card.

**Acceptance:** Destructive action names the serial, requires confirmation, records the state transition, and routes future scans to the branded unavailable state.

**E2E:** Disable-and-scan test on an isolated database.

### ADM-CARD-06 — Owner copies NFC/QR links

**As an owner,** I want to copy a card’s NFC URL without exposing unrelated data.

**Acceptance:** Copy control uses the stable token URL, reports copy success, and accepts `via=qr` or `via=nfc` only as analytics hints.

**E2E:** Card URL and redirect header assertions.

## System, state, and quality stories

### STATE-01 — Loading is intentional

**As a user,** I want slow routes to show a branded loading state rather than a blank screen.

**Acceptance:** Root and admin loading screens preserve hierarchy, direction, and useful context.

**E2E:** Controlled slow-route or component-state test.

### STATE-02 — Recoverable errors are branded

**As a user,** I want a failed request to explain what happened and offer a next action.

**Acceptance:** Root, admin, global, 403, 404, and unavailable-card states hide technical noise and provide recovery links.

**E2E:** `tests/e2e/public-security.e2e.ts` plus injected error-state tests.

### STATE-03 — Destructive actions are protected

**As an owner,** I want to confirm destructive card and section actions before they run.

**Acceptance:** Dialogs have unique labels, keyboard focus, cancel actions, disabled/pending states, and object-specific copy.

**E2E:** Confirmation dialog keyboard and cancel/submit tests.

### STATE-04 — Mobile is usable first

**As a phone user,** I want to complete public and admin tasks without horizontal overflow or tiny controls.

**Acceptance:** Layouts are validated at 320px, 360px, 390px, 768px, 1024px, and 1440px; tables have an intentional mobile strategy; fixed bars respect safe-area space.

**E2E:** Responsive viewport suite and screenshot review.

### STATE-05 — Keyboard and direction support work

**As a keyboard, Arabic, or English user,** I want focus order, labels, direction, and visible focus states to remain correct.

**Acceptance:** Primary actions receive focus, form labels are associated, Arabic pages use RTL, English pages use LTR, and external links are safely marked.

**E2E:** Public focus/RTL tests plus login/admin keyboard tests.

## E2E execution plan

### Safe anonymous suite

```powershell
npx.cmd e2e run --config e2e.config.ts --target mobile tests/e2e/public-journey.e2e.ts tests/e2e/public-security.e2e.ts --workers 1 --retries 0
```

This suite is safe against a shared project because it does not mutate owner data.

### Owner read-only suite

Run the owner login smoke and inventory/filter tests with the local owner variables. Do not enable mutation tests against a shared or production database.

### Isolated mutation suite

Set `E2E_ALLOW_MUTATIONS=true` only when the configured Supabase project is disposable or an isolated branch with the required migrations. Then run:

```powershell
npx.cmd e2e run --config e2e.config.ts --target desktop tests/e2e/admin-reordering.e2e.ts tests/e2e/owner-card-journey.e2e.ts tests/e2e/card-manufacturing.e2e.ts --workers 1 --retries 0
```

### Definition of done

The suite is complete when every story has either a passing E2E test or a documented environment prerequisite, no test stores credentials in source, public and owner paths pass at mobile and desktop widths, and mutation tests have run against an isolated Supabase database with the manufacturing migration applied.
