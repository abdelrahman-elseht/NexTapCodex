# Business image cropping handoff

Implemented on `staging`, 2026-10-20, extending the existing Contact Photo crop interaction.

## Behavior

- Cropping is available for the main Business Logo, cover (Hero image), Find us (Map image), gallery images, and payments background. The existing Contact Photo editor remains available.
- Logos use a circular mask. Other images support square, landscape 4:3, wide 16:9, and portrait 3:4 crops. All use drag/reposition, zoom, accessible position sliders, Reset, and Apply.
- Apply generates a bounded WebP in the browser and sends it through the existing authenticated, validated media upload endpoint. The field and live simulator update after upload. Public pages continue using the approved publication until Publish.
- The original URL and crop settings persist separately in existing section JSON (`imageEdits`) or gallery item JSON (`imageEdit`). Reopening the editor crops from the original rather than repeatedly cropping a derivative. Restore original returns that field to its source image. Reapplying identical settings does not upload again.
- Cropping retains the original asset. Replacing/removing an image clears its old crop association. Alt text and unrelated fields retain their existing behavior. Save/Publish wait for active uploads.
- No schema migration, table, dependency, auth, RLS, public route, or media endpoint changes were required. No Production changes or customer-record mutations were made.

## Verification

| Check | Actual result |
| --- | --- |
| Typecheck | Passed |
| Lint | Passed: 0 errors, 13 existing/raw-image warnings |
| Unit tests | 31 files, 199 tests passed |
| Database tests | 25 migrations and 8 SQL contract suites passed in isolated test database |
| Fresh production build | Passed |
| UI mechanical detector | No findings |
| `npx.cmd e2e run --config e2e.images.config.ts` | 4/4 passed: Contacts and image-crop workflows at 390×960 and 1440×960 |

Final browser run: `01a15924-07e1-7fc9-b58e-58c36ad63dc4`. Local production build connected only to approved hosted Staging (`flkakuysakgwfoemgbwn`). Synthetic `image-crop-*` fixtures and generated red/blue images were retained for review. Credentials, cookies, traces and fixture JSON are excluded from the commit.

Image tests apply crops in all five locations, inspect real uploaded WebP dimensions and intended blue pixels, verify duplicate Apply creates no extra objects, save/reload crop metadata, check unpublished isolation, publish the cropped logo, compare original bytes, and restore/save/reload the original. Contacts tests verify dragging, downloads, JPEG crop, override, visibility and publication isolation. The first combined run found an old unscoped test selector matching the newly added logo editor; it was scoped to the Contacts panel, and the complete suite passed.

## Screenshots

| State | Mobile | Desktop |
| --- | --- | --- |
| Logo editor | [Mobile](artifacts/image-crop/390-logo-editor.png) | [Desktop](artifacts/image-crop/1440-logo-editor.png) |
| Find us editor | [Mobile](artifacts/image-crop/390-find-us-editor.png) | [Desktop](artifacts/image-crop/1440-find-us-editor.png) |
| Published page | [Mobile](artifacts/image-crop/390-published.png) | [Desktop](artifacts/image-crop/1440-published.png) |

## Files

- Shared editor/UI: `src/app/admin/businesses/_components/contact-photo-editor.tsx`, `image-field.tsx`, `business-editor.tsx`, `item-editor.tsx`; scoped CSS in `src/app/globals.css`.
- Crop geometry/export/validation: `src/lib/media/image-edit.ts`.
- JSON persistence/validation: `src/lib/business/content.ts`, `editor-items.ts`, `src/app/admin/businesses/actions.ts`.
- Verification: `tests/unit/image-edit.test.ts`, `tests/e2e/image-crop.e2e.ts`, scoped selectors in `tests/e2e/contacts-ux.e2e.ts`, `e2e.images.config.ts`.
- This handoff and six synthetic screenshots.

## Limits

- External image hosts must allow browser CORS access to export a crop; otherwise upload the image first. Managed Supabase images were verified.
- Responsive cover/background containers may trim the resulting rectangle further as their layout changes. The saved crop determines the exported image.
- Testing used Chromium with mobile/desktop viewports and synthesized pointer/keyboard input. Physical iPhone/Android, Safari, and native Contacts imports remain unverified.
- Each different applied crop creates a managed derivative; original files remain intact. Conversion happens on Apply, never on public page views or downloads.
