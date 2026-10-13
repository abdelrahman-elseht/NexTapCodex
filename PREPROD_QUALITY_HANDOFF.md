# NexTap pre-production quality handoff

Date: 2026-10-11  
Branch: `fix/preprod-quality`  
Base: latest validated `integration/preprod` checkout

## Release decision

The branch is ready for pre-production review. The published Business Page meets the mobile LCP target in three consecutive Lighthouse runs, the affected browser journeys pass on desktop and mobile, dependency advisories are clear for production dependencies, and no production deployment, merge, migration, or destructive database operation was performed.

Production release still needs the environment-specific Sentry DSN/release settings and confirmation that the phase-6 publication RPCs are present in the target project.

## Security advisory investigation

The reported advisories were checked with `npm audit --omit=dev` and the installed dependency tree.

| Package | Result |
| --- | --- |
| `next` | Kept at `15.5.27`; this is the compatible patched version already used by the validated branch. |
| `postcss` | Pinned to `8.5.29` through the root `overrides` entry, covering the transitive Next/Vite copies. |
| `sharp` | Updated from `0.34.5` to `0.35.5`. |

Final evidence: `npm audit --omit=dev` reported `found 0 vulnerabilities`; `npm ls next postcss sharp --all` showed `next@15.5.27`, `postcss@8.5.29 overridden`, and `sharp@0.35.5`.

## Sentry transfer and capture changes

The client SDK no longer initializes as a full client instrument on every route. `next.config.ts` disables App Router auto instrumentation and tracing injection, while error boundaries, explicit operation wrappers, and a small browser error listener retain capture. `src/lib/observability/client.ts` loads the client SDK only when an error needs to be sent and reuses the loaded module for subsequent errors. Sanitization and server/edge initialization remain unchanged.

The shared client JavaScript reported by the production build is 103 KB, down from approximately 141 KB in the Sentry-integrated measurement. The published route is 112 KB First Load JS. The final published Lighthouse resource summary contains 10 script requests and 121,421 bytes of script transfer. The two required DM Sans files now serve the 400/500 and 600/700 mappings, reducing the published page's font transfer from 78,216 bytes to 38,908 bytes without changing the font family or layout.

Sentry MCP verification found the controlled staging events:

- Client issue `NEXTAP-3`, event `9a82b90583e9422ab9c10cc68917f482`, `environment=staging`, release `nextap@phase2-20261010`, `verification=client`.
- Server issue `NEXTAP-4`, event `ae727225658e4c2a8a4672242e82e7cd`, `environment=staging`, release `nextap@phase2-20261010`, `verification=server`.

The final local server had no DSN configured, so this verification reused the existing controlled staging evidence and did not emit another event.

## Published Business Page performance

The page now keeps the hero image eager, high priority, synchronously decoded, and quality 50. The gallery is a client-loaded island that waits for intersection; all 100 images still render when the gallery is reached. Below-fold business sections use `content-visibility` with reserved space. The page loading route was removed so the real published response remains the measured LCP content. Publication reads share the metadata/page lookup briefly and remember a missing phase-6 RPC capability so an older pre-production project does not pay that schema-cache error on every request.

Lighthouse 13.4.1 mobile emulation (412x823, simulated 150 ms RTT and 4x CPU) produced:

| Run | LCP | Total transfer | Performance | Accessibility | Best Practices | SEO |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2,376 ms | 201,609 B | 98 | 100 | 100 | 100 |
| 2 | 2,257 ms | 201,880 B | 98 | 100 | 100 | 91 |
| 3 | 2,226 ms | 201,880 B | 98 | 100 | 100 | 91 |

The retained pre-optimization Lighthouse reports (`artifacts/preprod-quality-lighthouse/lh-mobile-1..3.json`) measured LCP of 3,249-3,323 ms and transfer of 362,005-362,011 bytes. The published HTML response is approximately 32.5 KB after the gallery split; the earlier full gallery response was approximately 230 KB. The final desktop published runs scored 100 Performance, 100 Accessibility, and 100 Best Practices.

## Accessibility fixes

- Corrected the reported text and accent contrast values, including public section labels and landing-page copy.
- Removed the invalid marketing preview heading level and preserved a single page heading hierarchy.
- Raised interactive controls and editor/provider controls to at least 44 px touch targets.
- Added explicit dimensions to editor previews, provider icons, and managed image variants to prevent layout shifts.
- Kept image failure placeholders in the original geometry and retained meaningful alt text/labels.

The final published mobile and desktop Lighthouse runs report Accessibility 100. The browser checks also confirmed Arabic `lang`, RTL direction, no horizontal overflow, and zero broken images.

## Regression evidence

| Check | Result |
| --- | --- |
| `npm.cmd run typecheck` | Pass |
| `npm.cmd run lint` | Pass, 0 errors and 13 existing warnings |
| `npm.cmd test` | Pass, 87 tests across 16 files |
| `npm.cmd run build` | Pass, Next.js 15.5.27 production build |
| `npm.cmd audit --omit=dev` | Pass, 0 vulnerabilities |
| Observability baseline E2E | 2/2 desktop, 2/2 mobile |
| Media rendering E2E | 2/2 desktop, 2/2 mobile |
| Public journey and security E2E | 14/14 desktop, 14/14 mobile |
| Read-only observability lab | Pass on all 10 surfaces and both devices |
| `git diff --check` | Pass |

The lab requested the dedicated card three times; every response was `302` to `/b/preprod-media-mv2fhxkp?via=nfc` with `Cache-Control: no-store, max-age=0` and `Referrer-Policy: no-referrer`. Payment links, public security behavior, owner login, dashboard, editor preview, and the no-save mutation guard passed in the public journey/security and observability suites. The editor interaction sent zero mutation requests.

## Remaining risks

- The process-local publication cache has a five-second freshness window. A newly published or disabled page can take that long to become visible in an already-running process. The capability memoization only activates when the phase-6 pointer function is absent from the target schema.
- Lighthouse SEO is 91 on routes where Lighthouse observes no route-level meta description; this is outside the requested quality fixes.
- Lint retains 13 pre-existing warnings, including existing raw `<img>` warnings and an unused editor label.
- The first published Lighthouse run observed an 836 ms staging TTFB from a cold RPC/schema-cache path, but its LCP remained 2.376 s. Monitor TTFB with deployment telemetry.
- Production still needs `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`, staging or production environment values, a release name, and optional `SENTRY_AUTH_TOKEN` for source-map upload.

No production deployment, database change, or merge into `main` was made.
