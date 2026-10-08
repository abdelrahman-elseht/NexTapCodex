# NexTap MVP handoff

**State:** Core application and schema implementation are present. The database is live in the connected `NexTabCodex` project, but the app has not passed install/typecheck/test/build or an authenticated end-to-end run. It is not launch-ready.

## Architecture and Supabase

Next.js App Router + TypeScript, Arabic RTL rendering, Supabase Auth cookie sessions, owner allowlist, PostgreSQL drafts and immutable publication snapshots, narrow public page/card RPCs, RLS and Supabase Storage. Permanent card redirects resolve current state on every request, are uncached, and only target internal pages. Six non-destructive versioned migrations are checked in and applied on 2026-10-08, covering core schema, publication, indexes, immutable snapshots and owner audit inserts. The project has no owner row, so admin access stays denied until an Auth user is added to `public.owner_users`.

## Acceptance evidence

| ID | Status | Evidence |
|---|---|---|
| AC01 | PARTIAL | Landing, demo and contact CTA source exists; responsive browser checks not run. |
| AC02 | PARTIAL | Server owner guard and RLS policies exist; owner is not provisioned and direct API adversarial tests not run. |
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
| AC18 | BLOCKED | npm install failed because registry requests returned EACCES and npm cache directory was not writable. Typecheck, tests, build and E2E remain unrun. |

Supabase inspection confirmed 11 public tables, all with RLS enabled. The performance advisor reports expected unused-index notices on a newly empty database. The security warning concerns the existing `public.rls_auto_enable()` function and must be reviewed before launch: [Supabase remediation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

## Commands and results

- Project discovery: active `NexTabCodex`, ref `flkakuysakgwfoemgbwn`.
- Initial public schema: empty. After migrations: 11 tables, all RLS enabled.
- Six migrations: applied successfully (one migration was retried after a history timestamp collision).
- ``npm install --no-audit --no-fund`: passed after pinning `@supabase/supabase-js` 2.100.1 to satisfy `@supabase/ssr` and updating Next.js to patched 15.5.27.
- `npm run typecheck`: passed. `npm test`: 3 tests passed. `npm run build`: passed on Next.js 15.5.27.
- Local HTTP checks: `/`, `/demo`, `/login` returned 200; anonymous `/admin` returned 307 to `/login`. Browser visual/E2E and authenticated Owner checks remain unrun because no owner is provisioned.

## Source and setup

Key paths: `app/admin/`, `app/b/[slug]/page.tsx`, `app/c/[token]/route.ts`, `components/public-snapshot.tsx`, `lib/auth/owner.ts`, `supabase/migrations/`, `tests/content.test.ts`.

Required environment names only: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`.

Gaps: individual list-item editor controls, image upload UI, bilingual direction switch, explicit rate limiting, package lock, full security/unit/E2E tests, and final build verification. The landing WhatsApp number is a placeholder. The database schema contains no sample or test business rows.

Local preview: `http://localhost:3000` (dev server running). The public landing and demo are viewable without a login.

## Deployment and costs

No deployment or DNS change was made. Production hosting/storage costs depend on traffic and provider limits. Vercel Hobby is not suitable for a commercial launch under its terms.

Deliverables: `nextap-mvp.zip` was created and the archive entry count was verified; `README.md` contains setup/deployment instructions.

## Exact next 3 steps

1. Provision the owner Auth account, add its UUID to `owner_users`, set environment variables, and install dependencies where npm registry access is allowed.
2. Resolve build/test issues, add the missing item editor and owner-only image-upload UI, then verify anonymous RLS and the connected publish/card reassignment journey.
3. Run responsive/E2E checks, inspect the existing SECURITY DEFINER advisor finding, refresh advisors and choose compliant commercial hosting before deployment.
