# Public profile media and performance investigation

Evidence date: **2026-10-28, Africa/Cairo**. Scope: read-only investigation of `https://nextap.services/b/keve-barber`, its AVIF media path, and the perceived delay around the About section. No application code, hosted data, migrations, or deployments were changed for this report.

## Findings

### The 43.6 kB value is the stored AVIF size

Production contains an AVIF object for the Keve hero cover:

| Evidence | Observation |
| --- | --- |
| `media_assets` | `mime_type = image/avif`, `size_bytes = 43509` |
| `storage.objects` | `metadata.size = 43509`, `metadata.mimetype = image/avif` |
| Published snapshot | The hero `coverUrl` references the same `73a5...avif` object |
| Browser request | The public API request for that AVIF currently returns `404` |

The supplied original, `64760678-8bf4-4277-91d2-3ec1c9e20b19 (1).avif`, is **12,687 bytes**, 1254 x 798 pixels, one still AVIF frame, and has no EXIF, ICC, XMP, or IPTC metadata. The recorded Production asset is 43,509 bytes: 3.43x the supplied original, or 30,822 bytes (243%) larger, if this is the source used for that asset.

I ran the current server-side transform locally with the repository's Sharp 0.35.5 dependency: rotate, photo bound of 1600 px without enlargement, then AVIF quality 60 / effort 4. It left the dimensions at 1254 x 798 and emitted **45,705 bytes**, 3.60x the original. That is 2,196 bytes (5.0%) above Production's recorded size, so it reproduces the expansion pattern but is not a byte-for-byte reproduction of the stored object. The browser preparation path passes this 12.7 kB file through unchanged because it is below the 3 MiB transport threshold (`src/lib/media/prepare.ts`); the server optimizer then re-encodes it. The production response is currently 404, so its stored bytes cannot be directly downloaded and matched to this original in this investigation.

This confirms that the image-size complaint is not just an estimate: the current re-encode can turn this already small, dimension-compliant AVIF into a file around 3.5 times larger. The source itself has no metadata to strip, and its dimensions are already below the photo bound. A later fix should evaluate retaining validated AVIF inputs like this one without lossy re-encoding, while still enforcing still-image validation, orientation, metadata policy, and the role dimension/pixel limits. Do not infer from size alone that the AVIF can always be retained unchanged; other inputs may carry orientation or metadata that needs normalization.

New AVIF uploads are not being deliberately renamed to WebP. The format is selected from the inspected bytes and the storage path, MIME type, and metadata use that format ([`src/lib/media/optimize.ts:24`](../../src/lib/media/optimize.ts#L24), [`src/lib/media/store.ts:18`](../../src/lib/media/store.ts#L18)). Older assets remain WebP by design.

### Published AVIF media currently has an authorization gap

The AVIF object exists, but the publication-media registration function still filters paths with a WebP/PNG/JPEG-only expression ([`supabase/migrations/20261024021635_publication_media_privacy.sql:23`](../../supabase/migrations/20261024021635_publication_media_privacy.sql#L23)). The later AVIF migration updates the `media_assets` constraint and storage bucket MIME list, but does not update that publication filter ([`supabase/migrations/20261028070727_allow_avif_business_media.sql:5`](../../supabase/migrations/20261028070727_allow_avif_business_media.sql#L5)).

For Keve, the current published snapshot contains the AVIF as `hero.coverUrl`, while `private.publication_media` contains the older WebP logo and contact image but not the AVIF cover. The private storage policy therefore rejects the public read, and `/api/media/...avif` returns `404`. This is a correctness issue to fix before measuring AVIF delivery performance. Existing snapshots will need an explicit safe re-registration or republish strategy after the allowlist is corrected; changing only the regex would not backfill old publication rows.

### About is not a separate slow data load

The public renderer builds the About section synchronously from the already-loaded publication snapshot ([`src/components/business/public-snapshot.tsx`](../../src/components/business/public-snapshot.tsx)). There is no About-specific fetch, route, or lazy boundary. In the latest browser run, the About text was present in the initial document at page Y=867.5 px. The public profile is one long page; it has no separate About panel to open. Reaching it is a scroll/reveal question, not a data-loading delay.

An earlier Chrome navigation recorded these timings, but its exact cache and throttle conditions were not retained, so treat it as a single lab observation rather than a repeatable cold baseline:

| Metric | Observed value |
| --- | ---: |
| Document TTFB | 208.5 ms |
| DOM interactive | 1122.3 ms |
| First paint / first contentful paint | 1312 ms |
| Document load | 1609.7 ms |

The About section was already present in the DOM at approximately page Y=840 in that run. The public route is request-rendered (`force-dynamic`) ([`src/app/b/[slug]/page.tsx`](../../src/app/b/%5Bslug%5D/page.tsx)), but the source also has request memoization, a five-second process cache, and an immutable-snapshot cache keyed by publication ID ([`src/lib/business/public-publication.ts`](../../src/lib/business/public-publication.ts)). Dynamic HTML does not mean every request necessarily reloads the full snapshot from the database. The browser alone cannot establish whether Production used the pointer/snapshot RPC path or its compatibility fallback.

### Fresh mobile browser trace

I rechecked the production URL in Chrome DevTools on 2026-10-28. This is one diagnostic navigation, not a three-run baseline; the browser profile already had some static assets cached, so it is not a clean cold-cache test.

| Signal | Conditions / result | Interpretation |
| --- | --- | --- |
| Lab setup | Chrome 155, 390 x 844 CSS px, DPR 3, Fast 3G emulation, 4x CPU throttle | One browser session; do not generalize to field users. |
| Document | 200, TTFB 62 ms, Brotli, `private, no-cache, no-store`, `x-vercel-cache: MISS` | The HTML is deliberately not shared-cached. TTFB was fast in this run, but does not describe a new connection or every region. |
| Paint | FCP 968 ms; LCP 1,467 ms; CLS 0 | No CrUX record was available for this URL, so these are lab-only metrics. |
| LCP breakdown | TTFB 62 ms; resource load delay 582 ms; load duration 798 ms; render delay 25 ms | Most LCP time followed the first byte. The trace identifies the loaded WebP logo as the LCP element because the hero AVIF failed. |
| Resource discovery | The stylesheet and visible image requests began around 640 ms after navigation; CSS blocked rendering for about 34 ms | The CSS transfer/parse itself was small. The gap before the browser discovered page resources deserves server/streaming timing before attributing it to a particular RPC or component. |
| About | Text present in the initial document at Y=867.5 px; no About-specific request | Page navigation and scrolling to About should be measured separately. |

The trace reproduced the cover 404. The cover request returned a 404 with `private, no-store`; the visible logo loaded successfully as a 9,910-byte WebP body (10,210 bytes including the response transfer recorded by Chrome). Thus the current 1.467 s LCP is not a valid measurement of the intended cover image. The hero is already marked eager/high-priority in the renderer; adding more preload or priority hints before restoring the cover would not fix this failure.

The browser resource entries also showed four loaded font files totaling 129,608 encoded bytes: Alexandria 400/600/700 and DM Sans 400. Ten JavaScript resources totaled 151,414 encoded bytes, and the stylesheet body was 18,172 bytes. These are resource-body sizes, not a cold transfer total: several static files came from browser cache or were revalidated. Fonts use `font-display: swap`; the CSS took about 34 ms in the trace, so preload-all or a CSS rewrite is not supported by this sample as the first optimization.

The page response being `private, no-store` is consistent with its dynamic route and does not disprove snapshot caching inside the server. The source already performs a live publication-pointer lookup before reading an immutable snapshot; keep activation/slug visibility checks live. A generic HTML CDN cache or another shared-cache service would add invalidation and privacy complexity without evidence that document TTFB is the present bottleneck.

If “opening About” means selecting a section in the admin editor, selection only updates local React state and calls `scrollIntoView` ([`src/app/admin/businesses/_components/business-editor.tsx:105`](../../src/app/admin/businesses/_components/business-editor.tsx#L105)). Global smooth scrolling is enabled ([`src/app/globals.css:10`](../../src/app/globals.css#L10)), so the visual movement can feel delayed without any network request.

## Safe optimization direction

The order below keeps the existing route, publication snapshot, storage privacy, and domain boundaries. It is a proposal for a later implementation task, not completed work.

1. **Restore and verify the published AVIF path first.** Correct the publication-media allowlist and explicitly re-register or republish existing eligible AVIF references. Preserve the private bucket and `/api/media` authorization. Then measure the actual cover's LCP and bytes; the present LCP is only the logo because the cover fails.
2. **Avoid expanding already optimized AVIFs.** The supplied source is 12,687 bytes and already within the photo dimensions; the same local quality-60 transform emitted 45,705 bytes, close to the 43,509-byte Production record. Evaluate a conditional pass-through for valid AVIFs that are under the role bounds and satisfy orientation and metadata requirements. Re-encode only when normalization is needed, then compare byte size and visual quality. Keep animation rejection, pixel limits, orientation behavior, and metadata stripping intact.
3. **Investigate the post-TTFB resource-discovery gap with existing route timings.** In this trace the first byte arrived at 62 ms, while the main stylesheet and visible image requests were not discovered until about 640 ms. Add no new caching layer yet: measure publication-pointer lookup, snapshot retrieval/cache hit, and when the first HTML containing resource links is streamed. The current source already has a live pointer plus immutable-snapshot cache; do not duplicate that design or cache the whole HTML response without preserving activation and alias checks.
4. **Test font payload reduction as a bounded experiment.** Four loaded fonts represented about 130 kB of encoded bodies. Check which weights are actually needed on this Arabic profile and whether an official variable/subset build is materially smaller. Preserve Arabic glyph coverage, user-entered text, and layout; do not preload every weight or remove a face based only on one profile's visible viewport.
5. **Keep the current server-rendered profile and measured client behavior.** The trace saw 10 JavaScript resources totaling about 151 kB encoded, but did not identify a long task or prove hydration as the bottleneck. Only split/remove client code if a route-specific trace ties it to the delayed resource discovery or interaction. Avoid a renderer rewrite, service worker, Redis, or broad lazy-loading changes.
6. **Set separate targets for navigation and About reveal.** The single trace reached FCP in 968 ms and LCP in 1,467 ms, so it does not support a 100 ms cold full-page target. A local About jump can feel immediate once the page is loaded, but the About reveal itself was not timed. If direct navigation to About is desired, evaluate a simple in-page anchor and measure scroll-to-visible separately; do not add an About fetch or lazy boundary.

## Guardrails for a future implementation

- Keep `src/lib/media`, `src/app/api/media`, `private.publication_media`, and public publication reads as separate ownership boundaries.
- Do not convert all existing WebP objects, rename extensions without inspecting bytes, or delete old media as part of a performance change.
- Do not publish draft-only media, remove storage RLS, or replace the publication allowlist with a broad bucket policy.
- Verify both a WebP publication and an AVIF publication, including a missing/revoked publication path, before release.
- Verify hero cover, logo, gallery, map/background, contact-photo generation, admin preview, and public rendering separately.
- Record cold and warm measurements on the deployed domain with cache state, viewport, device class, and connection profile.

## Evidence limitations

The supplied 12,687-byte original substantially improves the size comparison, but it cannot be proven byte-for-byte as the source of Production's media row because the protected 43,509-byte object currently returns 404. The local Sharp 0.35.5 transform gives a near match in size, not identical output; the exact output may depend on the deployed encoder build or prior image edits. The browser trace remains one run with emulated network/CPU and cached static resources; it is not real-user data, a cold-cache transfer total, or a repeated baseline. It confirms that the cover returns 404, the logo is the current LCP element, About is already present in the document, and post-TTFB resource discovery is late in this run. It does not establish the database/cache path used in Production, the cause of that gap, or performance on other networks/devices.

No tests were run because this report documents an investigation only. The working tree was checked after the investigation; only the unrelated pre-existing edits listed by Git remain outside this report.
