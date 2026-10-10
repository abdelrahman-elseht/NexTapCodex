# Payment icon and action implementation

Implemented on branch `beta01.6`, 2026-10-09; updated for the subsequent request to open owner-supplied payment links directly. This applies `payment-redirect-handoff.md` on top of the existing working-tree changes. No merge or deployment was performed.

## Result

- InstaPay and Vodafone Cash use the supplied monochrome SVGs in `public/icons/payment/`, including the owner picker and item editor. `PaymentLogo` falls back to the existing local PNG and then a local text mark. Failed preloads before React hydration also recover.
- The payment card/logo is the accessible button. Labels remain optional; icon-only payments save, reload, preview and publish. The public copy-identifier button is removed from Payments and Quick Actions.
- When a complete HTTPS provider link is set, Payments and payment Quick Actions open the exact supplied URL in the same tab. Link-only cards work without an IPA/wallet value; legacy copy settings do not override a supplied link. Draft saving records `external_url`. Provider app opening and recipient prefill are handled by the supplied link and the phone. No link/token is generated and no clipboard operation occurs for this action.
- Without a link, `copy_identifier` performs an intentional clipboard action and shows identifier-free provider guidance. Clipboard denial explains recovery without revealing the saved recipient. `instructions` shows generic guidance and asks the payer to obtain details from the business; saved bank instructions remain in the protected editor.
- The native dialog traps focus, supports Escape, restores focus, and provides Arabic RTL and English LTR text. All payment work must be completed in the official provider service. NexTap neither submits nor confirms payment.
- Provider identity comes from provider metadata; labels never become provider IDs. Legacy social icons can resolve from destination hostnames. Shared profiles resolve across sections; explicit item-level overrides win. A label containing the saved recipient, including a differently formatted wallet number, is omitted publicly.
- Shared InstaPay/Vodafone/bank HTTPS provider links and explicit item overrides work directly. Unsafe schemes, HTTP payment links, and URL credentials are rejected by the public payment resolver. Custom external checkout URLs retain their existing behavior. LinkedIn remains the existing monochrome local SVG.

## Provider verification and asset provenance

The current first-party pages were re-fetched successfully on 2026-10-09:

- https://www.instapay.eg/?page_id=348&lang=en
- https://www.instapay.eg/?lang=en
- https://web.vodafone.com.eg/en/money-transfer

No recipient-prefill URL/URI grammar or token encoding is documented in the reviewed sources. The official InstaPay app supports an in-app IPA transfer; Vodafone documents the Egyptian `*9*7#` service flow. No reviewed InstaPay page establishes the ownership or token semantics of `ipn.eg/S/x/`. No link was manufactured or payment attempted. The user subsequently explicitly requested opening complete owner-supplied payment URLs. These are now supported as `external_url`, using the exact supplied destination in the same tab. This changes the earlier verification gate for owner-supplied links; the gate still applies to generating recipient-prefill links or claiming a provider-verified contract. Without a link, the instructions/copy fallback remains. App availability and handoff behavior belong to the provider link and operating system.

See [provider-destination-research.md](provider-destination-research.md) for source dates, supported surfaces, recipient inputs and the destination gate. See [payment asset sources](../public/icons/payment/SOURCES.md) for original/final paths, retrieval dates, transformations, attribution and licensing decisions. Vodafone's supplied path exactly matches Simple Icons' CC0 geometry; the specific SVG Repo asset license could not be confirmed because requests returned HTTP 429. InstaPay's original author and redistribution terms remain undocumented; the supplied asset is incorporated as requested, with rights confirmation still required before shipping.

## Validation and artifacts

### Continuation verification (2026-10-10)

Quick Actions follow-up: the owner-selected one-to-four column count is now
honored on mobile and in Live Preview. The 800px and 420px media queries had
silently capped configured Quick Actions at two columns. Those caps were removed;
labels wrap within the tiles. Payment-grid responsiveness retains its existing
behavior.

`tests/quick-actions-layout.e2e.ts` first reproduced the mobile failure (`expected
2 to be 4`) and now passes on desktop and mobile, checking actual row placement,
all four column selections in a 300px phone preview, no overflow, and minimum
44px tile widths. The owner/editor test now checks four columns in live preview
and after save/reload/publish on both targets. Public/security/layout E2E passed
30 cases; owner/editor E2E passed 2 cases; typecheck and all 25 unit tests passed.
Impeccable's CSS detector reported no findings. The final layout-only rerun passed
2 cases, report `artifacts/quick-actions-e2e/report.json`. The captured
[mobile preview](../artifacts/quick-actions-mobile-final.png) and
[desktop preview](../artifacts/quick-actions-desktop-final.png) were visually
inspected. These use illustrative demo data and Chromium viewports, not a physical
iPhone. Chrome DevTools CLI was unavailable because of a Windows ESM path-loader
error; the alternative browser surface was unavailable, so screenshots came from
the E2E browser fixture.

Before the Quick Actions follow-up, the payment implementation was revalidated
without changing payment destination behavior or UI. `npm.cmd run typecheck`
passed; `npm.cmd test` passed all 25 tests
in 4 files. Public journey/security E2E passed all 28 desktop/mobile cases (run
`01a123a2-f412-79f8-8051-490fe080357c`). Mutation-enabled owner/editor E2E passed
all 4 desktop/mobile cases (run `01a123a4-8426-7582-9f3f-f2cb39ec6f98`); its current
report is `.e2e/report.json`. The manual Impeccable detector returned `[]` for
the same six changed UI targets, and `git diff --check` passed. The screenshots
and provider research below are the existing 2026-10-09 evidence; no new native
app launch, provider-contract verification, merge, or deployment was performed.

### Original implementation validation (2026-10-09)

- `npm.cmd run typecheck`: passed.
- `npm.cmd test`: 22 tests passed in 4 files. Tests include public recipient privacy, recipient-containing labels, unverified destination rejection, profile inheritance and overrides, and bank privacy.
- Public journey/security E2E: 28 tests passed across desktop and mobile in the isolated run. Security coverage includes copy failure, local SVG/PNG failures, pre-hydration failures, keyboard activation, Escape/focus restoration, identifier-free rendered text/names/hrefs, owner-route protection, and RTL/mobile layouts.
- Owner editor/card E2E: all 4 tests passed across desktop and mobile, including draft reload, Live Preview, Publish, optional icon-only payment labels, external custom checkout links, monochrome LinkedIn, card activation, scan resolution, rename and reassignment. Results are recorded in `artifacts/payment-owner-e2e/report.json`.
- Impeccable detector: no findings on all six changed UI files. `git diff --check`: passed.

E2E now uses `.next-e2e` through `NEXTAP_BUILD_DIR`, separate from the active developer server's `.next`. This resolves build-cache collisions observed during initial runs (intermittent route 404s and unavailable app responses). A card-inventory confirmation assertion reads the status directly with a longer wait while preserving its exact expected message. Normal development continues using `.next`.

Desktop and mobile captures:

- [Desktop payment cards](../artifacts/payment-desktop-section-final.png)
- [Mobile payment cards, 390px](../artifacts/payment-mobile-section-final.png)
- [Mobile fallback dialog](../artifacts/payment-mobile-fallback-final.png)
- [Mobile action trace from Chrome DevTools](../artifacts/payment-mobile-action-trace.txt)
- [Mobile dialog accessibility snapshot from Chrome DevTools](../artifacts/payment-mobile-accessibility.txt)
- Full public E2E report and screenshots: `artifacts/payment-public-e2e/`.

The Chrome DevTools CLI supplied the mobile action trace and accessibility evidence. Its final screenshot calls failed to return a saved path, so the final screenshots were captured by the E2E browser fixture and visually inspected. Evidence uses illustrative test data only and never shows a payment recipient or credentials.

## Remaining provider limitations

Owner-supplied HTTPS payment links now navigate directly; opening the native app still depends on that provider link, the installed app and the phone. The browser test verifies navigation to an intercepted reserved test host, not a real transfer or a native app launch. Generated recipient-prefill links still require an official provider contract before any `verified_deep_link` implementation can be added. InstaPay SVG rights still need a permitted-source/rights confirmation before shipping. These limitations do not prevent the local card actions and documented fallback from working.
