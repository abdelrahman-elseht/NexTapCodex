# NexTap observability and performance handoff

Audit date: 2026-10-10  
Branch: `integration/preprod` (validated checkout; source audit worktree: `chore/observability-audit`)  
Base: `integration/preprod` at `967fe92`  
Environment: local `next start` production build against approved staging Supabase project `flkakuysakgwfoemgbwn`.

## Phase 1 completed

- Audited the committed integration branch before the uncommitted Sentry files in the source checkout. The committed app has no Sentry SDK or instrumentation; it has normal error recovery screens and one media cleanup `console.error` path.
- Confirmed the staging Supabase project is `ACTIVE_HEALTHY` through Supabase MCP. Used the existing synthetic fixture `preprod-media-mv2fhxkp` and its already active dedicated card. No rows, assignments, publishing state, production service, DNS, or deployment was changed.
- Added the read-only lab runner [`scripts/observability-baseline.mjs`](scripts/observability-baseline.mjs), which validates the fixture/card, redacts card tokens and IDs in URLs, measures mobile and desktop routes, and records redirect headers.
- Added focused E2E checks [`tests/observability-baseline.e2e.ts`](tests/observability-baseline.e2e.ts) and [`e2e.observability.config.ts`](e2e.observability.config.ts) for the synthetic public page, responsive media, RTL layout, owner login, dashboard, editor live preview, and no-save/no-mutation behavior.
- Captured Lighthouse JSON/HTML, Chrome DevTools trace data, screenshots, network output, and Playwright MCP screenshots under `artifacts/observability-baseline/` (ignored by Git).

## Method and limits

Lighthouse ran against `http://127.0.0.1:3147` after `npm run build` and `next start`. Mobile used Lighthouse mobile emulation; desktop used desktop emulation. Landing and published routes have three comparable runs per device. Login, dashboard, and editor have one run per device because they use the staging owner session. Mobile lab traces used 390x844, DPR 2, 4x CPU throttling, 150 ms latency, 200 KB/s download, and 100 KB/s upload; desktop used 1440x960.

These are lab measurements, not field data. INP was not reported because no real-user data exists and the synthetic interaction sample produced no interaction entries. TTFB is a local/staging observation. Lighthouse back-forward-cache and dependency findings are recommendations, not proof of a production browser-cache regression.

## Lighthouse baseline

Scores are `Performance / Accessibility / Best Practices / SEO`; repeated public rows show the observed range.

| Route | Mobile | Desktop | Key metrics |
| --- | --- | --- | --- |
| `/` | `95–96 / 94 / 100 / 91` | `100 / 94 / 100 / 91` | Mobile LCP `2.7–2.8 s`, TBT `22–36 ms`; desktop LCP `0.55–0.58 s` |
| `/b/preprod-media-mv2fhxkp` | `91–92 / 100 / 100 / 91` | `100 / 100 / 100 / 91` | Mobile LCP `2.9–3.1 s`, TBT `68–88 ms`; desktop LCP `0.63–0.66 s` |
| `/login` | `98 / 100 / 100 / 91` | `100 / 100 / 100 / 91` | LCP `2.22 s` mobile, `0.47 s` desktop |
| `/admin` | `99 / 100 / 100 / 91` | `100 / 100 / 100 / 91` | Mobile Lighthouse TTFB `0.91 s`; desktop `16 ms` |
| `/admin/businesses/:id` | `100 / 96 / 100 / 91` | `100 / 97 / 100 / 91` | Mobile LCP `1.74 s`; mobile TBT `13 ms` |

Raw reports are `artifacts/observability-baseline/lighthouse-summary.json` and `lighthouse-<device>-<surface>-<run>.*`.

## Lab and browser evidence

| Surface | Device | TTFB | LCP | CLS | Transfer | Requests | DOM | Overflow / broken images |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Landing | Mobile | `8.8 ms` | `1.41 s` | `0` | `281,541 B` | `20` | `161` | `false / 0` |
| Published | Mobile | `9.8 ms` | `1.42 s` | `0.0006` | `330,429 B` | `23` | `619` | `false / 0` |
| Login | Mobile | `10.5 ms` | `0.90 s` | `0.0035` | `208,064 B` | `15` | `68` | `false / 0` |
| Dashboard | Mobile | `16.2 ms` | `1.26 s` | `0.0007` | `272,298 B` | `20` | `144` | `false / 0` |
| Editor | Mobile | `16.9 ms` | `1.44 s` | `0.0012` | `333,368 B` | `27` | `741` | `false / 0` |
| Landing | Desktop | `9.2 ms` | `0.15 s` | `0` | `281,541 B` | `20` | `161` | `false / 0` |
| Published | Desktop | `7.7 ms` | `0.46 s` | `0.0161` | `316,455 B` | `22` | `619` | `false / 0` |
| Login | Desktop | `12.9 ms` | `0.10 s` | `0.0034` | `208,064 B` | `15` | `68` | `false / 0` |
| Dashboard | Desktop | `14.2 ms` | `0.45 s` | `0.0006` | `281,893 B` | `26` | `143` | `false / 0` |
| Editor | Desktop | `27.3 ms` | `0.98 s` | `0` | `411,022 B` | `32` | `740` | `false / 0` |

The dedicated card was requested three times. Every response was `302` to `/b/preprod-media-mv2fhxkp?via=nfc`, with `Cache-Control: no-store, max-age=0` and `Referrer-Policy: no-referrer`; duration was `104–243 ms`. The token is held in memory and is never written to the report.

Chrome DevTools recorded the published mobile page with no console messages, 20 successful requests, four local WOFF2 font requests, and two optimized image requests. Playwright MCP confirmed Arabic `lang`, RTL `dir`, 390px content within the 390px viewport, 100 gallery images, hero `fetchpriority="high"`, and zero console errors. Focused E2E passed 4/4 on desktop and mobile; the public journey/security suite passed 30/30.

## Findings ranked by impact

### High

- Published mobile LCP is `2.9–3.1 s` in Lighthouse. The audit points to render-blocking/dependency work and the published page's media/large DOM. Investigate after Sentry is installed; no layout optimization was attempted in Phase 1.
- Lighthouse accessibility is `94` on landing and `96–97` in the editor. Concrete audits include color contrast, heading order, target size, and unsized images. These are existing product issues.

### Medium

- The editor is the largest surface: `333 KB` mobile / `411 KB` desktop, with `741` / `740` DOM elements. A local preview edit updated the phone preview with `aria-busy="false"` and sent `0` mutation requests; the unsaved-navigation guard remained active by design.
- Dashboard mobile Lighthouse TTFB was `912 ms`, while the local lab request measured `16.2 ms`; this variance indicates staging/auth/database work to monitor with server traces in Phase 2/3.
- SEO is `91` across all audited routes because Lighthouse reports a missing route-level meta description. Confirm metadata policy before changing it.

### Low

- Lighthouse reports unused CSS/JavaScript, render-blocking opportunities, and back-forward-cache reasons. Estimated savings were `11–22 KiB` or `0.2–1.5 s`; defer to a scoped optimization pass.
- The lab sees `ERR_ABORTED` requests for prefetched admin links during navigation. These are browser navigation cancellations; no 4xx/5xx assets or page errors were observed.

## Monitoring and Sentry MCP evidence

- The committed baseline has no `@sentry/nextjs` dependency, `instrumentation.ts`, Sentry config, or capture hooks. The source checkout's uncommitted Sentry files were excluded from this Phase 1 branch so the baseline remains measurable.
- Sentry MCP found organization `abdelrahman-0n`, project `nextap` (project `4512186692075600` in the Discover link). The last-30-day error aggregate returned no events. Existing enabled issue rules are “Send a notification for high priority issues” and “Send a notification when pull requests are ready”; no alert was changed.
- Phase 2 adds the official SDK with environment/release tags, low tracing, URL/token/header/cookie sanitization, and controlled staging-only client/server test errors. Session Replay, profiling, excessive logs, and production mutations remain out of scope.

## Phase 2 completed — Sentry integration

- Added `@sentry/nextjs@11.6.0` with client, Node server, and Edge initialization through `instrumentation-client.ts`, `instrumentation.ts`, `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts`.
- Runtime events use `staging` or `production` environments and a sanitized `nextap@<release>` value. `tracesSampleRate` is `0.05`; breadcrumbs are capped at 20. Replay, profiling, console capture, logs, database payloads, request bodies, cookies, query values, user information, and stack-frame variables are disabled.
- `lib/sentry.ts` removes card tokens, query values, bearer credentials, cookies, headers, user data, payment fields, and sensitive nested values from error events, breadcrumbs, and spans. Card redirect, publication, draft/save/publish, card assignment/history, media upload, and error-boundary paths now capture stable operation tags without identifiers or payloads.
- `withSentryConfig` uploads source maps only when `SENTRY_AUTH_TOKEN` is present, deletes uploaded maps from deploy artifacts, disables Sentry build telemetry, and never places the auth token in client code. The diagnostics page and API are guarded by `SENTRY_TEST_ERRORS_ENABLED=1` and never render in Production.

### Verification evidence

- Sentry MCP search found both controlled events in project `nextap`: client and server messages, `environment=staging`, `release=nextap@phase2-20261010`, and only `verification`/`surface` tags. The server response returned an event ID and the client status reached `sent`.
- Chrome DevTools recorded a successful Sentry envelope (`200`, 476-byte session envelope) and no console errors. The after-integration landing audit had 23 requests in this browser session, with one Sentry envelope; Phase 1 recorded 20 landing requests without Sentry. The extra request is the observable monitoring cost; the SDK remained at the existing shared bundle scale and tracing is sampled at 5%.
- Chrome DevTools Lighthouse after integration reported unchanged Accessibility/Best Practices/SEO scores of `94 / 100 / 91` on both desktop and mobile. This CLI exposes no Performance category, so no after-integration Performance score is claimed; the Phase 1 Performance/LCP/TBT numbers above remain the valid baseline.
- Playwright MCP desktop landing check: `lang=ar`, `dir=rtl`, no horizontal overflow, zero console errors, and the Sentry envelope returned `200`. Mobile published fixture check at 390px: content width 380px, no overflow, 100 gallery images, `fetchpriority=high` hero, and zero console errors.

### Phase 2 commands and results

```text
npm.cmd install --save @sentry/nextjs@^11.6.0       pass
npm.cmd run typecheck                                pass
npm.cmd run lint                                     pass (0 errors, 13 existing warnings)
npm.cmd test                                          pass (87 tests / 16 files)
npm.cmd run build                                     pass (Next 15.5.27)
npx.cmd e2e run --config e2e.config.ts tests/sentry-observability.e2e.ts --target desktop
                                                       pass (1/1)
npx.cmd e2e run --config e2e.config.ts --target desktop tests/public-journey.e2e.ts tests/public-security.e2e.ts
                                                       pass (14/14)
npx.cmd -y chrome-devtools-axi ...                    pass (landing, diagnostics, network, Lighthouse)
Playwright MCP                                        pass (desktop/mobile responsive checks)
Sentry MCP                                             pass (client/server event search)
git diff --check                                      pass
```

## Commands and results

```text
npm ci                                      pass
npm run build                               pass (Next 15.5.27)
npm run lint                                pass (0 errors, 13 existing warnings)
npm run typecheck                           pass
npm test                                    pass (84 tests / 15 files)
npx e2e run --config e2e.observability.config.ts ... pass (4/4 focused tests)
npx e2e run tests/public-journey.e2e.ts tests/public-security.e2e.ts ... pass (30/30)
node scripts/observability-baseline.mjs lab  pass (10 surfaces x 2 devices)
node scripts/observability-baseline.mjs lighthouse pass (18 Lighthouse runs)
npx -y chrome-devtools-axi ...              pass (trace, console, network, mobile emulation)
Playwright MCP                               pass (responsive/public checks, 0 console errors)
git diff --check                            pass
```

The production dependency audit found three existing advisories: `next` (moderate), `postcss` (high transitive), and `sharp` (high). Evidence is in `artifacts/production-dependency-audit.json`; no dependency was upgraded.

## Phase 1 changed files

- `OBSERVABILITY_HANDOFF.md`
- `e2e.observability.config.ts`
- `scripts/observability-baseline.mjs`
- `tests/observability-baseline.e2e.ts`

## Phase 2 changed files

- `.env.example`, `.gitignore`, `package.json`, `package-lock.json`, `next.config.ts`, `e2e.config.ts`
- `instrumentation.ts`, `instrumentation-client.ts`, `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- `lib/sentry.ts`, `lib/observability.ts`, `lib/public-publication.ts`
- `app/c/[token]/route.ts`, `app/api/admin/cards/assignment/route.ts`, `app/api/admin/cards/[id]/history/route.ts`, `app/api/admin/media/route.ts`
- `app/admin/businesses/actions.ts`, `app/error.tsx`, `app/admin/error.tsx`, `app/global-error.tsx`
- `app/sentry-example-page/page.tsx`, `app/sentry-example-page/sentry-diagnostics.tsx`, `app/api/sentry-example-api/route.ts`
- `tests/sentry-observability.e2e.ts`, `tests/sentry-sanitization.test.ts`

## Cost, privacy, blockers, and next steps

The lab uses the existing staging account and fixture only. The controlled verification generated two staging Sentry events; no Production events, credentials, paid features, deployments, DNS changes, migrations, or customer data changes were made. Card tokens and owner credentials are never written by the runner; event sanitization removes tokens, query values, cookies, headers, user fields, payment identifiers, and payloads. Build auth remains a server/CI-only variable, and source maps are deleted after upload.

There are no implementation blockers. Production still needs environment-specific `SENTRY_DSN`, `SENTRY_ENVIRONMENT=production`, `SENTRY_RELEASE`, and optional `SENTRY_AUTH_TOKEN` deployment configuration, plus a human review of alert policy. No deployment or merge was performed.

1. Retain the raw Phase 1 and Phase 2 reports as the pre/post monitoring evidence.
2. Configure the same project with separate staging and production DSN/release values in the deployment environment.
3. Review the existing high-priority alert rule and add only a small critical-error alert if the current Sentry plan supports it.
4. Address accessibility, metadata, LCP, and editor payload findings in separate scoped work.

## Phase 3 completed - validation

Validation was rerun in this integration checkout against the local production build on `http://127.0.0.1:3147`. The existing synthetic fixture was read from the audit worktree through `AUDIT_FIXTURE_PATH`; no fixture rows, card state, assignments, or published data were changed.

The focused observability suite passed on both targets: `tests/observability-baseline.e2e.ts` passed `2/2` on desktop and `2/2` on mobile. The public regression smoke suite passed `14/14` on desktop and `14/14` on mobile (`tests/public-journey.e2e.ts` plus `tests/public-security.e2e.ts`). The checks covered the published media gallery, Arabic RTL layout, responsive overflow, owner login, dashboard, editor live preview, and the no-save/no-mutation guard.

Chrome DevTools validation found no console errors. The landing page loaded with 21 successful requests in the current production build. Under 390x844 mobile emulation, the published fixture reported `lang=ar`, `dir=rtl`, content width `390px`, no horizontal overflow, 100 gallery images, `fetchpriority=high` on the hero, and zero broken images. Chrome DevTools Lighthouse reported `94 / 100 / 91` for Accessibility / Best Practices / SEO on both desktop and mobile; this CLI does not expose the Performance category.

Sentry MCP verified the controlled staging events already emitted by the diagnostics route. `NEXTAP-3` (client) and `NEXTAP-4` (server) each matched `environment:staging`, release `nextap@phase2-20261010`, and the expected `surface=sentry-diagnostics` / `verification` tags. The event IDs were `9a82b90583e9422ab9c10cc68917f482` and `ae727225658e4c2a8a4672242e82e7cd`. A Sentry MCP search for `environment:production` returned no events.

The direct Playwright MCP evidence from Phase 2 remains in `.playwright-mcp/` and the two root screenshots; the e2e runner uses the same Playwright browser engine for the fresh desktop/mobile assertions. Chrome DevTools screenshots and Lighthouse reports from this rerun are under `artifacts/phase3-lighthouse/` and `artifacts/phase3-chrome-*.png`.

### Fresh before/after lab comparison

The read-only runner captured cold-cache measurements in `artifacts/observability-baseline/lab.json`. The comparison below uses the committed Phase 1 lab output in the audit worktree and the fresh Phase 3 output. The fresh server had no runtime DSN configured, so this isolates the SDK/build overhead and does not claim another Sentry envelope delivery.

| Surface | Device | Before transfer / requests / LCP | After transfer / requests / LCP | Observed delta |
| --- | --- | --- | --- | --- |
| Landing | Mobile | 281,541 B / 20 / 1,412 ms | 351,016 B / 21 / 1,468 ms | +69,475 B, +1 request, +56 ms |
| Published | Mobile | 330,429 B / 23 / 1,416 ms | 399,897 B / 24 / 1,688 ms | +69,468 B, +1 request, +272 ms |
| Login | Mobile | 208,064 B / 15 / 900 ms | 277,210 B / 16 / 828 ms | +69,146 B, +1 request, -72 ms |
| Dashboard | Mobile | 272,298 B / 20 / 1,264 ms | 341,317 B / 21 / 1,256 ms | +69,019 B, +1 request, -8 ms |
| Editor | Mobile | 333,368 B / 27 / 1,436 ms | 402,465 B / 28 / 1,416 ms | +69,097 B, +1 request, -20 ms |
| Landing | Desktop | 281,541 B / 20 / 152 ms | 351,016 B / 21 / 144 ms | +69,475 B, +1 request, -8 ms |
| Published | Desktop | 316,455 B / 22 / 456 ms | 385,923 B / 23 / 760 ms | +69,468 B, +1 request, +304 ms |

These are local lab observations with cache and browser variance. The Phase 2 staging browser capture separately recorded one successful 200 Sentry envelope; the extra monitoring request is the expected runtime cost when an event is sent. No production Performance score or field INP value is claimed.

## Phase 4 completed - handoff

The implementation is ready for review in the integration checkout. The changed application files are listed under the Phase 1 and Phase 2 sections above; Phase 3 adds this report and ignored evidence under `artifacts/` and `.playwright-mcp/`. No production deployment, DNS change, merge, migration, paid feature, or customer-data mutation was performed.

### Exact validation commands

```text
npm.cmd run typecheck                                      pass
npm.cmd run lint                                           pass (0 errors, 13 existing warnings)
npm.cmd test                                               pass (87 tests / 16 files)
npm.cmd run build                                           pass (Next 15.5.27)
npx.cmd e2e run --config e2e.observability.config.ts tests/observability-baseline.e2e.ts --target desktop  pass (2/2)
npx.cmd e2e run --config e2e.observability.config.ts tests/observability-baseline.e2e.ts --target mobile   pass (2/2)
npx.cmd e2e run --config e2e.observability.config.ts tests/public-journey.e2e.ts tests/public-security.e2e.ts --target desktop  pass (14/14)
npx.cmd e2e run --config e2e.observability.config.ts tests/public-journey.e2e.ts tests/public-security.e2e.ts --target mobile   pass (14/14)
node scripts/observability-baseline.mjs lab                 pass (10 surfaces: 5 routes x 2 devices)
npx.cmd -y chrome-devtools-axi lighthouse --device desktop    pass (94 / 100 / 91)
npx.cmd -y chrome-devtools-axi lighthouse --device mobile     pass (94 / 100 / 91)
git diff --check                                         pass
```

### Remaining prioritized work

- High: investigate published mobile LCP and the media-heavy DOM; the Phase 1 Lighthouse range remains the baseline.
- High: address existing accessibility findings (contrast, heading order, target size, and image sizing).
- Medium: investigate staging/auth TTFB variance on the dashboard and editor.
- Medium: review the measured shared bundle increase after Sentry integration before launch.
- Low: confirm route-level metadata policy and address the SEO description finding.
