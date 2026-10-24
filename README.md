# NexTap MVP

NexTap is an Arabic-first owner dashboard for Egyptian businesses using permanent NFC/QR cards and editable microsites. It is a Next.js App Router modular monolith backed by Supabase Auth, PostgreSQL and Storage.

## Repository navigation

Start with the [architecture map](docs/ARCHITECTURE.md) for source ownership and placement rules, and the [documentation index](docs/README.md) for product specifications and implementation handovers. Application code lives in `src/`, automated checks in `tests/` and `supabase/tests/`, operational tools in `scripts/`, and source artwork in `assets/`.

## Local setup

1. Install Node.js 20+ and run `npm ci`.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL`.
3. Apply the checked-in SQL migrations in timestamp order through the authorized Supabase rollout path. Staging uses provider-assigned migration versions; its current schema includes the checked-in capability and media-privacy migrations.
4. Create/invite the single owner with Supabase Auth. An administrator must insert the owner's Auth UUID into `public.owner_users` from the SQL Editor. There is no public sign-up.
5. Configure Auth redirect URLs for `/auth/callback`. Enable MFA in Supabase for the owner.
6. Run `npm run dev`, `npm run typecheck`, `npm test`, `npm run test:e2e`, and `npm run build`. E2E launches isolated desktop and mobile browser checks; Chromium is installed with `npx @e2e-dev/web install chromium`.

Never commit `.env.local`. The application only uses a publishable key and does not contain a service-role key.

## Database and security

- Draft businesses, pages and sections are owner-only under RLS.
- Administrative mutations require both the `owner_users` allowlist and the assigned internal capability role. Apply `20261024020834_internal_admin_capabilities.sql` before deploying source that calls `admin_has_capability`.
- Publishing writes a new immutable JSON snapshot and changes the page's publication pointer in one transaction.
- The business editor persists through `/api/admin/businesses/draft` so revalidation cannot redirect or remount the editor. Authorization redirects are converted to actionable JSON errors and never expose a `NEXT_REDIRECT` sentinel.
- Public pages call `get_published_page(slug)`; slug aliases retain old direct URLs. Permanent card requests use `resolve_card(token)` every time and return a 302/no-store redirect to an internal page only.
- Card assignment locks its row, verifies the target is active and published, and writes history atomically.
- Business media is restricted to JPEG/PNG/WebP under 5 MiB, owner UUID scoped. Public reads are limited to this bucket.
- External URLs are constrained; NexTap does not process payments, fetch Google ratings or allow HTML/JS embeds.

## Versioned migrations

1. `202610080001_initial_schema.sql` — core tables, RLS, Storage and narrow RPCs.
2. `202610080002_publish_and_slugs.sql` — old slug aliases.
3. `202610080003_publish_page.sql` — publication transaction.
4. `202610080004_constraints_indexes.sql` — page uniqueness and FK indexes.
5. `202610080005_immutable_publications.sql` — prevents editing or deleting published snapshots.

The complete ordered history is in [`supabase/migrations/`](supabase/migrations/). The latest security-related entries are `20261024020834_internal_admin_capabilities.sql` (internal roles and capability enforcement) and `20261024021635_publication_media_privacy.sql` (publication media and storage policy alignment). The connected Staging project is `NexTabCodex` (`flkakuysakgwfoemgbwn`, eu-west-1) and has 30 migration records after the remediation rollout. Do not reset it. Review future schema changes through new versioned migrations and verify advisors.

## Deployment

The protected `staging` branch deploys to `staging.nextap.services` with isolated Staging Supabase data. Production remains a separate release target and requires its own Auth, migration-parity, approval, and smoke-test gates. Choose a commercial-use compliant hosting plan before launch; Vercel Hobby is not appropriate for commercial use under its terms.
