# Optimization phases 1â€“3 implementation report

Date: 2026-10-10
Branch: `beta01.6`
Baseline: `c28383a2a269b87cc5a10eb24ff1db9aa47e9edb`

Phases 1â€“3 are implemented without a commit or deployment. Database changes were applied only to the authorized isolated NexTabCodex project (`flkakuysakgwfoemgbwn`). The production project (`jezpobjlfvihikplxrta`) was not changed.

## What changed

- Session refresh now runs through the Next.js 15 `src/middleware.ts` entry point and is limited to admin/auth paths. Public business and card routes use a cookie-free client and retain their redirect and no-store behavior.
- Provider profiles are installed in the isolated schema. The draft save contract has explicit eight- and nine-argument public/private overloads with no defaults that make legacy calls ambiguous. Legacy saves preserve existing profiles; invalid saves remain transactional.
- Managed media accepts URL entry and authenticated uploads for hero, logo, payment background, map, and gallery fields. Server-side `sharp` decoding is authoritative; inputs are bounded at 5 MiB, 20 megapixels, and 16,384 px per dimension, then oriented, metadata-stripped, resized, and stored as immutable WebP objects. Save/publish is disabled while uploads are pending.
- Public rendering uses managed/local image optimization with an external URL fallback, eager hero/logo loading, lazy below-fold images, reserved geometry, captions, alt text, and broken-image recovery. Gallery items retain independent URLs.
- Fonts are served as versioned WOFF2 files with Arabic/English language selection and selective landing preloads. Public and admin loading states expose accessible status text. Editor previews are deferred while draft input, save revisions, and failure recovery remain immediate.

## Verification

- Vitest: **52 tests passed** across 10 files.
- TypeScript: `npm.cmd run typecheck` passed.
- Production build: `NEXTAP_BUILD_DIR=.next-optimization npm.cmd run build` passed.
- Focused mutation e2e: **14/14 passed** across desktop and mobile (`.e2e/optimization-phase123/e2e-confirmation/report.json`). This covers auth expiry/sign-out, reordering, QR manufacturing, media rendering, uploads, draft reload, pending-upload guards, save failure/retry, and newer-edit preservation.
- The existing owner-card prerequisite suite remains skipped when its shared database does not contain exactly one eligible published page; it is not counted as a pass. Owner assignment and reassignment are covered by the passing owner journey.
- SQL transaction/RLS contract passed on NexTabCodex, including provider inheritance, legacy eight-argument save preservation, publication immutability, rollback on invalid sections, owner isolation, and anonymous grants.
- Read-only media audit: 38 registered assets, 1,356 draft rows, 98 publication snapshots, and zero candidates older than the seven-day grace period.
- Supabase advisors showed only pre-existing security warnings (`rls_auto_enable`, `create_card_batch`, and disabled leaked-password protection) and nine unused-index informational notices. No unrelated advisor changes were made.
- Chrome inspection of the final public fixture at desktop and 390Ã—844 mobile found no console errors, no failed resources, no horizontal overflow, correct Arabic document direction, eager hero/logo and lazy gallery behavior, and successful public screenshots in `.e2e/optimization-phase123/`.

## Production-mode measurements

The same deterministic fixture and 60-sample method were used for the isolated baseline (`before-isolated-metrics.json`) and final build (`after-final-metrics.json`). Values below are medians from the lab script; cards intentionally remain an unoptimized phase-4 surface and were affected by accumulated isolated test rows.

| Surface/device | Transfer before â†’ after | Font bytes before â†’ after | LCP before â†’ after | CLS before â†’ after |
| --- | ---: | ---: | ---: | ---: |
| Landing desktop | 326,862 â†’ 281,529 | 183,283 â†’ 130,948 | 104 ms â†’ 96 ms | 0.00046 â†’ 0.00020 |
| Landing mobile | 326,862 â†’ 281,529 | 183,283 â†’ 130,948 | 1,688 ms â†’ 1,180 ms | 0.00428 â†’ 0.00313 |
| Demo desktop | 326,111 â†’ 270,640 | 160,575 â†’ 114,300 | 44 ms â†’ 48 ms | 0.00024 â†’ 0.00010 |
| Demo mobile | 326,111 â†’ 273,328 | 160,575 â†’ 114,300 | 656 ms â†’ 500 ms | 0.00046 â†’ 0.00021 |
| Published desktop | 318,645 â†’ 316,668 | 160,575 â†’ 152,008 | 384 ms â†’ 364 ms | 0 â†’ 0 |
| Published mobile | 318,645 â†’ 317,302 | 160,575 â†’ 152,008 | 1,040 ms â†’ 1,036 ms | 0.00083 â†’ 0.00013 |

The font files on disk decreased from 500,564 bytes of TTF to 187,500 bytes of WOFF2. The browser transfer figures are the measured evidence; they are not real-user percentiles. The editor and cards surfaces grew in DOM or transfer because phase 2 renders the requested gallery photos and the shared isolated database accumulated test history; pagination/history work remains phase 4.

## Media lifecycle and rollback

Objects use immutable paths `<owner UUID>/<business UUID>/<random UUID>.webp` and are never overwritten. Draft sections reference the object URL, and publication snapshots copy that reference, so historical publications remain valid. The read-only audit scans all registered assets, drafts, and publication snapshots and reports unreferenced assets only after seven days. It never deletes. Storage-only objects are deliberately not enumerated by the current script and require a separately paged bucket listing before any future cleanup automation. Failed metadata writes delete the just-uploaded object; failed client uploads leave the draft unchanged.

Rollout order is: apply the provider/media schema migrations to an isolated project, deploy the server and client code, verify the contract and upload tests, then enable the editor fields. Rollback keeps the prior URL-based fields and public renderer available, disables the upload controls, and leaves immutable objects and publication history intact. The compatibility wrappers can be retained while older clients are drained; no historical media deletion is part of rollback.

The upload route uses a conservative 3 MiB multipart ceiling (below the commonly documented 4.5 MB Vercel function request limit), with browser preprocessing for larger inputs. The exact production hosting limit still needs confirmation in the deployment environment before enabling uploads there.

Phases 4â€“6 (pagination/history, incremental saves, and publication caching) remain unchecked in the handoff and were not implemented.
