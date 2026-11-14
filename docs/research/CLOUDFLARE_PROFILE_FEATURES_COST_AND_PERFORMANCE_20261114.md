# Cloudflare Profile Features: Cost and Performance Assessment

**As of:** 2026-11-14
**Status:** Research and recommendation; no feature approval or implementation implied
**Scope:** Five-image horizontal gallery, FAQ, and WhatsApp message templates on the NexTap business profile under the assumed $5/month Workers Paid plan. Gallery image size is owner-provided: 120 KB per AVIF.

## Decision

These features are compatible with the target architecture if published as static profile content and immutable R2/CDN media. Normal profile visits and clicks on `wa.me` links should not invoke a Worker. The main risks are loading too many image bytes before they are needed, accidentally routing public reads through dynamic Worker code, and adding stateful client JavaScript for interactions that native HTML already supports.

The $5 Workers Paid plan currently includes 10 million Worker requests and 30 million CPU-milliseconds per month. Static asset requests are free and unlimited. The quota distinction matters: a cached dynamic Worker response still counts as a request, while a static asset does not. R2 has no egress charge; Standard R2 currently includes 10 GB-month storage, 1 million Class A operations, and 10 million Class B operations per month, with overages charged by storage and operation type. Cloudflare Images is a separate product with its own storage/delivery pricing; this assessment assumes R2-backed derivatives. No traffic or image-retention forecast is available, so a total monthly bill cannot be responsibly estimated from feature count alone.

## What Exists Today

- The active target is Cloudflare: D1 is the authority for mutable records; immutable publication output and public media live in R2; KV is a bounded, non-authoritative slug/version fallback cache. A warm `/b/{slug}` response must be static/CDN served with no Worker or database execution. See the [migration PRD](../specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md).
- Public profiles already have a gallery section in the legacy/current editor model, with image items, alt text, managed media uploads, and publication support as a compatibility requirement. Existing editor paths are visible in `src/app/admin/businesses/_components/business-editor.tsx` and `item-editor.tsx`; that does not prove the Cloudflare publication runtime is implemented.
- WhatsApp already exists as a contact/action provider. Current helper builds a `wa.me` destination from a normalized Egyptian phone number in `src/lib/business/providers.ts`. This is a direct external link today; configurable message templates are not established by the migration contract.
- FAQ is not a defined profile section in the editor section-kind inventory. Treat it as a product addition, not as existing migration parity.
- Phase 1 is still incomplete: dev/staging D1, R2, and KV resources exist, candidate D1 migrations `0001`-`0003` are applied, but the full runtime is not deployed, there are no R2 media objects, bindings/secrets and authorization are incomplete, and Phase 1 acceptance remains blocked. See [Phase 1 environments](../../infra/cloudflare/PHASE_1_ENVIRONMENTS.md) and [closeout status](PHASE_1_CLOSEOUT_STATUS_20261114.md).
- The PRD baseline is one dated synthetic run, not field percentiles: approximately 355 KB / 32 requests, with a 58 KB cover image taking 6.12 seconds and overall LCP 10.88 seconds on Slow 3G plus CPU throttling. The proposed mobile image target is 35 KB for the tested cover derivative. It already calls for no hydration for core content/actions and WebP by default, retaining AVIF only after support, MIME, fallback, and real-device decode checks.

## Feature-by-Feature Assessment

| Feature | Best-fit target implementation | Worker quota effect | Performance and business effect | Main guard |
|---|---|---|---|---|
| Five-image horizontal gallery (120 KB each) | Publish five sized, content-hashed AVIF objects to R2; HTML points directly to media CDN. Provide a compatible fallback unless the browser matrix proves AVIF-only support is acceptable. | Zero Worker invocations for image GETs when served as static/CDN objects. R2 reads may occur on cache misses, not per view once edge-cached. | A complete gallery view transfers about 600 KB; each image is visible one at a time in the left/right scroller. | Load the first visible image eagerly only if it is in/near the initial viewport; images 2-5 are lazy. Horizontal scrolling alone does not prevent neighboring images from fetching. Measure real browser behavior, use fixed dimensions, and retain keyboard/touch operation. |
| FAQ | Render concise question/answer text in static HTML. Use native `<details><summary>` if collapsible behavior is desired; no JS required. | No Worker effect. | Answers objections (hours, delivery, bookings, location, payment methods) and reduces message friction. Long answers add HTML/text but little bandwidth versus images. | Keep answers in HTML for accessibility/search indexing; avoid shipping a client accordion bundle. Do not promise Google FAQ rich results: Google currently limits FAQ rich results to authoritative government/health sites. |
| WhatsApp message templates | Business-configured short template options link to `https://wa.me/<international-number>?text=<URL-encoded-text>`. Render as ordinary anchors; open WhatsApp externally. | No Worker effect if no click tracking, redirect, or API integration is introduced. | Reduces typing friction and guides leads into booking/order/support intents. Link carries the prefilled text in the URL and may be visible in browser history/logs or third-party handling. | Normalize and validate phone number; encode text once; disclose no sensitive personal/customer data in templates; keep a plain WhatsApp link if custom text is absent. Do not add WhatsApp Business API/server sending under this assumption. |

The gallery is a left/right horizontal scroller, not a five-column grid. Its five AVIF files are each 120 KB, so the maximum full-gallery transfer is about 600 KB per uncached visit that reaches all images. A maximum of five published items is a recommendation, not a current contract. Keep controls keyboard-operable, show focus, support touch, and reserve image dimensions. `loading="lazy"` is a browser hint, not a strict rule that only fetches after the user scrolls; horizontally adjacent slides can be fetched before they are centered. Confirm the actual loaded image count and bytes in target browsers.

## Quota and Cost Model

Cloudflare's current Workers pricing page lists $5/month for Workers Paid, 10 million included requests/month with $0.30 per extra million, and 30 million included CPU-ms/month with $0.02 per extra million. Static asset requests are free and unlimited. Cloudflare says cached responses still count as requests, while CPU is incurred only when the Worker runs. Thus static CDN behavior has an important cost advantage over a Worker that returns a cache hit.

R2 pricing lists no egress bandwidth charge. Standard R2 includes monthly free storage and operation allowances (currently 10 GB-month, 1 million Class A operations, and 10 million Class B operations); beyond those, storage and reads/writes are billable. CDN cache hits avoid repeated origin reads, but exact object-cache behavior and cache-hit ratio must be demonstrated on the configured custom domain. Do not treat “R2 egress free” as “all image delivery has no cost”: storage, transformations, Worker image-resize execution (if used), and operational reads can still matter. Cloudflare Images is a separate billable product and is not included in the $5 Workers plan assumption.

There is no direct “businesses hosted” quota in the $5 Workers plan for static/CDN profiles. To estimate capacity, the Lavish calculator computes the R2 storage, R2 monthly Class B read, Worker request, and Worker CPU ceilings, then shows one final result. The default scenario uses five current 120 KB gallery images plus a 15 KB published page object (615 KB/business), R2's separate 10 GB-month Standard free allowance, 100 profile visits/business/month, two average gallery images fetched/visit, three active edge locations/business, a five-minute mutable HTML TTL, 365-day immutable-media TTL, 10 million R2 Class B reads/month, and zero Worker requests/CPU per business under static delivery. Storage limits the result at about 16,260 active profiles; estimated R2 reads also remain below allowance. This is an account-level allowance scenario, not capacity guaranteed by the $5 fee. The result changes with retained unique media, traffic, cache behavior, dynamic routes, and existing account usage. Paid R2 storage can raise the storage ceiling.

The calculator exposes gallery/retained-media counts, image and page sizes, R2 storage and Class B read allowances, visits/business, carousel depth, active edge locations/business, HTML/media cache TTLs, Worker requests and CPU/business, existing shared Worker use, and both Workers allowances as sliders with exact numeric inputs. Estimated cache fills use expected unique edge locations visited during each TTL window, assuming evenly distributed visits and a cold start each window. The final result also reports projected monthly profile visits, R2 reads, Worker requests/CPU, cache-miss percentage, and the binding allowance. This is a planning heuristic, not measured Cloudflare cache behavior. Real traffic, edge distribution, purges, and cache eviction can change the outcome. Edge cache reuse can reduce R2 reads, but not bytes delivered to users.

## Recommended Delivery and Optimization

1. Keep profile HTML as a generated immutable publication and preserve the PRD requirement that a warm profile URL is static/CDN-served without Worker, D1, KV, or Supabase access. Profile refreshes use the existing short freshness/purge policy; hashed media gets long immutable caching.
2. Produce display-sized derivatives at publication time, not on profile view. A 120 KB AVIF per image is the current input assumption, not proof that the image is small enough for mobile. Measure quality at the displayed dimensions and consider smaller width/quality derivatives for narrow screens. Set responsive `srcset`/`sizes`; cap dimensions and encoded bytes and strip unsafe metadata as the PRD already requires.
3. Eager-load only the actual LCP/first gallery image when it is visible; do not give it `loading="lazy"`. Set width/height or `aspect-ratio` to prevent layout shifts. Use native lazy loading for images 2-5 and avoid preloading all five. Because the carousel is horizontal, test whether the browser fetches adjacent slides early. Consider `fetchpriority="high"` only for the measured LCP image.
4. Keep FAQ and WhatsApp anchors functional in plain HTML. Keep FAQ answers concise so the compressed page stays within the PRD's proposed 15 KB HTML budget; use native `<details>`/`<summary>` when collapsible behavior is needed. Add no hydration for either feature. Avoid click analytics, per-visit D1 writes, short-link redirects, and Worker proxying unless a future product requirement justifies the traffic and data-retention implications.
5. Prefer AVIF only when the target browser matrix and image-quality review show an actual byte/quality benefit. Provide WebP/JPEG fallback using `<picture>` or publication-compatible negotiation; ensure correct content types. The PRD currently states WebP as the compatible default and AVIF is conditional.
6. For media, use content-hashed URLs, public cache headers (`public, max-age=..., immutable` for immutable objects), no cookies, and no Next.js router/header variation. Verify `CF-Cache-Status`/equivalent, cache key, range behavior, MIME, and actual Worker invocation counts from staging.
7. Add a repeatable “gallery” performance fixture: first-view and scrolled image bytes, image count before LCP, layout shift, LCP/FCP, cache status, image decode success, and no-JS rendering. Test Arabic/English, low-end Android, Slow 3G, AVIF/WebP fallback, keyboard controls, and a missing image.

## What to Add to the Migration Architecture

These are proposed PRD/architecture clarifications, not implementation status:

- **Phase 3 publication contract:** define gallery cardinality (recommended 0-5), item ordering, horizontal-scroll behavior, alt text requirement or decorative-image semantics, aspect ratio/crop, responsive derivative width/byte ceilings, file format/fallback, and content-hash naming. Specify which image is the LCP candidate and that only it may be eager/preloaded based on measured layout. Include a measured budget for bytes before LCP and average bytes after left/right scrolling; 120 KB per AVIF means 600 KB when all five load.
- **Phase 3 public HTML contract:** add a FAQ section schema with bounded item count and answer length; publish answers into semantic HTML. Define any structured data only if validated and avoid claiming FAQ rich-result eligibility.
- **Phase 3 action contract:** allow zero or a small bounded number of named WhatsApp templates; specify placeholder policy, URL encoding, phone normalization, privacy constraints, and deterministic link tests. Keep the destination direct and avoid adding a Worker redirect.
- **Acceptance gates:** add maximum gallery bytes through LCP, total image bytes for a complete gallery scroll, request count, CLS, image CDN hit ratio/R2 operation budget, no Worker invocations on profile/media GET, and direct `wa.me` link correctness. Set values after representative-device measurement rather than guessing beyond current 35 KB mobile cover target.
- **Admin/publishing parity:** validate AVIF registration bug correction already called out in the PRD; ensure draft originals stay private and only published derivatives are public. Failed media publish must leave the last valid publication available.
- **Phase placement:** P0/P1 should only record this as a planned feature and validate route/media contract where required. Gallery derivatives, FAQ schema/rendering, and template publication belong in Phase 3. Do not advance them by routing around Phase 0 static-host proof or incomplete Phase 1 bindings, access, restore, and owner-approved schema.

## Risks and Limits

- The gallery transfer chart assumes 100 visits per business monthly, fixed 120 KB per AVIF, and no browser cache reuse; it is a scenario comparison rather than a traffic forecast.
- The $5 plan price and included request/CPU quotas are current official published facts as checked on 2026-11-14; account-specific pricing, add-ons, taxes, and future price changes are not assessed.
- We cannot calculate monthly cost without page views, scroll-through rate, object sizes/retention, cache-hit ratio, image transformation choice, and total account Worker usage.
- A lazy image can still load early because the browser chooses a distance threshold. It is a resource hint, not a strict scroll intersection gate.
- AVIF can reduce bytes but decoding cost, fallback reliability, and actual device support must be measured on the target audience.
- Direct WhatsApp links may expose the prefilled template in the URL and leave the site; this is expected behavior and should be reflected in template content/privacy design.
- “Five wide images” does not establish that galleries must be user-authored in this feature request. Existing editor gallery is compatible baseline, while capacity and fixed layout are proposed constraints.

## Delegated Terra Review

Requested as `gpt-6.1-terra` with low reasoning effort in an ephemeral read-only Codex run. The review agreed that these features belong in Phase 3, called out the ambiguous “five wide” layout, and required checks for image bytes before LCP, request count, layout shift, scroll loading, and browser decoding. It noted FAQ and message templates are not current target contracts, while gallery and direct WhatsApp links exist in the current product. The reviewer did not independently verify live quotas; the pricing figures above were separately checked against Cloudflare's current official pricing pages on 2026-11-14.

## Sources

Repository sources:

- [Active migration PRD](../specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md), especially principles, public profiles, media, phases 0-6, budget, and performance gates.
- [Phase 1 environment inventory](../../infra/cloudflare/PHASE_1_ENVIRONMENTS.md).
- [Phase 1 closeout status](PHASE_1_CLOSEOUT_STATUS_20261114.md).
- `src/app/admin/businesses/_components/business-editor.tsx`, `src/app/admin/businesses/_components/item-editor.tsx`, and `src/lib/business/providers.ts` for existing gallery and WhatsApp editor behavior.

Primary external sources:

- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Workers limits and plan request behavior: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare R2 pricing, free tier, and no-egress policy: https://developers.cloudflare.com/r2/pricing/
- Cloudflare Images pricing (separate from Workers/R2): https://developers.cloudflare.com/images/pricing/
- Cloudflare R2 custom domains: https://developers.cloudflare.com/r2/buckets/public-buckets/ (public bucket/custom-domain delivery guidance)
- Cloudflare cache concepts and cache-control: https://developers.cloudflare.com/cache/concepts/cdn-cache-control/
- Cloudflare static assets: https://developers.cloudflare.com/workers/static-assets/
- HTML image loading semantics: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img
- Responsive images: https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images
- WhatsApp click-to-chat link form: https://faq.whatsapp.com/5913398998672934/
- Google FAQ structured-data eligibility: https://developers.google.com/search/docs/appearance/structured-data/faqpage
