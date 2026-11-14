# NexTap Landing Delivery and Supabase Exit

* **Author:** abdelrahman-elseht
* **Date:** 2026-11-11

## Overview

Move NexTap Core from Supabase to a Cloudflare-native application while preserving existing business, QR/NFC, contact, and media URLs. D1 becomes the durable store for internal administration, KV is a non-authoritative slug/version cache for Worker fallback paths, and R2 holds media plus immutable publication artifacts. A public profile should be generated at publish time and delivered through a CDN cache; its normal visit must not query D1 or Supabase. The reported 16-second 3G visit is a serious symptom. A fresh-profile Chrome run at 390×844, Slow 3G, and 4× CPU measured 10.88 s LCP, 2.17 s TTFB, and about 355 KB over 32 requests; the cover image was the LCP element and took about 6.12 s to download. This is one synthetic run, not field data or an explanation of the user's exact 16-second result.

## Analysis

The current `/b/[slug]` route is `force-dynamic`, calls a Supabase-backed publication reader, and has only a short process-local slug cache plus Next.js caching. Those caches are not a globally shared static delivery path. The valid `/c/{token}` card route also calls Supabase on each request, the contact download route is dynamic, and managed media passes through a Next.js route with Supabase Storage access. This architecture can explain cold-request latency and origin dependence, but it does not prove that Supabase alone caused 16 seconds; image bytes, cache headers, geographic distance, and slow-device rendering need separate measurement.

The Supabase exit is broader than a page data-store swap. The current repository uses Supabase Auth, Postgres/RPC, RLS/capability checks, Storage, publication transactions, card inventory/assignment, audit logs, image upload flows, and environment-specific projects. All of these contracts need replacements, migration validation, and rollback. Keeping the current admin temporarily would reduce migration scope, but that would contradict the confirmed full-exit goal; the work should therefore be sequenced so the public delivery path moves first while the legacy admin remains a temporary migration source only.

Use D1 as the canonical record for admins, businesses, pages, drafts, slug ownership/aliases, card assignments, and audit history. Put authorization and business rules in Worker/application code with explicit transactions and tests. D1 supports transactions, but it is SQLite, has a 10 GB per-database limit and single-threaded query processing; it is a reasonable initial admin database for the currently small dataset, with load and contention tests required before scaling. Do not recreate every Postgres RPC as SQL. Do not move transactional records to KV.

Use R2 for immutable versioned snapshots and media. Use KV only as a performance cache for slug-to-publication ID/version mappings if measurements justify the extra cache and consistency burden. KV writes may remain stale in other locations for 60 seconds or longer. It must not be the sole revocation/deactivation authority. Cloudflare Workers Cache API is also not a global CDN cache: it is local to the data center and does not support Tiered Cache, and its use requires Worker execution. Configure and prove a Cloudflare zone/CDN cache path for HTML and media; verify route/cache ordering and cache status on the real hostname before claiming Worker-free cache hits. If a Worker runs on every request, the strict no-per-visit application/origin requirement is not met even if it avoids D1.

Publish immutable artifacts first, then atomically update the canonical D1 publication pointer and refresh or invalidate any cache. Never serve an artifact before all referenced media exists. R2 has globally strong object consistency, but D1/R2/KV have no shared transaction. Make publication recoverable with staged states, idempotent writes, a publication manifest/hash, and a reconciliation job. A CDN can still serve an old cached HTML response after an origin update; use short freshness windows or versioned HTML paths, and provide tested purge/alias/deactivation handling. Rollback moves the pointer to an earlier immutable publication and purges the public route.

Media should use content-hashed immutable paths. Prefer WebP as the safe default and optionally provide AVIF only after testing browser support, MIME handling, fallback behavior, and actual size benefit. Existing AVIF is accepted by upload code but excluded by the current SQL publication-media path filter, a likely publication bug. Add width/height, responsive sizes, and lazy loading below the fold; do not rely on format choice to compensate for oversized source images. A practical first target is a 1200–1600 px cover and 512–800 px logo, with outputs budgeted below roughly 150 KB and 60 KB respectively; measure actual images and preserve originals privately if required. Public content-addressed media can use a one-year immutable CDN/browser cache. Admin originals and drafts stay private.

Aim for compressed initial HTML below 15 KB, but treat it as a budget to verify, not a promise. Render on publish to static HTML with inline critical CSS or one tiny stylesheet, semantic links, no hydration, no third-party scripts, and deferred/lazy non-critical media. Keep first viewport image small and explicitly sized. Serve VCF as a small route-derived attachment or pre-generated immutable file, not a large `data:` URL. The landing profile should expose a simple `has_menu` flag and stable menu path/ID, with no request to Menu storage or API. The Menu application remains separately deployed and may own `/menu/{businessSlug}` once the shared-host route is verified.

## Goals vs. Non-Goals

* **In-Scope Goals:** Complete Supabase exit; preserve public URL contracts and business records; D1-backed internal management; application-layer rules; R2 publication/media; measured CDN delivery; KV as optional cache; fast, low-byte landing pages; menu-directory readiness; staged migration, rollback, and zero downtime.
* **Out-of-Scope Non-Goals:** Menu ordering data/storage/auth; visitor analytics redesign; multi-region D1 sharding; replacing the whole Next.js admin UI before its existing workflows are inventoried; guarantees of a 16-second fix without a measured baseline.

## Alternatives Weighed

* **Keep Supabase and only cache:** Lowest migration risk and potentially sufficient for page speed, but rejected by the user’s confirmed complete-exit requirement.
* **KV as the source of truth:** Rejected because eventual consistency and weak transaction semantics do not fit card assignments, role changes, slug ownership, or reliable revocation.
* **D1 lookup on every public visit:** Rejected because it adds database work and latency to the public path and conflicts with the stated delivery requirement.
* **R2 plus Workers Cache API as the global CDN:** Rejected because Cache API entries are data-center-local and are not Tiered Cache. Use the zone/CDN cache mechanism for global public delivery and verify its interaction with Worker routing.
* **D1 plus R2 with no KV:** Simpler if static delivery fully handles stable URLs. The user prefers KV in the target, so include it for the Worker fallback/miss path while keeping it out of direct static/CDN hits.

## Key Decisions & Staging for Next Steps

1. D1 is the canonical source for mutable business/admin/card state. Include KV as a non-authoritative slug/version cache for Worker miss/fallback paths; direct static/CDN hits do not read it.
2. R2 holds immutable publication versions and content-hashed public media. Never update a published object in place.
3. Public profile rendering happens at publication time. Public visits perform no D1 query; CDN hit behavior must be demonstrated at the existing hostname.
4. Slug changes retain aliases; deactivation and card revocation need an explicit freshness SLA. Do not use KV-only revocation.
5. Replace Supabase Auth with Cloudflare Access for a small internal admin or an application-managed identity/session system only after user, MFA, recovery, and role needs are mapped. Keep admin endpoints separate from public assets.
6. Migrate with dual-read/compare before cutover; keep Supabase read-only until URLs, content, permissions, cards, media, VCF, and rollback are validated.
7. Before implementation, record baseline and acceptance metrics: cold/warm 3G TTFB and LCP, HTML bytes, first viewport image transfer, request count, CDN hit ratio, KV hit/miss and stale-read behavior, publish-to-visible time, deactivation/revocation time, and rollback time.
