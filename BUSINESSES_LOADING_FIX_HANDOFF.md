# Businesses loading fix handoff

## Root cause

The Production Supabase project is `jezpobjlfvihikplxrta` (read-only inspection on 2026-10-20). Its `business_pages` table does not contain `contact_config` or `draft_revision`, and its `businesses` table does not contain `draft_revision`. The Contacts migration `20261020063654_contacts.sql`, which adds those columns and `save_contact_draft`, is therefore absent from Production. The owner RLS path was not changed; this is schema drift between the deployed editor and the database.

The business detail route selected the two optional Contacts page columns unconditionally. PostgREST returned `42703` and the route rendered the Arabic “لم نتمكن من تحميل صفحات النشاط” error before the editor could open.

## Fix implemented

`loadBusinessEditorPages` retries only when Postgres/PostgREST identifies one of the two optional Contacts columns as missing. It then supplies the same safe defaults used by the pre-Contacts editor (`emptyContact()` and revision `0`). Permission, network, missing-required-column, and other database errors are returned unchanged. The save path still requires `save_contact_draft`; this compatibility read does not bypass authorization or invent a legacy writer.

The private Preview route uses the same loader and reads the business name/category separately, so opening Preview remains compatible with the legacy shape as well.

## Files changed

- `src/app/admin/businesses/[id]/page.tsx` — uses the compatibility page loader.
- `src/app/admin/businesses/[id]/preview/page.tsx` — applies the same compatibility read for owner Preview.
- `src/lib/business/business-editor-pages.ts` — narrow optional-column fallback.
- `tests/unit/business-editor-pages.test.ts` — regression coverage for each missing column, both missing columns, migrated rows, and unrelated failures.
- `BUSINESSES_LOADING_FIX_HANDOFF.md` — this handoff.

No schema, RLS, authentication, or Production data was modified.

## Verification

- `npm.cmd run typecheck` — passed.
- `npm.cmd test` — passed: 32 files, 206 tests.
- `npm.cmd run lint` — passed with 13 pre-existing warnings (unused `labels` and `<img>` advisory warnings; no errors).
- `npm.cmd run test:db` — passed: 25 migrations and all SQL contract suites.
- `npm.cmd run build` — passed; production build completed successfully.
- `npx.cmd e2e run tests/e2e/businesses-loading.e2e.ts` — passed on desktop and mobile (2 tests). This exercised login, the Businesses list, opening an editor, preview navigation, return navigation, filtering, and pagination against the configured Staging project `flkakuysakgwfoemgbwn`.

The full E2E command was also attempted. Its Businesses loading journey passed on both targets; unrelated mutation/media journeys were skipped or failed their existing environment-fixture guards because this run was not the isolated local production/mutation setup. No Production E2E mutations were enabled.

Screenshots were not captured because the focused regression run is an automated browser journey and the repository has no authenticated Production screenshot access. The E2E runner retained its normal artifacts under `.e2e/`.

## Release and remaining limitation

This code fix can let an older database render the Businesses editor, but saving Contacts drafts on Production will continue to fail until the reviewed Contacts migration is applied through the protected Production release process. Apply `supabase/migrations/20261020063654_contacts.sql` (and later Contacts migrations required by the release) only through that process, then run the schema preflight and authenticated Businesses acceptance checks. No migration or deployment was performed by this change.
