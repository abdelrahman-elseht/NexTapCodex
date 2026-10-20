# Business Creation & Contact Photo Fix Handoff

## Root causes and evidence

The deployed application was ahead of the Production Supabase schema. Production had the base editor tables and Storage bucket, but it did not have the later admin/contact migrations:

- `create_admin_page` was absent. The business creation route calls this idempotent RPC, so PostgREST returned `PGRST202` and the UI showed an uncertain operation result.
- `business_pages.contact_config`, `business_pages.draft_revision`, `media_assets.contact_photo_path`, and `save_contact_draft` were absent. Editor and contact-photo requests selecting those columns returned HTTP 400, which surfaced as contact-photo verification and save failures.
- The `business-media` bucket and owner-only Storage policies were present, so Storage security was not bypassed or weakened.

Production logs showed the missing-column 400 responses. Staging already contained the complete schema and served the same requests successfully.

The remaining client-side photo failure was separate from Supabase Storage. `ImageField` only handled the file input's `change` event. The supported browser test upload action populated the file input through the `input` event, so no `/api/admin/media` request was made, no managed asset was created, and the URL stayed empty. The trace showed the selected file in the input with no upload request or server error.

## Fixes implemented

- Applied the existing reviewed migrations to Production `jezpobjlfvihikplxrta` in dependency order:
  `admin_inventory_operations`, `contacts`, `contacts_ux`, and `contacts_url_bindings`.
- Added `create_admin_page` to the read-only business-editor schema preflight. A deployment now fails before serving the editor when the idempotent creation RPC or contact schema is missing.
- Added regression coverage for a missing creation RPC and for the complete migrated contract.
- Updated the shared image field to process both file-input events and ignore the duplicate event for one selection. This starts the existing secure upload flow without changing Storage or RLS behavior, keeps the upload pending state accurate, and still leaves the Business Logo untouched when a Contact Photo is selected.

The creation flow continues to use one request key through the UI and the database receipt table. Retrying an uncertain response replays the same result instead of inserting another business.

## Verification

- Production now exposes `create_admin_page`, `save_contact_draft`, and `private.compile_contact`.
- Production now contains the contact columns and the existing owner-only media policies.
- Targeted unit tests: 5 files, 35 tests passed (`business-editor-schema`, `admin-operations-route`, `media-upload-route`, `contact-preview`, and `contacts`).
- Typecheck: `npm.cmd run typecheck` passed.
- Lint: `npm.cmd run lint` passed with 13 existing warnings and 0 errors.
- Production build: `npm.cmd run build` passed.
- Staging-only browser regression: `npx.cmd e2e run --config e2e.contacts-ux.config.ts` passed for both 390px and 1440px targets. The flow verified crop persistence, Save Draft, Publish, reload, cached contact photo reuse, custom Contact Photo upload, publication, removal, and Business Logo preservation.

## Remaining issues

No Storage-policy workaround is required. Production deployment must use the migration state above before serving a build that reads contact fields. The browser test uses isolated synthetic Staging fixtures; it does not read or upload customer images in Production.

## Deployment and migration requirements

Future deployments must run the checked-in migrations in order against the target environment and run the business-editor schema preflight with an authenticated owner. Do not point local development or staging at Production data.
