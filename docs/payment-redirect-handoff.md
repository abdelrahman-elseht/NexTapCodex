# Payment Icon and App Redirect Handoff

## Continuation status (2026-10-10)

The requested implementation is present in the working tree. Continue from
[`payment-redirect-implementation.md`](./payment-redirect-implementation.md), which
records the completed behavior, the subsequent owner-supplied HTTPS link decision,
validation, and remaining provider/asset limitations. The requested follow-up below
is retained as the original brief, not an outstanding implementation checklist.

Do not generate provider links or claim verified native app redirects from the
example token. InstaPay asset redistribution rights remain unverified before
shipping. No merge or deployment has been authorized.

## Context

- Branch: `beta01.6`
- Project: `F:\projects\NexTabCodex-redesign`
- Stack: Next.js App Router, TypeScript, Supabase, Arabic RTL by default.
- The `quick_actions` migration is already applied. Preserve Draft, Preview, Publish, RLS, Supabase integration, mobile responsiveness, and RTL/LTR behavior.
- Do not merge or deploy without explicit approval. Never include credentials or real recipient values in source, tests, screenshots, or this handoff.

## Requested follow-up

Implement the following payment UI changes in a subsequent implementation pass:

1. Use the supplied monochrome SVG assets for the payment providers:
   - `F:\projects\NexTabCodex-redesign\instapay.svg` for InstaPay.
   - `F:\projects\NexTabCodex-redesign\vodafone-svgrepo-com.svg` for Vodafone Cash.
2. Remove the visible `Copy identifier` button from public payment cards.
3. Make the payment logo/card the action. On a supported mobile device, clicking it should open the provider's actual payment app with the recipient information prefilled, using a provider-verified URL/URI such as the user's example:
   - `https://ipn.eg/S/x/1wFjHN`

The example URL is a format to investigate, not an approved template. Do not substitute a recipient identifier into it or generate similar links until the provider contract has been verified.

## Required provider verification gate

Before changing destination behavior, check current first-party provider documentation and record the source URL, access date, supported platform, exact URL/URI grammar, and the recipient fields it permits.

The current research in [`docs/provider-destination-research.md`](./provider-destination-research.md) found no officially documented recipient-prefill deep link for either InstaPay or Vodafone Cash as of 2026-10-09. It found only InstaPay IPA/mobile identifiers and Vodafone Cash's `*9*7#` transfer flow. Therefore:

- Treat `https://ipn.eg/S/x/1wFjHN` as unverified until `ipn.eg` is confirmed as an official InstaPay destination and the path/token semantics are documented by InstaPay or a directly linked official source.
- Do not invent an `instapay://`, `vodafonecash://`, Android intent, iOS universal link, query parameter, or token encoding.
- Do not expose a saved IPA, wallet number, phone number, bank account, or token in visible text, image alt text, ARIA labels, analytics payloads, or an href unless the provider's verified contract requires that exact recipient value in the destination.
- If no verified recipient-prefill destination exists, keep the payment item functional with a safe provider instructions or other approved fallback. The public card must remain identifier-free. NexTap must not process, submit, or confirm a payment.

## Asset and licensing work

Copy or reference the supplied SVGs from a local public asset location, preferably:

- `public/icons/payment/instapay.svg`
- `public/icons/payment/vodafone.svg`

Keep a local fallback for missing or failed assets. Preserve the existing `PaymentLogo` abstraction and do not fetch logos from a third-party CDN at runtime.

Record the following in [`public/icons/social/SOURCES.md`](../public/icons/social/SOURCES.md) or a payment-specific sources file before shipping:

- Original file path and final local filename.
- Original author/source page and direct download URL, if known.
- License or permission terms, including attribution requirements.
- Retrieval date and any optimization or monochrome transformation.

The Vodafone filename mentions SVG Repo, but the specific SVG Repo asset license still needs confirmation. Do not assume a permissive license from the filename alone. The InstaPay SVG has no license metadata; obtain a permitted source or document the permission/source decision.

## UI and data contract

- Public payment cards show only the provider logo and an optional display label. Labels remain optional, including icon-only cards.
- Keep provider identity separate from the display label. Provider metadata must determine the icon and destination strategy; a custom label must never become a provider identifier.
- Remove the public `Copy identifier` control and any wording that suggests the identifier is visible. Do not remove secure owner/editor capabilities unless they are only the public copy action.
- Make the logo/card an accessible link or button with a generic accessible name such as `Pay with InstaPay` or the explicit optional label. Never put the recipient identifier in that name or in image alt text.
- Use the typed destination strategies already defined by the provider model: `verified_deep_link`, `external_url`, `copy_identifier`, and `instructions`.
- Select `verified_deep_link` only after the provider verification gate passes. Store the exact verified destination or a typed builder that follows the documented contract; never derive a link from a phone number or IPA by string concatenation.
- If a provider has no verified deep link, use the existing safe fallback strategy and make it clear that the payer must finish the action in the official app or documented flow. Do not present an informational provider page as a prefilled payment action.
- Preserve shared provider details and explicit item-level overrides across Quick Actions, Social Links, and Payments.

## Likely implementation points

- [`components/payment-logo.tsx`](../components/payment-logo.tsx): map provider IDs to the supplied local SVGs, with the existing local fallback behavior.
- [`components/public-snapshot.tsx`](../components/public-snapshot.tsx): render the provider logo/card action without public identifiers; select the destination from typed provider metadata.
- [`components/copy-payment.tsx`](../components/copy-payment.tsx): remove only the public copy-identifier presentation if it is no longer used; retain any secure instructions behavior that remains required by the selected fallback.
- [`lib/providers.ts`](../lib/providers.ts): add the verified provider destination metadata only after documentation confirms the contract.
- [`tests/providers.test.ts`](../tests/providers.test.ts) and the public/security E2E tests: cover privacy, strategy selection, and redirect behavior.

## Acceptance criteria

- InstaPay and Vodafone Cash render the supplied monochrome local SVGs, with a working local fallback when an asset fails.
- Public payment cards have no visible or accessible payment identifier and no visible `Copy identifier` button.
- Icon-only payment cards save, render, and remain keyboard accessible.
- A verified deep link includes recipient information only when the provider officially supports that behavior and the generated URL matches the published contract exactly.
- An unsupported provider has a functional safe fallback and never receives an invented URL scheme.
- On a mobile device, a verified payment action opens the provider app or its documented web handoff. A non-mobile or unavailable-app fallback is defined without exposing the identifier.
- Provider details still synchronize across sections while explicit item-level overrides win.
- Draft reload, Live Preview, Publish, RLS/security, RTL, LTR, and mobile layouts continue to work.
- LinkedIn remains monochrome and existing social behavior is unchanged.

## Verification checklist

After implementation, run:

```powershell
npm.cmd run typecheck
npm.cmd test
npx.cmd e2e run tests/public-journey.e2e.ts tests/public-security.e2e.ts --reporter list
$env:E2E_ALLOW_MUTATIONS = "true"; npx.cmd e2e run tests/owner-card-journey.e2e.ts tests/business-editor-actions.e2e.ts --reporter list; Remove-Item Env:E2E_ALLOW_MUTATIONS
```

Also run Impeccable's detector once on each changed UI file and `git diff --check`. Use the installed E2E skill and Chrome DevTools to capture:

- Desktop and mobile screenshots of the payment cards.
- A mobile payment-action trace showing the verified destination or the documented fallback.
- Evidence that identifiers are absent from rendered text, accessibility snapshots, and hrefs unless the verified provider contract explicitly requires them.

Record the actual test results, screenshots, provider sources/licensing, and any remaining provider limitations in the final implementation handoff. Do not claim app redirect support for a provider whose official deep-link contract remains undocumented.
