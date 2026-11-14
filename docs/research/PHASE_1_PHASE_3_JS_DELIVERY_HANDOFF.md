# Phase 1 to Phase 3 JavaScript Delivery Handoff

**Status:** Phase 3 design handoff; no JavaScript delivery or public static publication implementation is authorized by Phase 1
**Date:** 2026-11-14
**Scope:** JavaScript artifacts referenced by published NexTap Core profiles

## Decision summary

Phase 1 establishes the target publication and routing constraints, but does not choose where optional JavaScript bundles are stored or how their cache lifecycle is operated. Phase 3 must make and test that choice before implementing any script delivery. Core profile content and primary actions must remain usable without JavaScript; scripts are only for optional interactions and must not delay first content render.

| Topic | Approved | Provisional for Phase 3 planning | Unresolved |
| --- | --- | --- | --- |
| JavaScript use | No hydration is needed for core profile content/actions. Optional interactions may load a small script on user action. | Prefer no script request on the initial profile load unless a specific optional interaction requires it. | Which interactions warrant JavaScript, bundle boundaries, and a measurable script-byte budget. |
| Artifact storage | Published output is immutable; R2 stores immutable publication output and content-hashed public media. | Keep any approved script artifact immutable and content-addressed, with publication manifests referring to an exact version. | Whether profile scripts are part of the publication output in R2, served as Pages static assets, or delivered through another approved static/CDN path. Media storage policy does not itself decide JavaScript storage. |
| Cache policy | Hashed public media gets long immutable caching; mutable profile URLs get short explicit freshness and purge behavior. | Apply long-lived caching only to versioned/content-hashed script URLs whose bytes never change. | Exact script response headers, TTLs, purge scope, and interaction with the chosen host and publication rollback. |
| Versioning and rollback | Publications are immutable; failed publication retains the prior live version; rollback selects a retained verified version and purges the stable URL. Five recent profile versions are retained for immediate rollback. | Bind each publication manifest to the exact script URL/hash it expects; publish and verify dependencies before activating the publication pointer. | Whether shared scripts are independently versioned from profile publications, how long old script versions remain available, and how garbage collection accounts for retained/rollback versions. |
| CDN verification | Phase 3 must show expected static/CDN delivery and no Worker/database execution on repeated profile edge requests. | Add script-specific checks in addition to the profile HTML checks, observing URL, body hash, content type, cache headers, cache result where available, and Worker invocation evidence. | Chosen CDN path's observable cache signals, purge behavior, repeat-request expectations, and failure response contract. |

These categories are intentionally distinct: only the approved column is an existing target contract. Provisional items are recommendations for the Phase 3 design review, not owner approval. Unresolved items require resolution against the selected route and artifact layout before implementation.

## Phase 3 dependencies and test requirements

Before building script delivery, Phase 3 should:

1. Complete the applicable Phase 0 gates and select a route/artifact layout that preserves warm static profile delivery without a Worker, D1/KV/Supabase, or NexTap application-origin request. Phase 0's observed route proof does not select JavaScript hosting mechanics.
2. Identify each optional interaction that needs a script and show that the page's primary content/actions work with JavaScript disabled and before any optional script loads.
3. Define the publication manifest's script reference and integrity/version contract, then prove the script artifact exists and is verified before publication activation. Verify that rollback keeps all referenced script artifacts available.
4. Define cache headers and purge/freshness behavior separately for immutable script URLs and mutable profile URLs. Do not infer a CDN cache hit from matching bodies, a request identifier, or absent Worker logs alone.
5. Add deterministic staging tests that request script URLs repeatedly and assert status, content type, exact bytes/hash, cache headers, and appropriate CDN evidence. Include a changed-script publication, old-publication rollback, missing/corrupt artifact, and purge/freshness case. Keep script checks separate from HTML checks so HTML success cannot mask a broken script path.
6. Confirm that scripts do not introduce third-party requests, cookie-dependent cache variation, unsafe publication data, or a required client-side dependency for core page content/actions.

The PRD's current first-load JavaScript baseline is about 157 KB over 11 resources. Its target is no hydration for core content/actions and deferred optional interaction. That baseline is evidence for optimization, not a new approved byte ceiling. Phase 3 should set an explicit budget from its measured implementation and validate it on representative devices/networks.

## Phase 1 boundary

Phase 1 covers Cloudflare foundations, environments, data and authorization contracts, recovery, and operational controls. It does not implement JavaScript artifact delivery, static publication, public profile routing, or CDN cache behavior. Do not treat this handoff as authorization to deploy or alter public routes, production bindings/configuration, DNS, or production data. The Phase 3 work remains subject to the PRD's phase dependencies and later authorization.

## Sources

Repository contracts:

- [Landing Delivery and Supabase Exit PRD](../specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md), especially Product Requirements, Success Measures, Phase 3, Rollout and Recovery.
- [Phase 1 Execution Spec](../specs/NEXTAP_PHASE_1_EXECUTION_SPEC.md), especially publication versions, static delivery boundaries, Phase 1 acceptance criteria, and dependency map.
- [Phase 0 decision review](PHASE_0_P0_4_DECISION_REVIEW.md), for the boundary between route proof and authorization/mechanics for later implementation.

Official Cloudflare platform references (consulted 2026-11-14):

- [Pages: Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/) describes Pages static asset serving. It does not decide this application's script artifact layout or prove cache behavior for a future route.
- [Cache-Control directives](https://developers.cloudflare.com/cache/concepts/cache-control/) documents how response cache directives affect Cloudflare caching. Select and verify directives for the actual delivery path; the existence of a directive is not evidence of a cache hit.
- [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/) documents public bucket access and custom-domain delivery. The PRD's R2 role for publication output/media does not automatically approve putting JavaScript there.
