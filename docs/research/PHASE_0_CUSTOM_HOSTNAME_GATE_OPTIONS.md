# Phase 0 Custom-Hostname Gate Options

**Research date:** 2026-11-13
**Scope:** Cloudflare first-party documentation, the NexTap migration PRD, and the disposable Phase 0 Pages execution below. Production records and nameservers were not changed.

**Execution update (2026-11-13):** The disposable Pages proof project accepted `phase0.nextap.services`; only then was a Hostinger `phase0` CNAME added to `nextap-phase0-proof-20261113.pages.dev`. Cloudflare reports the hostname and certificate active. Public HTTPS checks returned 200 for the static profile, Pages Function control route, synthetic R2 media, and proxied synthetic Menu HTML/CSS. This Menu deployment is only a route fixture; it does not implement or verify the future Menu profile link or product behavior. R2 cache behavior was `MISS`, `HIT`, explicit purge, then `MISS`. Hostinger readback and public DNS confirm the apex, `www`, `admin`, `staging`, and Hostinger nameservers remain unchanged. In the same Wrangler live-tail window, two `/b/phase0-demo` requests generated no Pages Function logs while control, Menu, media, and purge requests did. This proof does not establish a Workers Route or direct R2 custom-domain/CDN path.

## Finding

Keep the Phase 0 behavioral gate. The migration PRD explicitly requires a warm `/b/{slug}` response with no Worker execution or database request, on the real custom hostname, while `/menu/*` continues to reach the separate Menu application. A `workers.dev` result alone cannot establish custom-hostname TLS, DNS, host matching, or path coexistence.

The current gate can be tested without a Cloudflare child zone by using a Cloudflare Pages custom subdomain backed by a CNAME in Hostinger. Cloudflare documents that a Pages custom subdomain does not need to be a Cloudflare zone and can use an externally managed CNAME to `<project>.pages.dev`. This leaves the apex, `www`, `admin`, and `staging` records untouched. The CNAME must be added only after Pages has accepted the custom-domain association; otherwise Cloudflare documents that the hostname can fail with `522`.

This Pages path can prove the key Phase 0 behavior on `phase0.nextap.services`: static profile objects served at the custom hostname without a Pages Function invocation, a positive-control Function invocation, and `/menu/*` reaching a separate non-production Menu deployment through a narrowly matched Pages Function. A Pages Function can bind the disposable R2 bucket on the same hostname for `/media/*`, so the test does not need a separate R2 custom domain or Worker Route. Media requests invoke that Function; the zero-invocation requirement applies to the static profile path. Cloudflare documents Free-plan custom-domain capacity and Pages assets served from Tiered Cache. Pages Function requests count against Workers plan usage, so keep this synthetic test low-volume; the Free Workers plan is sufficient for that use. This does not prove direct R2 custom-domain/CDN delivery or a Cloudflare Workers Route on an active zone. Validate the final media hostname/cache contract separately, or revise that target contract before rollout.

## Options

| Option | What it proves | Limitation |
| --- | --- | --- |
| `workers.dev` with Workers Static Assets | Cloudflare static asset delivery can bypass Worker execution; a selective `run_worker_first` control route can confirm invocation measurement | No custom DNS/TLS hostname or `/menu/*` behavior under `nextap.services`; cannot replace the PRD gate |
| Pages custom subdomain + Hostinger CNAME + R2 binding | Real custom hostname, static profile route with zero Function calls, positive control, R2 object path, and `/menu/*` coexistence on one host | Media requests invoke a Pages Function; does not prove direct `media.nextap.services` R2/CDN delivery or a Cloudflare Worker Route |
| Cloudflare Worker Route on `phase0.nextap.services` | Closest test of final Worker route configuration and hostname/path matching | Cloudflare Routes require an active zone and a proxied DNS record. The current parent zone is pending; standalone child zones are Enterprise-only |
| Cloudflare partial/CNAME zone setup | Cloudflare proxy while keeping Hostinger authoritative DNS | Cloudflare documents partial setup as Business or Enterprise, so this is not a free alternative |

## Recommended Test Path

1. Create a disposable Cloudflare Pages project with a synthetic static `/b/{slug}` object, an R2-bound Pages Function for `/media/*`, a positive-control Function route, and a `/menu/*` Function that proxies to a separate non-production Menu deployment.
2. Configure `_routes.json` so Functions match only `/menu/*` and the positive-control path. Cloudflare Pages documents that when a project has Functions, requests invoke a Function by default; `_routes.json` restricts invocations. A static asset path excluded from Function routing remains a static response.
3. Associate `phase0.nextap.services` through the Pages custom-domain flow before adding DNS. Cloudflare's Pages docs state that custom subdomains do not need to be Cloudflare zones and support an external CNAME to the project's `pages.dev` hostname.
4. If association succeeds, add exactly one Hostinger CNAME for the `phase0` label with `overwrite=false`, pointing to the Pages project's assigned hostname. Do not change the `nextap.services` apex nameservers or any existing production record.
5. Verify profile and media bodies, cache headers, zero Function invocations for `/b/{slug}`, expected Function invocations for `/media/*`, a positive control invocation in the same window, and `/menu/*` HTML/assets against the separate Menu deployment. Record that Pages Functions use R2 without a separate R2 hostname. This still does not validate direct R2 custom-domain delivery or zone purge semantics; resolve those target contracts before Phase 1.

Cloudflare's docs do not specifically state how Pages custom-domain association behaves when the parent domain is present in the same account as a pending zone. Treat successful Pages domain association and certificate issuance as a precondition. If that step rejects the hostname, stop before writing the Hostinger CNAME; the remaining path is a separately authorized root domain, an account-plan change, or an explicit product-owner decision to narrow the gate.

## Gate Assessment

The custom hostname, static/CDN response, Worker-free warm profile hit, and Menu coexistence checks are not redundant: they cover host/certificate behavior, route precedence, and the architecture's core request path. `workers.dev` is useful supplemental evidence but is insufficient on its own. Pages can host the profile, R2 binding, and Menu path under one custom hostname without separate R2 or Worker domains. The profile stays outside Function routing; media and Menu requests invoke Pages Functions. This tests R2 object access and app-level media caching but not direct R2 custom-domain delivery or zone purge semantics.

The migration PRD says to pause and resolve route design with the product owner if its warm-path gate cannot be proven. Therefore, keep the gate unless the product owner explicitly changes the no-Worker guarantee. A Pages CNAME test is the lowest-cost next experiment that preserves the custom hostname and avoids changes to production records.

## Sources

- NexTap [Cloudflare migration PRD](../specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md), especially the delivery contract and Phase 0 exit gate.
- NexTap [Phase 0 execution plan](../specs/NEXTAP_PHASE_0_EXECUTION_PLAN.md), especially P0.3 and its evidence matrix.
- Cloudflare, [Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/): custom subdomains need not be zones; external CNAMEs point to `<project>.pages.dev`; the Pages custom-domain association must be completed before adding the CNAME.
- Cloudflare, [Pages Functions routing](https://developers.cloudflare.com/pages/functions/routing/): file-based Function routes and `_routes.json` inclusion/exclusion behavior.
- Cloudflare, [Pages Functions bindings](https://developers.cloudflare.com/pages/functions/bindings/): R2 buckets can be bound to Pages Functions.
- Cloudflare, [Pages caching and performance](https://developers.cloudflare.com/pages/configuration/serving-pages/#caching-and-performance) and [Pages limits](https://developers.cloudflare.com/pages/platform/limits/): Pages asset caching, Free-plan custom-domain limits, and Function usage.
- Cloudflare, [Workers plans and pricing](https://developers.cloudflare.com/workers/platform/pricing/): Free-plan request limits for low-volume Functions tests.
- Cloudflare, [Workers routes](https://developers.cloudflare.com/workers/configuration/routing/routes/): route setup requires an active Cloudflare zone, Worker, and proxied DNS record.
- Cloudflare, [Workers static assets](https://developers.cloudflare.com/workers/static-assets/): matching assets are served without Worker code by default; `run_worker_first` can opt selected routes into Worker execution.
- Cloudflare, [Subdomain setup](https://developers.cloudflare.com/dns/zone-setups/subdomain-setup/): standalone child zones are Enterprise-only.
- Cloudflare, [CNAME setup (partial)](https://developers.cloudflare.com/dns/zone-setups/partial-setup/): partial proxy setup is Business or Enterprise.
