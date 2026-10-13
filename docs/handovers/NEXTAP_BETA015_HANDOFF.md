# NexTap beta01.5 Handoff

## Current state

- Branch: `beta01.5`
- Project: `F:\projects\NexTabCodex-redesign`
- Local preview: `http://127.0.0.1:3144/demo`
- Stack: Next.js App Router, TypeScript, Supabase Auth/Postgres, Arabic RTL by default.
- The isolated Supabase project already has the `quick_actions` migration applied. The checked-in migration is `supabase/migrations/202610090001_quick_actions.sql`; Supabase assigned its own remote version timestamp.
- Do not merge or deploy without explicit approval.
- Never print, commit, or place credentials in screenshots, tests, handoff text, or logs.

## Follow-up requested by the user

Implement and verify these changes in a later session:

1. Replace placeholder/payment glyph assets with accurate PNG logos for InstaPay, Vodafone Cash, and any other payment gateway links. Source them from official or otherwise permitted web assets, record the source/licensing note, optimize them for the site, and keep a local fallback when a remote asset is unavailable.
2. Public payment cards must show only the provider logo and an optional provider/name label. Do not show payment usernames, IPA values, wallet numbers, or bank credentials in the visible card. The saved destination remains available to the action handler.
3. Use a verified provider deep link only when the provider documents/supports it and the saved destination is that link. Clicking the payment card should open the provider/app with the recipient information already encoded so the customer only enters an amount. Never invent a URL scheme or claim prefill when the provider does not support it. For unsupported providers, use a clearly labeled copy-identifier or instructions fallback.
4. LinkedIn should use a black-and-white icon consistent with the other monochrome social icons.
5. Provider names must be optional. An item may be saved with only its logo/icon; do not force a custom label. Use a sensible provider fallback label only where accessibility or the visual layout needs one.
6. Provider details should be reusable across sections. For example, entering an Instagram account in Quick Actions should prefill Instagram in Social, and entering a payment destination once should prefill the matching provider elsewhere. Keep the provider identity separate from the display label and preserve explicit per-item overrides.

## Product constraints

- Preserve Draft, Preview, Publish, Supabase integration, RLS, and the distinction between unpublished and public content.
- Payment data is business-provided external/contact information; NexTap does not process payments.
- Never expose saved payment credentials in public text or accessibility labels unless the user explicitly chooses an instructions/copy action.
- Do not make a fake InstaPay/Vodafone Cash deep-link format. Research current official provider documentation before coding. Store a verified URL as the destination only when its format and recipient-prefill behavior are documented.
- Keep the existing NexTap visual language: warm off-white surfaces, dark type, restrained gold accents, and responsive RTL/LTR behavior.

## Code map

- `src/lib/business/providers.ts`: provider IDs, labels, validation, normalization, and provider metadata.
- `src/app/admin/businesses/_components/item-editor.tsx`: provider-aware item editing and the add-item UI.
- `src/app/admin/businesses/_components/business-editor.tsx`: local draft state, section/item ordering, preview synchronization, and save/publish actions.
- `src/app/admin/businesses/_components/section-content-editor.tsx`: section-specific editing and provider picker integration.
- `src/app/admin/businesses/actions.ts`: server-side draft/publish normalization and persistence.
- `src/components/business/public-snapshot.tsx`: public action/payment rendering and destination handling.
- `src/components/business/social-links.tsx`: social provider tiles and icon rendering.
- `src/app/globals.css`: editor/public responsive grids and payment background styles.
- `public/icons/social/`: current local social/provider SVG assets.
- `public/payment-nfc.webp`: default payment background.
- `supabase/migrations/202610090001_quick_actions.sql`: Quick Actions schema/data migration.

## Recommended implementation shape

Create typed provider metadata rather than scattering provider checks across components. The metadata should define the icon, optional label, input kind, validation, whether a saved value is sensitive, the public display policy, and the supported destination strategy. Keep a business-level provider profile map (or equivalent normalized draft structure) separate from each section item so sections can inherit details while still allowing an override. Persist only the explicit override when the owner changes an inherited value.

For payment actions, model the destination strategy explicitly, for example `verified_deep_link`, `external_url`, `copy_identifier`, or `instructions`. The public renderer should choose the action from that strategy and never infer a deep link from a phone number or IPA. Keep logos and names independent so icon-only cards remain valid and accessible.

## Verification required

Run the existing checks after the changes:

```powershell
npm.cmd run typecheck
npm.cmd test
npx.cmd e2e run tests/e2e/public-journey.e2e.ts tests/e2e/public-security.e2e.ts --reporter list
$env:E2E_ALLOW_MUTATIONS = "true"; npx.cmd e2e run tests/e2e/owner-card-journey.e2e.ts tests/e2e/business-editor-actions.e2e.ts --reporter list; Remove-Item Env:E2E_ALLOW_MUTATIONS
```

Add focused coverage for:

- payment cards hiding identifiers while retaining the correct destination;
- a documented verified deep link opening with recipient data;
- unsupported providers using copy/instructions fallback;
- icon-only items saving and rendering;
- LinkedIn monochrome rendering;
- provider details inherited across Quick Actions, Social, and Payments and overridden locally;
- draft reload, public unpublished isolation, publish, mobile layout, RTL, missing assets, invalid inputs, and console/network errors.

Use the installed e2e skill and Chrome DevTools as needed. Capture desktop/mobile screenshots and a passing trace for the new payment workflow. Run Impeccable’s detector once over the changed UI files. Check `git diff --check` before handoff.

## Existing evidence

- `artifacts-demo.png` and `artifacts-demo-mobile.png` are current local demo captures (root copies are generated and should not be committed).
- Tracked reference captures remain under `artifacts/`.
- Previous validation on this branch: typecheck passed; unit tests 11/11; public/security E2E 24/24; owner and editor workflows passed on desktop/mobile; Impeccable detector returned no findings.
