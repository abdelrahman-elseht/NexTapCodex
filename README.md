# NexTap MVP

NexTap is an Arabic-first owner dashboard for Egyptian businesses using permanent NFC/QR cards and editable microsites. It is a Next.js App Router modular monolith backed by Supabase Auth, PostgreSQL and Storage.

## Local setup

1. Install Node.js 20+ and run `npm ci`.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL`.
3. Apply the checked-in SQL migrations in timestamp order (already applied to the connected NexTabCodex Supabase project on 2026-10-08).
4. Create/invite the single owner with Supabase Auth. An administrator must insert the owner's Auth UUID into `public.owner_users` from the SQL Editor. There is no public sign-up.
5. Configure Auth redirect URLs for `/auth/callback`. Enable MFA in Supabase for the owner.
6. Run `npm run dev`, `npm run typecheck`, `npm test`, and `npm run build`.

Never commit `.env.local`. The application only uses a publishable key and does not contain a service-role key.

## Database and security

- Draft businesses, pages and sections are owner-only under RLS.
- Publishing writes a new immutable JSON snapshot and changes the page's publication pointer in one transaction.
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

The connected project is `NexTabCodex` (`flkakuysakgwfoemgbwn`, eu-west-1). Do not reset it. Review future schema changes through new versioned migrations and verify advisors.

## Deployment

The source is Vercel compatible but has not been deployed. Choose a commercial-use compliant hosting plan before launch; Vercel Hobby is not appropriate for commercial use under its terms. Configure the three environment variable names above, Auth redirect URLs, domain and image/cache behavior. Verify real card redirects after deployment. No deployment or DNS changes were made.
