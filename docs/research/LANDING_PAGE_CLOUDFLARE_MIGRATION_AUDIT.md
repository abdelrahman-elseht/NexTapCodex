# NexTap Landing Page and Supabase Exit Audit

**Audit date:** 2026-11-11
**Repository:** `NextapCloudflareMigration`, production source commit `230adeca680c0fe7e22b3ece0fd9169764b84ffe` (deployment evidence recorded in the working hypothesis)
**Scope:** Read-only architecture audit. No application code, production data, DNS, Worker, Cloudflare, or deployment configuration was changed.

## Executive Assessment

The desired direction is sound only with one condition: the public `/b/{slug}` response must be served as a static object or a true CDN cache hit before any per-request application handler. A Worker lookup of KV/R2 instead of Supabase removes SQL from the path, but it still executes application code on every visit. The current code proves a dynamic, database-backed path; it does not prove that Supabase alone caused the 16-second 3G result. Measure the current page and first establish TTFB, HTML bytes, LCP, image transfer sizes, request waterfall, cold/warm cache, and device CPU.

Recommended target:

```text
Internal admin (Cloudflare Access or replacement identity)
  -> Admin Worker/API (application rules and authorization)
  -> D1 (canonical mutable records) + R2 (immutable publications/media)
  -> publish complete version, then atomically switch D1 pointer
  -> KV caches slug/version for Worker miss/fallback paths; not authority
  -> build/refresh a public static delivery object at the stable URL

Visitor -> Cloudflare CDN/static object -> HTML + media
          no D1, Supabase, or public application rendering on a warm hit
```

Use D1 for durable internal records, R2 for immutable artifacts/media, and KV as a non-authoritative slug/version cache for Worker miss/fallback paths. A direct static/CDN hit should bypass KV entirely. Do not promise a CDN hit bypasses Worker execution until the exact `/b/*` route and cache ordering are verified on the Cloudflare zone. The Workers Cache API is not a substitute for the global CDN cache: it is local to the data center where the Worker runs, does not support Tiered Cache, and requires Worker execution.

The 100–10,000 business range is modest in record count. The hard work is replacing Supabase Auth, RLS, RPC transactions, media privacy, and card/public URL behavior while preserving rollback and zero downtime. The D1 capacity concern is not current row count; it is SQLite single-threaded write contention and keeping the database under its documented per-database limit. A Supabase exit is therefore feasible, but it is a full application/security migration, not a landing-page deployment change.

## Evidence and Confidence

| Finding | Evidence | Confidence |
| --- | --- | --- |
| The app is Next.js 15.5.28 / React 19.1.1 with `@supabase/ssr` and `@supabase/supabase-js`. | `package.json` | Verified in checkout |
| Public `/b/[slug]` is dynamic and resolves a publication through Supabase RPCs. | `src/app/b/[slug]/page.tsx`; `src/lib/business/public-publication.ts` | Verified in checkout |
| Local publication caches are process/Next caches, not a globally shared CDN artifact. | `src/lib/business/public-publication.ts`; [`ARCHITECTURE_CAPACITY_HANDOFF.md`](../finished/handovers/ARCHITECTURE_CAPACITY_HANDOFF.md) | Verified in checkout; active production cache headers need live testing |
| Valid `/c/{token}` performs `resolve_card`; VCF routes are dynamic; managed media is routed through Next and Supabase Storage. | `src/app/c/[token]/route.ts`; `src/app/b/[slug]/contact.vcf/route.ts`; `src/app/api/media/[...path]/route.ts` | Verified in checkout |
| AVIF is accepted by upload validation but publication media path extraction excludes `.avif`. | `supabase/migrations/20261028070727_allow_avif_business_media.sql`; `supabase/migrations/20261024021635_publication_media_privacy.sql` | Verified; production impact depends on deployed migration/RLS path |
| Menu is an editor URL today, not a structured publication contract. | `src/app/admin/businesses/_components/business-editor.tsx`; `src/components/business/public-snapshot.tsx` | Verified in checkout |
| The repo has 31 Supabase migrations and broad source use of Supabase. | `supabase/migrations/`; source search | Verified in checkout; migration count and call-site counts are inventory measures, not effort estimates |
| Production deployment is currently Vercel and request observation showed no Cloudflare cache headers. | Recorded read-only deployment/request checks in `egm-working-hypothesis.md` | Verified for that deployment/request only; not proof DNS cannot be proxied |
| 16-second 3G failure is caused only by Supabase. | User report plus one synthetic Chrome run below | Not established; the run identifies both slow first response and a slow hero image |

The older capacity handoff at [`ARCHITECTURE_CAPACITY_HANDOFF.md`](../finished/handovers/ARCHITECTURE_CAPACITY_HANDOFF.md) reports a much smaller preproduction dataset (241 businesses/pages, 206 publications, 497 cards, 104 media objects) and identifies the dynamic routes. Those counts are historical and must be re-read from the authoritative production export before sizing the migration.

## Current Architecture Map

```text
Browser
  /b/{slug} -> Next.js force-dynamic page -> 5-second process cache
            -> Supabase publication pointer RPC -> immutable snapshot RPC
            -> HTML response (not an explicit static CDN response)

  /c/{token} -> Next.js route -> Supabase resolve_card RPC -> 302 /b/{slug}
  /b/{slug}/contact.vcf -> dynamic contact projection -> VCF
  /api/media/{path} -> Next.js Node route -> Supabase Storage + auth/RLS

Admin -> Next.js auth/middleware -> Supabase Auth
      -> Postgres/RPC + RLS (draft, publish, card, audit)
      -> Supabase Storage (private managed media)
```

The publication model already has a useful property: immutable snapshots. `publish_page` writes a snapshot and updates the current pointer transactionally in Postgres. That transactional boundary is lost when state is split across D1, R2, and KV, so the replacement needs explicit staged publication and reconciliation.

## Target Architecture and Public Request Flow

```text
                         publish
Admin UI -> Access/session -> Admin Worker -> D1 transaction
                                        |       draft/status/slug/card/audit
                                        +-----> R2 immutable snapshot + media
                                        +-----> static HTML delivery object
                                               publish pointer after artifacts exist

Visitor -> /b/{slug} -> CDN/static response -> browser
                         ^
                         | cache miss behavior is a blocking design decision:
                         +-- static object mapping, or Worker + R2/KV fallback
```

There are two viable delivery modes:

1. **Static object at the stable route:** best fit for “no handler on each visit.” Cloudflare Workers Static Assets uses static-first routing and serves a matching asset without Worker code unless `run_worker_first` is configured; R2 custom domains can serve/cache public objects. Publish `/b/{slug}` HTML (or equivalent object mapping) into a surface that answers it directly. Tenant updates are runtime publication writes, not ordinary git build output. Cloudflare’s supported path mapping, update API, collision behavior with `/menu/*`, slug aliases, and custom-domain ownership must be proven in a small routing spike.
2. **Worker router with CDN response caching:** simplest way to map arbitrary slugs to immutable R2 versions while keeping URLs. It can avoid D1 and Supabase, but Worker invocation remains on every request unless Cloudflare cache ordering demonstrably bypasses the Worker. Worker Cache API alone does not satisfy the no-handler requirement. Treat this mode as a fallback if zero-Worker hits are not technically achievable for the required URL contract.

Do not use “CDN cache” as a generic promise. Verify with a deployed test route: first and repeat requests; `CF-Cache-Status`; Worker invocation counts/logs; cache purge; exact custom hostname; and `/menu/*` coexistence. If the test proves Worker still executes, set an explicit requirement decision before implementation: is “no database/origin” sufficient, or must a warm visit also avoid Worker code?

## Data Ownership and Publication Protocol

| Data | Authority | Public delivery | Notes |
| --- | --- | --- | --- |
| Users/admin roles/sessions | Identity provider or application-managed identity; D1 stores local role mapping | Never public | Cloudflare Access is a candidate for a small internal team, but does not itself replace every application permission model. |
| Business/page drafts and statuses | D1 | Not served directly | Normalize ownership/status/slug/card relationships; retain bounded JSON for flexible section content. |
| Current slug, aliases, publication pointer | D1 | Materialized into static route/artifact; KV may cache reads | D1 is authority; KV's stale window must not control revocation. |
| Published page snapshot | R2 immutable version; D1 points to current version | Static HTML or R2-backed delivery | Use version IDs and hashes; no mutable overwrite. |
| Media | R2 content-hashed objects | `media.nextap.services` + CDN | Separate private source files from public derivatives if originals are sensitive. |
| Card token assignment/status | D1 | Must resolve at `/c/{token}` or be materialized to a revocable mapping | Dynamic card redirects need a freshness SLA. Do not cache indefinitely. |
| Audit/history | D1 | Admin-only | Keep retention policy and export/backup plan. |
| Menu availability | Landing publication field `has_menu` plus stable route/ID | Link only | No Menu DB/Worker request just to render the profile. Confirm exact path with Menu repo owner before publish contract freezes. |

Recommended publish sequence:

1. Validate and normalize draft in the admin Worker. Use an idempotency key.
2. Upload and verify all media derivatives in R2 under content hashes.
3. Write the immutable snapshot and rendered HTML under a new publication ID; include a manifest with hashes and schema version.
4. Read back/HEAD the objects and validate the manifest.
5. In a D1 transaction, create publication metadata, set the current pointer, record audit entry, and mark it published. If the public route uses a materialized static object, make its version activation part of a recoverable publish state machine, since R2/D1 cannot share a transaction.
6. Purge/refresh the stable page URL and aliases, or let a deliberately short TTL expire. Verify by fetching from multiple regions and checking the version marker.
7. On failure, leave the prior pointer/live object intact; run reconciliation for orphaned staged versions. Rollback points the pointer/route at the previous immutable version and purges the stable URL.

Avoid storing both complete `index.html` and `snapshot.json` if no consumer needs both. Prefer one canonical snapshot JSON plus generated HTML only if HTML is directly served. If HTML is the only runtime artifact, keep a compact publication manifest for admin/debug/rollback rather than a duplicate full JSON. The URL-to-publication index may be `slugs/{slug}.json` in R2 or KV, but only if the delivery route requires lookup. KV should be a cache, not the authoritative pointer.

## Cloudflare Feature Assessment

| Product | Fit | Limits and decision |
| --- | --- | --- |
| Workers | Admin API, card resolution, publish orchestration, fallback public router | $5/month Paid baseline includes 10M requests and 30M CPU-ms; excess is priced by request and CPU. Any route attached to a Worker must be tested for execution on hits. |
| D1 | Durable internal application database | SQL/transactions; 10 GB max per DB, single-threaded query execution, paid plan includes 5M rows read/day and 100k rows written/day; first 25B reads/month and 5GB storage included in current pricing docs. Test write contention and migration semantics. |
| KV | Read-heavy cache for slug/version mapping or shared config | Eventual consistency; cross-location changes may take 60 seconds or longer. Current paid pricing includes 10M reads/month, then $0.50/million; writes/deletes/list/storage have separate allowances/rates. Never sole authority for status/revocation. |
| R2 | Immutable publications and public media | Strong global object read-after-write/delete consistency. Current pricing: 10 GB-month storage and operation allowances, then $0.015/GB-month; Class A/B request charges apply, egress is free. CDN cache still needs freshness/purge design. |
| Workers Cache API | Optional per-data-center optimization | Local to the invoking data center; not Tiered Cache. Global purge constraints differ from zone cache. It executes within the Worker and therefore does not prove no Worker work on visits. |
| Zone CDN cache / Cache Rules | Public HTML/media delivery | Use for browser/CDN caching where supported and validate interaction/order with Worker routes. Cache hit ratio, purge behavior, and cacheable HTML must be measured on `nextap.services`, not inferred from configuration. |
| Cloudflare Access | Candidate admin gate | Appropriate for a small internal workforce using an identity provider. Confirm user lifecycle, MFA, recovery, and local role requirements. If owners/users expand later, use a deliberate identity product or app-owned auth rather than assuming Access is a customer identity system. |

Cloudflare documentation checked 2026-11-11: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/), [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/), [Workers Cache](https://developers.cloudflare.com/workers/reference/how-the-cache-works/), [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/), and [Cache purge](https://developers.cloudflare.com/cache/how-to/purge-cache/). Plan entitlements and prices change; recheck before provisioning.

### Similar Projects and Reusable Patterns

Research did not identify a public, source-verifiable product that combines editable multi-tenant profiles with this exact D1/KV/R2 stack. Linktree-like profile services and restaurant menu platforms are useful product/UX analogues, but their public architecture is opaque; WordPress is an editable CMS analogue, but does not establish the required no-handler public-hit behavior. Do not treat any of them as evidence for Cloudflare performance or cost.

The strongest reusable pattern is write-time publication: persist canonical tenant data, render a deterministic revision when content changes, upload immutable output and media, then switch a small mutable route/pointer. Cloudflare documents Workers Static Assets as static-first with per-route `run_worker_first` behavior ([Static Assets](https://developers.cloudflare.com/workers/static-assets/)); R2 custom domains expose objects with Cloudflare cache/security features ([R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)); Pages also separates static assets from optional Functions ([Pages](https://developers.cloudflare.com/pages/), [Pages Functions](https://developers.cloudflare.com/pages/functions/)). These primitives support the design, but do not themselves provide a user-managed multi-tenant publishing control plane. Astro’s docs make the related boundary clear: static generation is ordinarily build-time, while dynamic routes use on-demand rendering ([on-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/), [Cloudflare deployment](https://docs.astro.build/en/guides/deploy/cloudflare/)).

Reusable pattern details: D1 owns mutable admin records; a successful publish writes revisioned HTML/JSON and media to R2; static routes or direct object paths serve the output; stable aliases/pointers have bounded caching/purge; immutable revision files use long TTLs. External menu/order destinations are plain links in the snapshot. A click-tracking redirect is optional and necessarily reintroduces a Worker request for that click, not for page rendering.

## Performance and 3G Acceptance

Sub-15 KB compressed HTML is realistic for this profile if the template is simple and styles are small. It is only one budget. Target an initial document with no client JavaScript, no third-party tags, one first-viewport image, no font download dependency, explicit image dimensions, and links usable without hydration. Keep below-fold gallery items lazy. Browser cache immutable media for a year; use short HTML freshness and explicit purge/version activation.

Acceptance should measure a real low-end Android device over a shaped 3G profile and a real 3G connection where available. Record median and p75 across cold cache and warm cache for: TTFB, FCP, LCP, HTML bytes, image bytes before LCP, total requests, DNS/TLS time, CPU long tasks, CDN status, Worker invocation count, and failure rate. Use several profile shapes (no cover, cover, gallery, Arabic text) and the QR/NFC path. A reasonable initial gate is warm public CDN LCP p75 below 2.5 s under the agreed lab network, with TTFB below 500 ms and HTML below 15 KB compressed; adjust after baseline and field data. These are proposed acceptance targets, not measured claims.

The 16-second observation needs a network waterfall. Common causes include uncached cross-region dynamic rendering, oversized cover images, image conversion/origin round trips, unavailable fonts, third-party scripts, sequential resource dependencies, or weak-device image decode. Removing Supabase can remove one dependency but cannot fix all of these by itself.

### Production Measurement: `/b/abdelrahman`

Tested 2026-11-12 in Chrome for Testing 158 with a fresh browser profile, 390×844 CSS viewport, DPR 3, mobile/touch emulation, Chrome `Slow 3G`, and 4× CPU slowdown. This is one synthetic lab run from the audit environment, not field-user data and not a repeatable percentile.

| Metric | Cold run | Warm browser reload |
| --- | ---: | ---: |
| TTFB / response start | 2.167 s | 2.159 s |
| FCP | 7.196 s | 2.268 s |
| LCP | 10.880 s | Not separately captured |
| DOMContentLoaded | 7.137 s | 2.562 s |
| Load event | 10.884 s | 6.114 s |
| Requests | 32 | 32 (13 of 31 subresources cached/revalidated) |
| Transferred bytes | ~355 KB total, including ~7.3 KB compressed HTML | ~76 KB subresource transfer in timing entries |

The page request returns `200`, `server: Vercel`, `x-vercel-cache: MISS`, `age: 0`, and `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`. The uncompressed HTML is 35,850 bytes; the Brotli body is 7,274 bytes. This is already under the proposed 15 KB compressed HTML budget, so HTML byte size is not the main 3G issue.

The LCP element is the cover image (`IMG.hero-photo`) from `/api/media/.../c7da3de6-32f3-4bbd-b6d4-b8a0d3fe0d2c.webp`. Its body is 58,060 bytes; request begins at 2.251 s, download ends at 10.412 s, and LCP lands at 10.880 s. The browser trace attributes 2.167 s to TTFB, 83 ms to image load delay, 8.162 s to LCP resource load duration, and 468 ms to render delay. The image response is `Vercel MISS`, `Cache-Control: public, max-age=60, must-revalidate`, and varies on `rsc`, router state, and `Cookie`. The 60-second revalidation and cookie variance are poor defaults for a public content-hashed image.

Cold request inventory: 11 JavaScript resources (~157 KB transferred), 3 fonts (~75 KB), 2 direct WebP assets (~71 KB), 1 CSS (~18.5 KB), 13 SVG requests (~11.3 KB), and one Next image optimization response (~15.2 KB), plus HTML. These sums are browser timing transfer sizes and include protocol overhead; they are approximate. The current server-rendered content has no third-party script request in this trace, but Next.js hydration still downloads multiple first-party chunks. The measured page load is 10.9 s, not the user’s exact 16 s; it is directionally consistent with a severe weak-network delay. A real device and repeated field tests remain necessary.

Warm reload cached/revalidated 13 of 31 subresources and reduced FCP to 2.27 s, but the document still had a 2.16 s response start and a 6.11 s load event. The HTML response remains `no-store`, so the browser continues to make a fresh page request. DevTools console showed no JavaScript exception; its CSP `eval` issue was generated while the inspection tool evaluated page timing, and a deprecated-entry warning came from the measurement probe.

Evidence artifacts: [cold mobile screenshot](../../.lavish/abdelrahman-cold-trace.png), [warm-run screenshot](../../.lavish/abdelrahman-slow3g-cpu4.png), and [warm-run Chrome performance trace](../../.lavish/abdelrahman-slow3g-cpu4.json.gz). The trace and screenshots contain public profile content and should be treated as production-derived artifacts.

### Next Work, Ranked by Measured Delay

1. **Fix public media delivery first:** move the cover image off the dynamic `/api/media` Vercel route to `media.nextap.services` backed by R2/CDN. Give content-hashed derivatives `public, max-age=31536000, immutable`; remove cookie/router `Vary`; confirm edge `HIT` from repeated requests. The hero image accounted for the largest single LCP delay.
2. **Remove uncached server rendering from the page path:** publish stable profile HTML at content update time and prove CDN/static delivery for `/b/{slug}`. Current TTFB is about 2.17 s even warm because the document is `no-store` and Vercel reports `MISS`.
3. **Reduce render-critical weight:** keep the static page link-first with no hydration; remove or defer the ~157 KB of Next.js JS chunks where behavior is not needed on first paint. Keep only one necessary font or use system fonts; current font resources total ~75 KB. Inline the small critical icons/sprite to reduce 13 SVG requests.
4. **Retest with representative profiles and real hardware:** at minimum, cover/no-cover, English/Arabic, low-end Android, cold/warm, and actual local 3G/4G. Repeat enough runs for median and p75 before setting an SLO. Compare LCP, hero transfer, TTFB, and request count against this one-run lab baseline.

Do not start by rewriting all admin storage solely to address this measured page. The complete Supabase exit remains the confirmed platform goal, but the immediate performance sequence is media caching and public static delivery; the wider D1/Auth/card migration can proceed behind that public performance gate.

## Security Assessment

| Risk | Severity | Required control |
| --- | --- | --- |
| Supabase Auth removal leaves public admin endpoints or weaker sessions | Critical | Put admin behind Access or a reviewed identity/session system; host-only `Secure`, `HttpOnly`, `SameSite` cookies; CSRF protection; MFA/recovery and role mapping; deny by default. |
| Application logic replaces RLS/RPC but misses row-level authorization | Critical | Centralize authorization in tested application service functions; check business/page scope on every write and read; add adversarial cross-tenant tests and audit events. |
| D1/R2/KV publish operations are not atomic together | High | Staged publication state, idempotency, immutable objects, manifest verification, D1 transaction for canonical state, reconciliation, and tested rollback. |
| KV stale values keep deleted/renamed content visible | High | D1 authority; short TTL/purge; tombstone/alias state in D1; deactivation SLA tests; don't cache card revocation indefinitely. |
| Public object access exposes draft/original files | High | Separate private source bucket/prefix or private bucket; publish only validated derivatives; no guessable private URLs as access control. |
| Malicious image uploads or decoder/resource exhaustion | High | Validate MIME by bytes, dimensions, pixel count, animation, decompression limits, output format, and size; normalize metadata; run bounded processing; malware/content policy as needed. |
| Cache poisoning or private response caching | High | Canonicalize slug and query input; cache only public GET/HEAD output; ignore/validate untrusted host/header inputs; exclude cookies/auth and drafts; stable explicit cache key; test purge and cache variants. |
| Card token enumeration | Medium | Preserve high-entropy random tokens, rate-limit abuse at edge, avoid token leakage/referrers/logging, return uniform unavailable states; measure before using token as cache key. |
| Slug enumeration | Low/Medium | Slugs are public identifiers, not secrets. Rate-limit abusive scans and avoid leaking draft/private metadata. |
| Admin/public Worker coupling | Medium | Separate routes/bindings and deployment environments; public Worker cannot reach admin credentials; minimize bindings and scopes; staging/production D1/R2/KV isolation. |

## Cost Model at 100 / 1,000 / 5,000 / 10,000 Businesses

No production traffic, average image size, retention period, cache-hit ratio, or invocation rate was provided, so a traffic total cannot honestly be estimated from business count. The following is a storage illustration, not a traffic forecast.

**Illustrative content assumption:** per business, 15 KB compressed HTML + 20 KB snapshot JSON + three public derivatives of 250 KB each = 785 KB, one current publication retained. This assumes one version and excludes originals, multiple branches, backups, abandoned versions, and menu assets.

| Businesses | Illustrative active artifact/media storage | Current R2 free storage allowance | Worker plan baseline |
| ---: | ---: | ---: | --- |
| 100 | ~0.08 GB | Within 10 GB-months | $5/month account minimum, usage allowances apply |
| 1,000 | ~0.79 GB | Within 10 GB-months | Same; requests/CPU depend on visits, not tenant count |
| 5,000 | ~3.93 GB | Within 10 GB-months | Same; test D1 write load and release ops |
| 10,000 | ~7.85 GB | Within 10 GB-months, narrowly | Same; versions/originals/branches can push beyond free storage |

Traffic economics: Worker base includes 10M requests and 30M CPU-ms/month; above that, current docs show $0.30 per million requests and $0.02 per million CPU-ms. CDN hits may still count as requests if Worker runs; if static cache bypasses the Worker, validate billing behavior and do not assume it. R2 request cost depends on origin operations/cache misses; egress is free. D1 paid allowances include 25B rows read/month and 5GB storage, plus daily read/write thresholds. KV adds per-operation and storage costs, so unnecessary KV lookups can add cost without improving a CDN-served hit.

Formula for R2 storage above allowance under this illustration: `max(0, retained_GB - 10) × $0.015/GB-month`. Add all retained historical versions and originals. Request costs are `uncached R2 GETs / 1M × Class B rate` plus uploads/copies under Class A rates; use current pricing table during rollout. D1 and KV can each fit within included usage at small scale, but queries/reads/retention must be measured. The $5 Workers base is not a total bill estimate: domain, Registrar, optional Access seats, observability, third-party identity, and existing Vercel overlap are excluded.

To produce a useful monthly total, collect 30 days of visits, HTML cache hit ratio, media bytes and cache hit ratio, publish count, D1 rows-read/written, KV operations, admin users, retained versions, and any paid identity/observability costs.

## Current vs. Proposed

| Concern | Current | Proposed |
| --- | --- | --- |
| Public page | Dynamic Next.js render + Supabase publication read | Publish-time generated HTML; CDN/static delivery; no DB on visit |
| Page cache | Process cache (5 s) and framework cache | Global CDN policy, immutable assets, controlled HTML freshness/purge |
| Admin state | Supabase Auth/Postgres/RPC/RLS | Cloudflare Access or selected identity + D1 + application authorization |
| Media | Supabase Storage and Next media route | R2 immutable public derivatives; private originals separated |
| Cards | Supabase RPC on valid scan | D1-backed Worker redirect with explicit revocation/freshness contract |
| Publishing | Postgres transaction covers snapshot + pointer | Staged R2 artifacts + D1 pointer transaction + purge/reconciliation |
| Menu | Free-form menu URL | `has_menu` and stable route/identifier; no Menu dependency during landing render |

## Migration Roadmap

1. **Measure and design proof (before changing production):** reproduce 16-second visit; record waterfall. Build a disposable Cloudflare route spike to prove stable `/b/{slug}` static object delivery, cache order, `/menu/*` coexistence, cache purge, and no Worker invocation on hit. Decide whether worker-free warm hits are mandatory.
2. **Inventory and schema mapping:** export authoritative production counts and data; map all 31 migrations, RPCs, RLS policies, Auth roles, cards, aliases, media, VCF, audit, secrets, and environment-specific behaviors. Define D1 schema and application authorization tests. Keep the export immutable and restore-tested.
3. **Cloudflare staging:** create isolated D1/R2/KV (KV optional), admin/public route bindings, media hostname, logging/alerts, rate limiting, backup/restore, and staging deployment. Do not change public DNS yet.
4. **Backfill and compare:** copy records to D1; upload R2 media derivatives; generate publication artifacts; dual-read/compare all profiles and card states; test AVIF, Arabic, branches, aliases, contact downloads, QR/NFC, deactivation, and rollback. Do not dual-write without idempotency and reconciliation.
5. **Public canary:** serve a small allowlisted set through the new edge path while preserving existing URLs. Compare output and latency; monitor 404s, cache misses, worker invocations, image failures, and publish consistency. Increase traffic gradually.
6. **Admin publishing and cutover:** move admin writes to D1/application services, verify D1 constraints and role checks, switch publish path, and retain Supabase read-only through an agreed rollback window. DNS should remain in place; change only Cloudflare routing once canary is healthy.
7. **Supabase removal:** after restoration and rollback gates pass, disable writes, reconcile final delta, export/archive per retention rules, remove secrets/dependencies/migrations, and terminate Supabase only after authentication, media, card, and audit ownership is confirmed in the replacement.

Zero downtime requires an authoritative traffic switch and rollback path. Do not make the D1 database the only copy until the export/import and restore rehearsal succeeds. Inventory printed destinations into direct-profile `/b/{slug}` URLs and token `/c/{token}` URLs. Preserve direct-link slugs or permanent aliases to the same business; preserve token assignments and active states. Also preserve VCF and media URL contracts for the migration window.

## Risk Register

| Risk | Severity | Mitigation / gate |
| --- | --- | --- |
| Cache design still executes Worker on each public hit | Critical | Routing spike with invocation count and cache headers; choose direct static delivery or explicitly accept Worker execution. |
| 16-second cause is misdiagnosed | High | Capture waterfall and device/network data before attributing latency to Supabase. |
| Supabase exit breaks admin identity or permissions | Critical | Auth/role inventory, MFA/recovery design, tenant-scope tests, staged admin migration. |
| R2 publication and D1 pointer diverge | High | Immutable objects, staged state machine, manifest verification, reconciler, old version retained. |
| KV stale alias/deactivation/card status | High | Keep D1 authoritative; explicit TTL and freshness SLA; active revocation tests. |
| D1 serialization/write contention | Medium/High | Load test concurrent publish/card operations; keep transactions short; monitor latency and busy errors; define escalation threshold before sharding or another database. |
| Menu path collision or auth/asset breakage | High | Verify same-host `/menu/*` routing, assets, callbacks, and independent deployment before routing contract is frozen. |
| AVIF uploads publish but fail to load | High | Fix media registration in replacement contract; test representative AVIF on real devices and all browser fallback paths. |
| CDN serves stale/deleted page | High | Short HTML TTL, immutable content key, purge path, tombstone response, test propagation and rollback. |
| URL/card/media regression during cutover | High | Full URL contract tests, canary traffic, logs for old/new routes, no URL rewrite until parity. |

## Final Recommendation

Proceed with a Cloudflare-native migration, but make the first deliverable a routing/cache proof rather than a database rewrite. The strict requirement “no application handler on a warm business visit” is the architectural hinge. If Cloudflare can serve stable tenant URLs as static cached objects alongside the separate `/menu/*` application, use that design: D1 for administration, R2 for immutable output/media, and no KV on the hot path. If a Worker must map every slug, use R2 plus a measured CDN cache and optional KV lookup, but describe the resulting guarantee accurately: no database on visits, with Worker execution still possible.

The recommended initial data design is D1 + R2 + KV. Use KV for cached slug/version resolution only on Worker miss/fallback paths, with bounded TTLs and D1 as the authority. Keep application rules out of database procedures. Replace Supabase Auth/RLS deliberately, migrate `/c/{token}` and contact/media paths, and require rollback/restore rehearsal before production cutover. Keep the Menu product separate; publish only a boolean and stable link contract.

## Open Decisions Before Implementation

1. Does the performance requirement forbid Worker execution on a warm hit, or only database/origin access?
2. What is the maximum acceptable freshness delay for page changes, slug changes, card deactivation, and profile takedown?
3. Is Cloudflare Access acceptable for all internal admin users, and what MFA/recovery/role behavior must be retained?
4. What exact Menu contract is stable: `has_menu`, Core business ID, slug, and `/menu/{slug}`? Which system provisions menu availability?
5. What is the 30-day traffic and media-size baseline, including cache ratios and number of retained versions?

This report is the audit result, not authorization to begin migration implementation.
