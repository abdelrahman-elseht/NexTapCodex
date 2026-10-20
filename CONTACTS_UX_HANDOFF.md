# Contacts UX handoff

Implemented on the existing `staging` branch, 2026-10-20. No merge, push, or Production deployment was performed. The application was verified as a local production build connected to the approved hosted Staging Supabase project (`flkakuysakgwfoemgbwn`, NexTabCodex).

## Phase checklist

- [x] Phase 1 ? Inspect existing Contacts implementation and Staging environment.
- [x] Phase 2 ? Fix duplicate vCard links and Notes.
- [x] Phase 3 ? Implement Business Logo reuse and circular crop editor.
- [x] Phase 4 ? Add download link visibility toggle.
- [x] Phase 5 ? Run tests, verify functionality, and complete handoff.

## Changes implemented

- Safe HTTP(S) provider URLs use labeled vCard URL properties. Identical URL strings are deduplicated across field types; separate accounts and telephone numbers remain independent. URLs pasted into instructions/custom Notes are extracted, leaving their non-link text in NOTE. Empty NOTE is omitted. Explicit safe InstaPay URL bindings are supported; payment identifiers and bank/wallet details remain excluded from automatic bindings.
- Contact Photo inherits the owned managed Business Logo without a second upload. A custom managed override is optional; removal restores the logo. Existing optimized JPEGs are reused. Crop JPEGs use deterministic immutable cache keys and are prepared on owner save/private preview only when absent. Public downloads only read the approved frozen path and never run image conversion or upload. Missing/invalid images produce text-only contacts.
- Admin crop editor provides a circular mask, drag, zoom, accessible horizontal/vertical position sliders, Reset and Apply. Crop coordinates are separate JSON settings; original logo bytes and public logo remain unchanged. Applying updates the local phone simulator. Cached-image readiness is handled on hydration so reload/publish does not leave the editor disabled.
- Show Download Contact Link defaults to enabled for legacy businesses. Disabling removes only the secondary link and its grid gap; the primary button keeps the same vCard endpoint. Draft save, reload and publish preserve both visibility and crop. Public snapshots remain unchanged until Publish.
- Private preview accepts the actual request Host when Next uses an internal localhost URL, while rejecting cross-origin requests.

## Database changes

Two non-destructive, function-only migrations were applied explicitly to Staging:

- `supabase/migrations/20261020102737_contacts_ux.sql`
- `supabase/migrations/20261020110950_contacts_url_bindings.sql`

They replace the existing private contact compiler, validate the new JSON properties, resolve business-owned media and existing JPEGs, and freeze approved visibility/photo paths into publication snapshots. No tables, columns, dependencies, auth behavior, grants to new roles, or RLS policies were added. Existing compiler access restrictions are preserved. No database reset or customer-data deletion occurred. Historical hosted/local migration timestamps already differ; these files must not be used as a reason for a blind database push.

## Actual verification results

| Check | Result |
| --- | --- |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run lint` | Passed: 0 errors, 13 warnings; includes 2 raw-image warnings in crop UI and existing repository warnings |
| `npm.cmd test` | Passed: 30 files, 196 tests |
| `npm.cmd run test:db` | Passed: all 25 migrations and 8 SQL contract suites in isolated test database |
| Hosted Staging `supabase/tests/contacts-ux.sql` | Passed; synthetic transaction rolled back, including crop validation, safe InstaPay binding, visibility and publication isolation |
| `npm.cmd run build` | Fresh production build passed, including type validation |
| `npx.cmd e2e run --config e2e.contacts-ux.config.ts` | Passed: 2/2 targets, 390?960 mobile and 1440?960 desktop; run `01a15908-a1a8-7f6e-81cd-3b7802f3f970` |
| Chrome DevTools | Public synthetic page opened at mobile viewport; no console messages |
| `git diff --check` | Passed |

Browser assertions cover actual downloaded .vcf parsing (6 unique provider URLs and 2 independent phone numbers), non-link Notes, inherited PHOTO, circular square JPEG dimensions, dragging, zoom, Reset/Apply, local secondary-link visibility, save/reload persistence, unchanged public contact before Publish, published photo bytes, unchanged original logo URL/bytes, custom upload override and restoration, repeated-download cache reuse, and functioning primary downloads in both link visibility states plus the visible secondary download. Unit tests additionally inspect intended crop pixel colors, invalid crop rejection, mixed Notes extraction, safe bindings, legacy defaults, and cache hit/miss behavior.

A browser regression assertion exposed a cached image that could complete loading before hydration attached its handler. The image ref now detects already-loaded dimensions; the original full mobile/desktop flow passes with that fix.

Mutation tests use only unique synthetic `contacts-ux-*` businesses/pages and generated red/blue/green images in Staging. Fixtures were retained for review; customer records were not edited. Latest successful fixtures: `contacts-ux-mvglbier-43214f` (desktop) and the mobile slug recorded in ignored `artifacts/contacts-ux/fixture-390.json`. Authentication cookies, runner traces and credentials are excluded from the commit.

## Screenshots

Only synthetic business information appears in the six committed screenshots.

| State | Mobile | Desktop |
| --- | --- | --- |
| Circular crop editor | [390 crop](artifacts/contacts-ux/390-crop-editor.png) | [1440 crop](artifacts/contacts-ux/1440-crop-editor.png) |
| Secondary link hidden | [390 hidden](artifacts/contacts-ux/390-published-hidden.png) | [1440 hidden](artifacts/contacts-ux/1440-published-hidden.png) |
| Secondary link visible | [390 visible](artifacts/contacts-ux/390-published-visible.png) | [1440 visible](artifacts/contacts-ux/1440-published-visible.png) |

## Files modified

- Contact domain: `src/lib/business/contact.ts`, `contact-crop.ts`, `vcard.ts`, `contact-download.ts`.
- Managed media: `src/lib/media/contact-photo.ts`, `resolve-contact-photo.ts`; `scripts/media/media-orphan-audit.mjs`.
- Owner editor: `src/app/admin/businesses/_components/business-editor.tsx`, `contact-card-editor.tsx`, `contact-photo-editor.tsx`; `src/app/admin/businesses/actions.ts`; `src/app/api/admin/businesses/contact-preview/route.ts`.
- Public/UI: `src/components/business/public-snapshot.tsx`; scoped crop/avatar rules in `src/app/globals.css`.
- Database: the two migrations above, `supabase/tests/contacts-ux.sql`, `scripts/database/test-database.mjs`.
- Verification: `tests/unit/contacts.test.ts`, `contact-preview.test.ts`, `contacts-ux.test.ts`; `tests/e2e/contacts-ux.e2e.ts`; `e2e.contacts-ux.config.ts`.
- Delivery: this handoff and the six screenshots above.

## Remaining limitations

- Native iPhone Contacts and Android Contacts imports are **unverified**. Browser download and parsed vCard output were tested; native label rendering/import UI varies by operating system. The circular simulator deliberately approximates native cropping.
- Only managed images owned by the business can become embedded contact photos. External/unmanaged image URLs yield a text-only vCard; no arbitrary server-side image fetching occurs.
- Existing immutable publications remain compatible and keep their approved content until republished. Logo inheritance for a legacy publication becomes available when its draft is saved/published through the updated application.
- The existing public page publication cache can take approximately five seconds to reflect a new publication; the vCard endpoint checks current eligibility directly.
- No hosted application deployment was performed. The Staging database has the two compiler migrations; application delivery is committed source pending the normal Staging deployment process.
