# Business Editor reliability — phases 1–3

Date: 2026-10-11. Branch: `fix/business-editor-reliability`, based on validated preproduction commit `e98948e`.

## Scope and result

Implemented the requested payment fallback, editor isolation, repeated provider/action items, inheritance controls, and removable text. Phase 4's interactive profile-image crop is **not implemented**: the user requested phases 1–3. Verification and this handoff cover that scope. No merge, deployment, database migration, RLS change, card-token change, or production data mutation was performed.

## Root causes and reproduction

1. Working Hours entries were created with `provider: "custom"`. Provider-profile construction included Hours, and `updateItems` wrote edited hours into the shared `custom` profile. Save and public rendering resolved unrelated `custom` entries against that profile. The desktop regression reproduced Monday changing from `09:00–17:00` to Tuesday's `11:00–19:00` after Save Draft/reload. The focused unit regression also proved custom profiles overwrote independent entries. This explains cross-section value leakage; a shared-object reference was not required to reproduce it.
2. Provider default changes were detected by comparing array indexes. Reordering could therefore be mistaken for a destination edit. React row keys and form identities also depended on indexes.
3. The provider picker treated a provider as a singleton: choosing an existing provider focused its first item instead of adding another.
4. Item normalization/save discarded fields outside a generic item shape. Saving a cleared section title used `title || kind`, restoring unwanted text. Public components separately forced headings, overlines, and descriptions.
5. Public Hours rendering reused the first Hours section's rows for every Hours section. Quick Actions rendering omitted additional sections of the same kind.
6. RTL text direction reversed numeric ranges visually. Hours values and the hero's opening summary now isolate their left-to-right numeric content.

The initial commands `npx.cmd vitest run tests/unit/editor-isolation.test.ts` and `npx.cmd e2e run tests/e2e/editor-reliability.e2e.ts --target desktop --trace=on` failed on the shared custom profile and saved Monday value respectively. These regressions pass after the fix.

## Item model, persistence, and inheritance

- `src/lib/business/editor-items.ts` is the normalization boundary. Existing JSON receives deterministic legacy IDs once; new entries receive UUIDs. IDs persist through save/reload, deletion, and reordering. Repeated legacy IDs are repaired within their section.
- Hours and gallery entries do not participate in provider inheritance. Hours normalization removes destination/provider semantics; section-specific validation rejects those semantics at the save boundary. Custom links never inherit a global `custom` destination, including when an old saved profile contains one.
- Editor updates match items by ID and compare the previous **resolved** item before changing a business default. Reordering, relabeling, and toggling an override do not change defaults.
- Every provider-picker click adds a new item, up to the existing 100-item limit. Repeated WhatsApp, social links, payment actions, and custom URLs keep independent IDs and ordering.
- `Use business default` and `Override for this item` make inheritance explicit. Editing an inherited destination updates that business default; the UI explains this. Overrides remain independent. Clearing a default does not resurrect stale item values.
- Services support multiple entries, each with an optional destination, description, and multiple ordered custom CTA buttons. Nested service buttons have independent persisted IDs.
- No migration was needed: these are backward-compatible JSON additions in existing section content and provider profiles. Previously overwritten saved values cannot be reconstructed automatically; owners must restore any already-corrupted values from their source records.

## Optional text

The section heading and reusable eyebrow, description, and badge fields can be edited, cleared, and restored. Item labels, subtitles, and badges are optional; gallery captions follow the same behavior. Existing template wording remains the initial fallback only when a field is absent. An explicit empty string stays empty through persistence and publication.

Public pages, owner preview, and the live simulator share the renderer. Empty text does not produce empty heading/description wrappers, and cleared text no longer triggers hard-coded replacement headings. Icon-only links keep accessible provider names. Payment labels and secondary text suppress recipient-shaped strings. Existing section styling and responsive four-column action wrapping are retained.

## InstaPay strategy and evidence

The saved staging destination was inspected in memory without logging its token. Two saved occurrences resolved to one distinct `https://ipn.eg` destination, with four path segments, no query keys, and no fragment. Neither the raw destination nor recipient data is included in evidence.

`scripts/observability/instapay-browser-check.mjs` visited that existing destination using iPhone 13/WebKit and Pixel 7/Chromium profiles. Both returned HTTP **200** at the same origin/path shape, with **no HTTP redirect chain**. The resulting page exposed HTTPS, `ipn:`, and app-store links. No QR element was detected by the script's limited DOM check. This is a browser observation, not proof of native app opening or a general provider URI contract.

First-party pages rechecked on 2026-10-11:

- [InstaPay official Q&A](https://www.instapay.eg/?page_id=348&lang=en)
- [InstaPay official home and transfer instructions](https://www.instapay.eg/?lang=en)

These sources describe IPA entry and beneficiary verification inside the app, but did not specify a recipient-prefill URL grammar, Android intent contract, or token construction algorithm. NexTap therefore preserves the **complete owner-supplied HTTPS destination unchanged**, with same-tab, direct user-initiated navigation. It does not synthesize an `intent://` or `ipn:` URL, append an IPA, wrap the link in an internal redirect, or claim provider verification.

An adjacent, keyboard-accessible `InstaPay app didn't open?` disclosure provides a direct retry link, instructions for a provider QR page, Android supported-link settings guidance, and official help. It is available before navigation and when returning from the provider page; there is no unreliable timer claiming to detect app installation. Existing identifier-only copy/instructions fallback remains available. Clipboard failure was exercised through Playwright MCP: guidance remained usable and the recipient was absent from dialog text.

Synthetic destination checks in both browser engines verified exact query preservation, same-tab navigation, and accessible fallback. Actual native handoff remains unverified.

## Existing profile-image behavior

The existing `ImageField` uploads a prepared JPEG/PNG/WebP through the managed-media API, tracks pending uploads, and persists the resulting logo URL and alt text in the hero content. The public renderer uses `ManagedImage` inside the circular `.business-logo` frame with centered `object-fit: contain`. There is no interactive pan, zoom, focal-point metadata, or crop control in this phase. Crop before/after evidence is therefore not applicable.

The existing managed-media E2E journey passed on desktop and mobile: actual cover/logo/map/gallery uploads, invalid-image rejection, pending-upload save guards, draft reload, publication, and public image rendering.

## Changed files

- Model/validation: `src/lib/business/editor-items.ts`, `content.ts`, `providers.ts`, `section-text.ts`.
- Editor/save: `src/app/admin/businesses/_components/business-editor.tsx`, `item-editor.tsx`, `section-content-editor.tsx`, and `src/app/admin/businesses/actions.ts`.
- Shared rendering: `src/components/business/public-snapshot.tsx`, `deferred-gallery.tsx`, `gallery-view.tsx`, and `src/app/globals.css`.
- Tests: `tests/unit/editor-isolation.test.ts`, `optional-public-text.test.ts`, `draft-compatibility.test.ts`, `payment-public.test.ts`, `tests/e2e/editor-reliability.e2e.ts`, and a publication-cache wait in `business-editor-actions.e2e.ts`.
- Verification: `e2e.reliability.config.ts`, `scripts/observability/instapay-browser-check.mjs`, `scripts/observability/editor-reliability-evidence.mjs`, this report, and the documentation index.

## Commands and results

PowerShell uses `npm.cmd`/`npx.cmd` because the host blocks the `.ps1` launchers. All mutating journeys used staging and newly created fixtures.

| Command/check | Result |
| --- | --- |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run lint` | Passed, 0 errors; 11 existing image/unused-variable warnings |
| `npm.cmd test` | 97 tests passed across 18 files |
| `npm.cmd run build` | Fresh production build passed |
| `git diff --check` | Passed |
| Impeccable detector on changed UI/CSS | No findings (`[]`) |
| Production-mode e2e: reliability, existing editor actions, public journey, public security, action layout; desktop/mobile | All 34 scenarios passed across the full run and focused last-failed rerun |
| Production-mode `e2e.reliability.config.ts` | Full editor workflow passed in iPhone-profile WebKit |
| Production-mode `media-upload.e2e.ts --grep 'managed images'`, desktop/mobile | Both journeys passed |
| `node scripts/observability/editor-reliability-evidence.mjs` | Passed; private preview, save/reload/publish, desktop/mobile/RTL screenshots, sanitized Playwright trace, two mobile-engine payment checks; 0 page errors and 0 failed app requests |
| `node scripts/observability/instapay-browser-check.mjs` | Both mobile profiles reached the existing provider page; redacted evidence saved |
| Chrome DevTools AXI | Final production console had no errors; image requests returned 200/304 |
| Playwright MCP | RTL, LTR time ranges, removed headings, no overflow/broken images, and clipboard-unavailable fallback verified |

The regression command used:

```powershell
$env:E2E_ALLOW_MUTATIONS='true'
$env:E2E_SERVER_MODE='production'
npx.cmd e2e run tests/e2e/editor-reliability.e2e.ts tests/e2e/business-editor-actions.e2e.ts tests/e2e/quick-actions-layout.e2e.ts tests/e2e/public-security.e2e.ts tests/e2e/public-journey.e2e.ts --target desktop,mobile --trace=on --output .e2e/reliability-final
npx.cmd e2e run --last-failed --output .e2e/reliability-final --trace=on
npx.cmd e2e run --config e2e.reliability.config.ts --trace=on --output .e2e/reliability-webkit
npx.cmd e2e run tests/e2e/media-upload.e2e.ts --grep 'managed images' --target desktop,mobile --trace=on --output .e2e/reliability-media
```

One existing editor journey initially saw a cached unpublished 404 after publishing. The established publication resolver caches lookups for five seconds. Both editor tests now use bounded `expect.poll` against the public response before checking the page; production cache behavior was preserved. Another test-only failure attempted to delete an immutable published fixture; cleanup now deactivates and archives fixtures instead. WebKit uses the visible toggle label rather than clicking the small checkbox directly. None of these failures was suppressed or marked skipped.

## Evidence

Generated local evidence is intentionally gitignored under `artifacts/business-editor-reliability/`:

- `editor-desktop.png`, `editor-mobile.png`
- `simulator.png`, `simulator-mobile.png`
- `public-desktop.png`, `public-mobile-rtl.png`
- `editor-workflow.zip` — passing Playwright editor trace, recorded after login; cookie/authorization headers and cookie arrays sanitized before delivery
- `browser-evidence.json` — exact browser verification outcomes
- `instapay-redacted.json` — status/origin/shape-only provider navigation evidence
- `fixture.json` — isolated staging fixture reference for reproducing the evidence

The trace was scanned for the test password and JWT-shaped strings: **0 matches**. No real InstaPay destination was traced or screenshotted. E2E reports: `.e2e/reliability/report.json`, `.e2e/reliability-final/report.json`, `.e2e/reliability-webkit/report.json`, and `.e2e/reliability-media/report.json`. The final report reflects the focused rerun; the full-run terminal result was 33 passed/1 cache-related failure, followed by that remaining scenario passing.

## Physical-device matrix — still required

| Device/setup | Manual check | Status |
| --- | --- | --- |
| iPhone Safari, InstaPay installed | Tap the exact saved HTTPS link; confirm native handoff and beneficiary; stop before submitting a transfer | Not run on physical hardware |
| Android Chrome, installed, supported links enabled | Confirm direct app handoff and beneficiary without an internal NexTap redirect | Not run on physical hardware |
| Android, InstaPay absent | Confirm provider web/store behavior; return to NexTap and use visible retry/help guidance | Browser fallback verified; physical check pending |
| Android, supported links disabled | Confirm provider web landing; follow settings guidance and retry | Browser fallback verified; physical check pending |

## Remaining work and readiness

Phases 1–3 are ready for review within the verified browser scope. Physical-device payment handoff remains a release verification item. Phase 4's profile-image crop remains separate work. Existing previously-corrupted saved values may need owner correction; this change prevents further leakage rather than guessing lost data. The existing bounded publication-cache delay remains in place. No production-readiness claim is made for native payment handoff.
