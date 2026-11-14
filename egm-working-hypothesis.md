# NexTap Landing Delivery and Supabase Exit

## Objective

Replace Supabase across the current NexTap Core application while keeping the business landing pages lightweight on weak mobile networks. The user measured a business landing page at about 16 seconds on 3G. Public profile visits should not query a database or depend on an application origin on every visit. Existing business URLs, QR/NFC card URLs, and contact downloads must continue working with zero downtime. The separate Menu & Ordering application must remain independent and be ready to connect through its existing same-host path proposal.

## Confirmed Target Direction

- Supabase is to be removed completely, not retained as an admin dependency.
- D1 is a candidate durable relational store for internal administration and business data.
- KV is requested as a cache; it is not assumed to be the authoritative source for transactions or canonical publication state.
- R2 and Cloudflare CDN are candidates for published profile artifacts and public media.
- Business logic should live in the application/Worker layer, not stored procedures.
- The internal admin remains responsible for business content; businesses do not administer profiles directly.
- The menu product remains separately deployed, authenticated, and stored. Its repository targets `https://nextap.services/menu/{businessSlug}` and expects a stable Core business ID and slug as integration identifiers, but has no running app or provisioning API yet.

## Current Code Evidence to Verify

- This repository is Next.js 15.5.28, React 19.1.1, TypeScript, Supabase Auth, PostgreSQL, and Supabase Storage.
- `/b/[slug]` is `force-dynamic`; the publication reader calls `get_publication_pointer` and can read a snapshot through `get_publication_snapshot`. It keeps a five-second process cache and Next cache for snapshots.
- `publish_page` writes immutable JSON snapshots and updates the current publication pointer in PostgreSQL. Admin actions and endpoints depend on Supabase Auth, Postgres RPCs, RLS/capability policies, and Storage.
- `/c/{token}` calls Supabase `resolve_card` on each request. `/b/{slug}/contact.vcf` calls Supabase to retrieve the current contact projection. Managed public media is served through a Next route that reads Supabase Storage.
- AVIF is accepted by the image upload pipeline and a migration permits its MIME type, but `private.snapshot_media_paths` still filters publication media paths to WebP/PNG/JPEG. Public media authorization therefore appears not to register AVIF paths.
- The publication snapshot has no `has_menu`/`hasMenu` field. The editor supports a generic `menuUrl` and the public page shows a menu action from that URL.
- The menu repository proposes `/menu/{businessSlug}`, stable Core business ID plus slug, and an explicit edge/reverse-proxy route. It calls out shared-host asset, auth, and route-prefix risks.

## Live Environment Evidence

- Vercel project `nextap` has a READY production deployment of the same source commit as this checkout (`230adeca680c0fe7e22b3ece0fd9169764b84ffe`), with `nextap.services` assigned to it and runtime region `iad1`.
- The latest `staging` branch deployment found is READY but is behind production source.
- A read-only request to a synthetic nonexistent `/b/{slug}` path returned `server: Vercel`, `x-vercel-cache: MISS`, and `x-vercel-id: fra1::iad1`; it had no Cloudflare edge headers. This does not prove the Cloudflare DNS zone is absent, but this request did not show Cloudflare proxy/cache delivery.
- Cloudflare Workers Paid documentation retrieved 2026-11-11 lists a $5 monthly base, 10 million Worker requests and 30 million CPU milliseconds included. KV is eventually consistent and writes may take 60 seconds or longer to appear globally. The Workers Cache API is local to the data center where the Worker runs and does not support Tiered Cache; using it still requires Worker execution. Zone CDN caching and R2 custom-domain caching are separate mechanisms and need a verified cache rule/route order. D1 has SQLite semantics, a 10 GB per-database maximum, single-threaded query processing, asynchronous read replicas, and a Sessions API for sequential consistency. R2 has globally strong object read-after-write consistency.

## Confirmed User Clarification

The user confirmed the desired outcome is a complete Supabase exit: D1 may hold durable internal records, KV is desired as a non-authoritative cache, application logic belongs in application code rather than stored procedures, and public business visits should not query a database or need an application-origin round trip each time. A fresh-profile Chrome run at 390x844, Slow 3G, and 4x CPU measured 10.88 s LCP, 2.17 s TTFB, and about 355 KB across 32 requests. The 58 KB cover image was the LCP element and took 6.12 s to download. This is one synthetic run; it did not reproduce the user's exact 16-second number and is not field data.

## Review Questions

1. Is full Supabase removal justified by the reported 3G latency, or is the root cause public delivery through a dynamic Vercel route and database lookups?
2. Can the public `/b/{slug}` route be fulfilled by CDN/static cache hits without invoking a Worker, while retaining a publication path for arbitrary and frequently updated tenant profiles?
3. What should KV cache, and which store is authoritative for profiles, slugs, aliases, card assignments, and publication status?
4. How can D1 replace 31 Postgres migrations, application-level auth, RPC transactions, RLS/capability checks, and current admin workflows without putting business logic in SQL?
5. What is the zero-downtime, rollback-safe publication and data migration sequence across D1, KV, R2, existing URLs, media, cards, VCF files, and the separate menu product?
6. Which cache freshness and deactivation guarantees are required, and what measurements prove the 3G performance target?

The design is not approved for implementation. Review the assumptions and alternatives before recommending the target architecture.
