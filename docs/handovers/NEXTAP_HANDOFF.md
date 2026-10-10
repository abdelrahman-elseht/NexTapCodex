# NexTap MVP handoff

**State:** Core application and schema implementation are present. Typecheck, unit tests, production build, and public desktop/mobile E2E checks pass. Authenticated owner journeys are implemented as guarded E2E tests but remain unverified because this runner has no owner credentials and mutation tests are disabled. It is not launch-ready.

## Architecture and Supabase

Next.js App Router + TypeScript, Arabic RTL rendering, Supabase Auth cookie sessions, owner allowlist, PostgreSQL drafts and immutable publication snapshots, narrow public page/card RPCs, RLS and Supabase Storage. Permanent card redirects resolve current state on every request, are uncached, and only target internal pages. Six non-destructive versioned migrations are checked in and applied on 2026-10-08, covering core schema, publication, indexes, immutable snapshots and owner audit inserts. The connected project currently has one linked, confirmed owner account; new environments still need an Auth user added to `public.owner_users` before admin access works.

## Acceptance evidence

| ID | Status | Evidence |
|---|---|---|
| AC01 | PASS | E2E verified landing/demo/contact navigation at 1440px and 390px, with no horizontal overflow. |
| AC02 | PARTIAL | E2E verified anonymous `/admin` redirects to `/login`; authenticated owner access and adversarial direct API checks remain unverified. |
| AC03 | BLOCKED | Create/edit source exists; connected journey requires an owner account. |
| AC04 | PARTIAL | Snapshot RPC and owner preview source exist; not exercised through UI. |
| AC05 | PARTIAL | Section add/remove/hide/reorder/title code exists; no live journey evidence. |
| AC06 | PARTIAL | Structured list items render and validate; no per-item editing UI yet. |
| AC07 | PARTIAL | Hero/contact/hours source exists; no mobile browser test. |
| AC08 | PARTIAL | External URL checks and payment/review link rendering exist; no browser test. |
| AC09 | PARTIAL | Storage bucket constraints/policies exist; upload UI and probes remain. |
| AC10 | PARTIAL | Batch/token/serial/CSV source exists; no 1,000 card connected run. |
| AC11 | PARTIAL | Resolver and safe failure screen exist; RPC not exercised. |
| AC12 | PARTIAL | Atomic assignment RPC records history; no reassignment journey run. |
| AC13 | PARTIAL | Old slug aliases and card stable IDs exist; no test journey. |
| AC14 | PARTIAL | Branch schema and form exist; not exercised. |
| AC15 | PARTIAL | Core tables have RLS; security advisor found pre-existing `public.rls_auto_enable()` executable by anon/authenticated. This was not added by these migrations; provenance remains to be inspected. |
| AC16 | PARTIAL | Snapshot ID/version and no-store card resolver implemented; production CDN behavior unavailable without deployment. |
| AC17 | PARTIAL | Arabic RTL and responsive CSS source exists; no device/English-direction test. |
| AC18 | PARTIAL | `npm run typecheck`, `npm test` (6 tests), `npm run build`, and public E2E checks (20 desktop/mobile checks) pass. An authenticated create/edit/preview/publish/card/scan/rename/reassignment journey is now covered by a guarded test, but was skipped because owner credentials and `E2E_ALLOW_MUTATIONS=true` are unavailable. |

Supabase inspection confirmed 11 public tables, all with RLS enabled. The performance advisor reports expected unused-index notices on a newly empty database. The security warning concerns the existing `public.rls_auto_enable()` function and must be reviewed before launch: [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

## Commands and results

- Project discovery: active `NexTabCodex`, ref `flkakuysakgwfoemgbwn`.
- Initial public schema: empty. After migrations: 11 tables, all RLS enabled.
- Six migrations: applied successfully (one migration was retried after a history timestamp collision).
- ``npm install --no-audit --no-fund`: passed after pinning `@supabase/supabase-js` 2.100.1 to satisfy `@supabase/ssr` and updating Next.js to patched 15.5.27.
- `npm run typecheck`: passed. `npm test`: 6 tests passed. `npm run build`: passed on Next.js 15.5.27.
- `node_modules/.bin/e2e.cmd run --reporter list`: 20 public journey/security checks passed across desktop (1440px) and mobile (390px); six owner mutation tests were skipped by the missing credentials/explicit mutation guard. Report: `.e2e/report.json` (ignored generated artifacts).
- Public E2E checks cover `/`, `/demo`, `/login`, primary contact/demo links, image wordmark rendering, mobile overflow, anonymous admin redirects, invalid card tokens, unknown business slugs, RTL, and keyboard focus. The new owner golden path checks draft privacy, publish, card CSV URLs, activation, scan redirect, slug rename, reassignment, and no-store redirect headers when enabled.
- Fixed card activation UX: the admin picker now offers only published, active pages for active businesses and auto-selects the sole eligible page, matching the database assignment RPC rules.

## Source and setup

Key paths: `src/app/admin/`, `src/app/b/[slug]/page.tsx`, `src/app/c/[token]/route.ts`, `src/components/business/public-snapshot.tsx`, `src/lib/auth/owner.ts`, `supabase/migrations/`, `tests/unit/content.test.ts`.

Required environment names only: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`.

Gaps: individual list-item editor controls, image upload UI, bilingual direction switch, explicit rate limiting, authenticated owner and direct-RLS E2E verification, and review of the existing `rls_auto_enable()` function. The landing WhatsApp number is a placeholder. The database schema contains no sample or test business rows.

Local preview: run `npm run dev` and open `http://localhost:3000`. The E2E config starts an isolated development server on port 3137. The public landing and demo are viewable without a login.

## Deployment and costs

No deployment or DNS change was made. Production hosting/storage costs depend on traffic and provider limits. Vercel Hobby is not suitable for a commercial launch under its terms.

Deliverables: `nextap-mvp.zip` was created and the archive entry count was verified; `README.md` contains setup/deployment instructions.

## Exact next 3 steps

1. For a new environment, provision the owner Auth account, add its UUID to `owner_users`, set environment variables, and install dependencies where npm registry access is allowed.
2. Resolve build/test issues, add the missing item editor and owner-only image-upload UI, then verify anonymous RLS and the connected publish/card reassignment journey.
3. Run responsive/E2E checks, inspect the existing SECURITY DEFINER advisor finding, refresh advisors and choose compliant commercial hosting before deployment.

## External printer card manufacturing workflow (beta04)

Implemented inside `/admin/cards`: owner-only batch creation uses a transaction-backed RPC and a request UUID, creates unassigned cards with server-generated 192-bit tokens and immutable serials, and links to batch details. The batch detail page previews one QR and its full permanent QR URL. The on-demand ZIP route reads the stored cards each time, orders by serial, creates one M-correction SVG per card, and includes the required manifest, NFC CSV, and printer instructions. No QR assets are persisted. The resolver treats `via` as non-authoritative and now sends both QR and NFC visits to the same internal business path with `302` and `Cache-Control: no-store`.

The checked-in migration is `supabase/migrations/202610080008_external_printer_batches.sql`. It was not applied to the connected database during this continuation. Existing database state and owner RLS have not been probed here; run the migration through the established Supabase workflow before using batch creation. The working tree has existing unfinished changes that were continued in place.

| ID | Status | Evidence / limitation |
|---|---|---|
| MC01 | PARTIAL | RPC validates quantity, creates batch and all cards in one transaction, uses 24 random bytes per token and database-allocated serials. Not run against the connected database; migration is pending. |
| MC02 | PARTIAL | Owner-scoped unique idempotency key plus transaction advisory lock returns the existing batch on retry. Not concurrency-tested against PostgreSQL. |
| MC03 | PASS | ZIP code includes exactly three required root files and one SVG per persisted card; archive test confirms 100-card size and QR entry count. |
| MC04 | PASS | `npm test` rasterizes and decodes every one of 100 generated SVGs, checks exact QR URL against manifest, and checks ordered NFC CSV serial/URL pairs. |
| MC05 | PARTIAL | Shared token and distinct `via` URLs are covered by source and export tests; resolver ignores all query strings and only targets internal published pages. Live RPC/database behavior not exercised. |
| MC06 | PARTIAL | Exports derive identifiers from persisted rows and no generation occurs during download. Reassignment/re-download requires a connected owner database test. |
| MC07 | PARTIAL | UI routes call `requireOwner`; existing batch/card RLS is owner-only and the new RPC revokes anon/public access. Direct anonymous/authenticated probes were unavailable. |
| MC08 | PARTIAL | UI/server/RPC enforce 1–1,000 and name/token constraints; ZIP rejects invalid sizes and export rejects incomplete batches. Failure/rollback paths were not run against PostgreSQL. |
| MC09 | PARTIAL | Resolver reads current state through `resolve_card` on every uncached visit and returns 302/no-store. Live activation/reassignment/disable scan checks require the connected owner environment. |
| MC10 | PARTIAL | Responsive admin sections, batch detail, preview, ZIP/CSV links, and print/NFC QC guidance are implemented. UI E2E was skipped because owner credentials and `E2E_ALLOW_MUTATIONS=true` for an isolated database are absent. |
| MC11 | PARTIAL | `npm run typecheck`, `npm test` (8 tests), and `npm run build` pass. Selective E2E launches on desktop but reports one skipped test due the owner/mutation guard; create-preview-download ZIP UI flow is not yet verified. |

Manufacturing validation commands and results:

- `npm.cmd run typecheck` — passed.
- `npm.cmd test` — passed, 8 tests; includes decoding all 100 QR SVG payloads and comparing manifest/NFC/serial alignment.
- `npm.cmd run build` — passed; manufacturing detail, CSV, and ZIP routes are included in the build.
- `npx.cmd e2e run tests/e2e/card-manufacturing.e2e.ts --config e2e.manufacturing.config.ts --target desktop --reporter list` — one test skipped by its credential/mutation safety guard. A temporary config used port 3138 because the repo's normal E2E port 3137 was already occupied by a NexTap dev server. The temporary config was removed after the run.
- The first E2E invocation exited before tests with `APP_ALREADY_RUNNING` on port 3137; no process was stopped or changed.

Before production use: apply the checked-in migration, run the E2E test with a dedicated isolated Supabase owner and `E2E_ALLOW_MUTATIONS=true`, probe anonymous/direct RLS access, and rerun MC01–MC11. Ask the printing vendor for variable-data/template requirements, final QR physical size, bleed and safe area before creating any card-layout PDF. Confirm separately whether NFC encoding is contracted; QR correctness does not validate NFC programming.
