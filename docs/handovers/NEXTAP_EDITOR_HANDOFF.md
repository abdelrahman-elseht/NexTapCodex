# NexTap Business Page and Live Editor Handoff

Branch: `beta01.4`

## Delivered

- Reworked `/b/:slug` and the owner preview around one typed snapshot renderer. The page uses a burgundy frame, warm cream cards, conditional quick actions, social/provider tiles, payment directory, review CTA, directions, Cairo opening hours, and a quiet Powered by NexTap footer.
- Removed the public top NexTap wordmark and language selector. Numeric ratings render only when owner-provided verification metadata is present. Payment copy states that NexTap does not process or verify payments.
- Added four presets: Premium Coffee Shop, Restaurant, Salon / Beauty, and Universal / Professional. Legacy `retail` remains valid. Coffee setup now seeds sections in reference order: hero, social, payments, reviews, find us, hours.
- Added local live editor state with phone preview, section visibility, native drag handles, Move Up / Move Down controls, item reordering, provider picker, repeat-provider focus, Egyptian phone/WhatsApp/Instagram/InstaPay normalization, safe URL validation, and separate Save Draft / Publish actions.
- Added provider-specific inline validation for Egyptian phone numbers, Instagram, InstaPay IPA, and external URLs. Empty or disabled entries stay out of the public page.
- Added the cleaned card/phone NFC artwork at `public/payment-nfc.png`; payment backgrounds remain configurable by section.
- Kept `/c/:token` redirects, card assignment, authentication, publishing, branch pages, and manufacturing routes intact.

## Database migrations

Applied to Supabase project `flkakuysakgwfoemgbwn` through the Supabase MCP:

- `202610080008_template_presets.sql` -> remote version `20261008231539`.
- `202610080009_atomic_draft_save.sql` -> remote version `20261008231601`.

Verification confirmed the expanded template check and the owner-gated `save_page_draft` functions. Anonymous execution is revoked; authenticated execution is granted. Existing Supabase advisor warnings concern pre-existing `rls_auto_enable` / `create_card_batch` functions and leaked-password protection.

## Validation

- `npm.cmd run typecheck` passed after UTF-8/RTL copy cleanup.
- `npm.cmd test -- --run` passed: 11 tests across 2 files.
- `npm.cmd run build` passed with `NODE_OPTIONS=--max-old-space-size=4096`; all routes compiled.
- Public journey E2E passed after the final cleanup: desktop and mobile, 10/10 tests.
- Public security E2E passed after the final cleanup: desktop and mobile, 14/14 checks.
- Impeccable review used two independent agents. Detector returned no findings; design review fixes included encoding cleanup, less dense controls, clearer action hierarchy, and removal of unverified review stars.
- Browser evidence is in `artifacts/final-public-mobile-corrected.png`, `artifacts/final-public-desktop-corrected.png`, and `artifacts/final-payment-section-corrected.png`. Existing editor captures remain in `artifacts/editor-desktop.png`, `artifacts/editor-mobile.png`, and `artifacts/final-admin-new-desktop.png`.
- The earlier captures (`artifacts/final-public-mobile.png`, `artifacts/final-public-desktop.png`, and `artifacts/final-payment-section.png`) are retained as the before set for comparison.

## Known limitations

- The public demo is illustrative. Real published pages still require owner-configured media, contact details, hours, provider entries, and official Google review links.
- Media upload/cropping UI is not implemented; the editor accepts validated image URLs. A publish diff and rollback view are also follow-up work.
- The destructive owner mutation E2E remains opt-in (`E2E_ALLOW_MUTATIONS=true`) and was not run against production data. The remote migrations and RLS/function privileges were verified separately.
