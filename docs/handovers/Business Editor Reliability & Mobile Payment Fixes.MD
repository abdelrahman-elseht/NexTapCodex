# NexTap — Business Editor Reliability & Mobile Payment Fixes

You are a Senior Next.js Engineer, Product UX Engineer, and QA Engineer.



Base it on the latest validated branch containing all current Business Editor, provider, payment, publishing, and Sentry changes. Do not use a stale branch.

## Goal

Fix the Business Editor’s shared-state and content-isolation bugs, improve InstaPay behavior across iOS and Android, support repeated provider/action items, make section text fully optional, and add a visual crop/focal-point editor for the circular business profile image.

Preserve all existing NexTap workflows, design, Supabase integration, Draft/Preview/Publish isolation, RLS, card redirects, and monitoring.

---

## Task Checklist

### Phase 1 — Inspect and Reproduce

- [ ] Reproduce the InstaPay behavior on available iOS Safari/WebKit and Android Chrome profiles.
- [ ] Inspect the actual saved InstaPay destination and full redirect chain.
- [ ] Reproduce the Working Hours cross-day mutation.
- [ ] Reproduce Working Hours values leaking into Services/custom URL fields.
- [ ] Identify whether the root cause is shared object references, reused field names, array-index keys, normalization, or persistence logic.
- [ ] Confirm current profile-image upload and rendering behavior.

### Phase 2 — Payment Link Reliability

- [ ] Improve InstaPay opening behavior without breaking the working iPhone flow.
- [ ] Add an intentional fallback for devices where direct app opening is unavailable.
- [ ] Preserve recipient data only when the destination format is officially supported and verified.
- [ ] Prevent redirect loops, missing parameters, and accidental exposure of payment identifiers.

### Phase 3 — Editor Data Isolation and Flexible Items

- [ ] Make each Working Hours day/range independent.
- [ ] Prevent section values from leaking into unrelated sections.
- [ ] Support multiple custom URLs and CTA buttons.
- [ ] Support repeated providers such as two WhatsApp numbers or multiple Facebook/Instagram links.
- [ ] Add inherited provider defaults with per-item overrides.
- [ ] Make section and item headings/subheadings optional and removable.

### Phase 4 — Profile Image Crop Experience

- [ ] Add visual pan, zoom, and crop/focal-point controls for the circular profile image.
- [ ] Synchronize the result with the live mobile preview.
- [ ] Persist the selected crop after reload and publish.
- [ ] Verify the public page displays the same crop as the editor.

### Phase 5 — Verification and Handoff

- [ ] Run typecheck, lint, unit tests, build, and focused E2E tests.
- [ ] Test mobile and desktop layouts.
- [ ] Inspect console and network activity with Chrome DevTools.
- [ ] Capture screenshots and traces.
- [ ] Create the final handoff report.

---

## 1. InstaPay Cross-Device Behavior

The current InstaPay action opens the InstaPay app correctly on iPhone and some Android devices. On other Android devices, it opens an intermediate InstaPay page containing a QR code or redirect link instead of opening the app directly.

### Required Work

1. Inspect the exact saved InstaPay URL, browser navigation, redirects, response codes, and query parameters.
2. Research current official InstaPay documentation and supported link behavior before changing the implementation.
3. Prefer a verified HTTPS App Link / Universal Link when officially supported.
4. Do not wrap a working provider link in unnecessary internal redirects that may prevent Android App Link handling.
5. Keep the click as a direct user-initiated navigation wherever possible.
6. Use Android `intent://`, package names, or custom schemes only if they are officially documented or reliably verified. Never invent them.
7. Preserve recipient information only when the verified link format supports it.

### Required Fallback

Direct app opening cannot be guaranteed on every Android device because it may depend on:

- whether InstaPay is installed;
- Android App Link verification;
- browser choice;
- the user’s “Open supported links” settings;
- the provider’s own redirect behavior.

When direct opening is unavailable, show an intentional fallback experience rather than a confusing or broken flow. It may include:

- “Open InstaPay” using the verified destination;
- a provider-generated QR code when available;
- copy identifier or payment instructions;
- clear user guidance.

Do not claim universal direct-app opening unless it has been verified on physical devices.

Do not expose a recipient number, IPA, wallet identifier, or payment credential in visible public text or accessibility labels unless the business explicitly selected a copy/instructions action.

---

## 2. Independent Working Hours

Fix the bug where editing Tuesday or another day changes Monday’s values.

Each day and time range must have its own stable identity and independent state.

### Requirements

- Use stable item IDs rather than array indexes as React keys or state identifiers.
- Avoid shared object references between newly created days/ranges.
- Use immutable state updates.
- Namespace form fields by section ID and item ID.
- Editing one day must never mutate another day.
- Adding, deleting, or reordering a day must not move values into another item.
- Independence must survive:
  - live preview;
  - Save Draft;
  - page reload;
  - Preview;
  - Publish;
  - reopening the editor.

Do not solve this only visually. Fix the underlying state, normalization, and persistence flow.

---

## 3. Services and Cross-Section Data Leakage

Fix the bug where Working Hours values appear inside the Services custom URL field.

Different section types must have independent typed data. A field named `value`, `title`, or `url` in one section must not accidentally reuse another section’s value.

### Requirements

- Introduce or strengthen typed, section-specific schemas.
- Keep state keyed by stable section and item IDs.
- Do not reuse one generic mutable item object across different section types.
- A newly added Services URL must start empty or from its intended provider default only.
- Working Hours values must never appear in:
  - service URLs;
  - social links;
  - Quick Actions;
  - payment destinations;
  - other unrelated fields.

Preserve existing stored content through safe normalization or backward-compatible migration if required.

---

## 4. Multiple URLs, Buttons, and Repeated Providers

Remove singleton assumptions from Services, Quick Actions, Social, and Payments.

### Required Behavior

- Allow multiple custom URLs.
- Allow multiple CTA buttons.
- Allow more than one item for the same provider:
  - multiple WhatsApp numbers;
  - multiple Facebook pages;
  - multiple Instagram accounts;
  - multiple phone numbers;
  - multiple payment actions;
  - repeated custom links.
- Do not deduplicate items only because their `providerId` is the same.
- Each item must have its own stable ID, destination, optional label, and ordering.
- Continue displaying up to four action buttons per row where the layout allows it.
- Additional items should wrap into following rows responsively.

For the Services section, support multiple service items and multiple optional action buttons/custom URLs where appropriate.

### Defaults and Overrides

Provider details may have a business-level default.

Example:

- The business default WhatsApp number is entered once.
- Adding a WhatsApp action initially inherits that number.
- Adding a second WhatsApp action may inherit the same number.
- The admin can override either item independently.

Use clear inheritance semantics:

- `Use business default`
- `Override for this item`

Changing the business default should update only inherited items. Explicit overrides must remain unchanged.

Keep provider identity separate from:

- display label;
- destination;
- inherited/default value;
- item-level override.

---

## 5. Optional Section and Item Text

Hard-coded labels such as `Services`, small eyebrow text, subtitles, badges, or text similar to `Coffee Ready` must not be permanently forced into the public design.

For all applicable section types, support optional:

- eyebrow / small subheader;
- main title;
- description;
- item title;
- item subtitle / secondary text;
- badge or short supporting label.

### Requirements

- The admin can edit, clear, hide, or restore these fields.
- Empty optional text must not render an empty wrapper or unwanted spacing.
- Template defaults may initially populate fields, but after creation they must be fully editable and removable.
- Public pages and the live simulator must behave identically.
- Removing visual text must not remove the accessible name required for icon-only links.

Do not hard-code one special solution only for Services. Apply the reusable behavior to all compatible section types.

---

## 6. Circular Profile Image Crop and Focal Point

This requirement applies to the business profile/logo image displayed inside the circular frame, not the cover image.

After uploading an image, provide an interactive crop experience where the admin can:

- see the circular visible area;
- drag/pan the image;
- zoom in and out;
- reset the crop;
- preview the exact final appearance.

### Implementation Requirements

- Preserve the original uploaded image.
- Prefer non-destructive crop metadata such as focal point, position, and zoom.
- Store crop metadata separately from the cover-image settings.
- The live mobile simulator must update immediately.
- The crop must remain identical after:
  - Save Draft;
  - reload;
  - Preview;
  - Publish;
  - reopening the editor.
- The public business page must use the same crop calculation as the editor.
- Handle portrait, landscape, square, and transparent images.
- Avoid adding a large dependency if the existing stack can implement this reliably.
- Any new dependency must be justified, maintained, and compatible with the current Next.js version.

---

## Testing Requirements

Use the installed E2E skill, Playwright/WebKit where useful, and Chrome DevTools.

Test against Staging or isolated fixtures only. Do not mutate Production data.

### Required E2E Scenarios

1. Create Monday and Tuesday Working Hours with different times.
2. Modify Tuesday and confirm Monday is unchanged.
3. Save, reload, preview, publish, and verify both schedules.
4. Add Working Hours, then add a Services custom URL and confirm no value leakage.
5. Add multiple custom URLs and multiple service buttons.
6. Add two WhatsApp actions:
   - both initially use the business default;
   - override one;
   - verify the other remains inherited.
7. Add repeated Facebook or Instagram items with different destinations.
8. Remove section eyebrow, title, description, and item subtitle independently.
9. Confirm cleared fields are absent from the public page with no empty spacing.
10. Upload an off-center profile image, pan and zoom it, save it, reload, and publish it.
11. Confirm editor simulator and public circular image match.
12. Verify InstaPay link behavior and redirect chain with:
    - iPhone Safari/WebKit profile;
    - Android Chrome profile;
    - app-unavailable or unsupported fallback.
13. Check mobile RTL, desktop layout, console errors, network failures, and broken assets.

Browser emulation cannot prove that a native payment app opened. When physical-device access is unavailable, clearly separate:

- browser/link verification;
- actual physical-device app handoff verification.

Provide a short manual test matrix for at least:

- iPhone Safari with InstaPay installed;
- Android Chrome with supported-link opening enabled;
- Android with InstaPay absent;
- Android where supported links are disabled.

### Evidence

Capture:

- desktop and mobile editor screenshots;
- live simulator screenshots;
- public-page screenshots;
- profile-image crop before/after screenshots;
- InstaPay redirect/network evidence with sensitive values redacted;
- a passing Playwright trace for the editor workflow.

---

## Acceptance Criteria

The task is complete only when:

1. The existing working iPhone InstaPay behavior is preserved.
2. Supported Android devices use the verified direct-app path where possible.
3. Unsupported Android cases receive a clear functional fallback.
4. No invented InstaPay URL scheme or unsupported recipient-prefill claim is introduced.
5. Editing one Working Hours day never changes another day.
6. Working Hours values never leak into Services or other section types.
7. Multiple custom URLs and multiple CTA buttons can be created, reordered, saved, and published.
8. Multiple instances of the same provider can coexist with independent destinations.
9. Provider defaults and item-level overrides behave predictably.
10. Optional section/item headings and supporting text can be removed across compatible sections.
11. The circular profile-image crop is visually editable and persists correctly.
12. Live preview, saved draft, and published output remain consistent.
13. Draft/Preview/Publish isolation, RLS, cards, redirects, Sentry, and existing admin functionality do not regress.
14. Typecheck, tests, production build, focused E2E tests, and `git diff --check` pass.
15. There are no unexplained console errors, failed requests, broken icons, or missing images.

---

## Guardrails

- Do not rewrite the entire Business Editor.
- Do not perform an unrelated redesign.
- Do not replace stable dependencies without a demonstrated need.
- Do not apply broad dependency upgrades as part of this task.
- Do not change card-token behavior, redirects, authentication, RLS, or deployment infrastructure.
- Do not make destructive Supabase migrations.
- If a schema change is required, make it additive, backward-compatible, and apply it only to Staging after inspecting the existing schema.
- Do not alter or delete existing published business content.
- Do not expose credentials, card tokens, payment identifiers, or private data in logs, traces, screenshots, test output, or Sentry.
- Do not merge into `main` or deploy to Production.
- Fix root causes rather than adding route-specific hacks.
- Stop after the scoped fixes are verified; do not enter an endless optimization or refactoring loop.

---

## Final Deliverable

Create `BUSINESS_EDITOR_RELIABILITY_HANDOFF.md` containing:

1. Root causes found.
2. Files and migrations changed.
3. InstaPay strategy and verified limitations.
4. Working Hours isolation fix.
5. Services/provider item-model changes.
6. Optional heading/subheading behavior.
7. Profile-image crop implementation.
8. Actual commands and test results.
9. Screenshots and trace locations.
10. Physical-device checks completed or still required.
11. Remaining risks or follow-up items.
12. Readiness recommendation.

Do not claim native-app opening is verified unless it was tested on a real device.

Do not merge or deploy. Stop after implementation, verification, and documentation.