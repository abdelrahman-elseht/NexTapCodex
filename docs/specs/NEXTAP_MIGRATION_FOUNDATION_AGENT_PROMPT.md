# NexTap Migration Foundation - Agent Handoff Prompt

Prepared 2026-10-30. This document specifies the work for a follow-on agent; it is not evidence that any migration phase has been completed.

## Mission and authorization

Act as a senior software architect and Cloudflare/Supabase migration engineer. Inspect this repository and prepare a reviewable, evidence-backed foundation for a Cloudflare-first migration. Work incrementally and preserve the application, Production, data integrity, privacy, and unrelated work.

Cloudflare is the permanent hosting and delivery target. Supabase remains the administrative control plane and source of truth. Production remains on Vercel until explicit cutover approval. Optimize UX, DX, and AX: fast public pages, understandable modules, reproducible tests, clear operational evidence. Do not reduce requested scope because work seems large.

This assignment authorizes read-only inspection, a safe local branch/worktree, and the five documentation deliverables below. It does not authorize Phase 1 application restructuring or subsequent migration execution. The original brief allowed limited foundation edits but also said review must precede Phase 1; resolve that ambiguity conservatively. Describe proposed directories/interfaces/tests, but do not move runtime code, introduce tooling/dependencies, enforce new lint rules, or implement Phase 1.

No Cloudflare/Supabase/DNS/R2/Production writes, database migration or synchronization, deployments, pushes, merges, commits, resets, cleans, stashes, branch/worktree deletion, or unrelated refactoring. Do not run tests/scripts that could mutate hosted data or trigger external side effects. Do not reveal secrets, credentials, tokens, cookies, environment values, or customer records. Stop only for an action that is destructive or genuinely uncertain; continue independent work.

## 1. Guidance, research, and evidence

Read AGENTS.md, docs/ARCHITECTURE.md, and relevant links from docs/README.md. Read these research inputs and only the relevant linked operational handoffs:

- docs/specs/CLOUDFLARE_R2_MIGRATION_SPEC.md
- docs/research/PUBLIC_PROFILE_MEDIA_AND_PERFORMANCE.md
- Relevant handoffs for environment separation, staging, capacity, security, and launch.

Inspect current source/configuration, not just old documents. Preserve repository patterns: @/* maps to src/*; route UI belongs in local _components directories; middleware/instrumentation live directly under src; Next routes stay in src/app unless a later approved phase moves them; use literal paths for [slug], [id], and [token] in PowerShell.

Label each finding: Verified in source; Previously observed with date and limitations; Verified in environment with read-only method/date; Assumption/proposed target; or Blocked/unavailable evidence. Cite paths, symbols, and lines. Distinguish dependency declarations, lockfile resolution, deployed versions, account settings, and measured behavior. A successful Next build does not prove Worker compatibility. A migration file does not prove it was applied remotely.

Use current official Cloudflare, OpenNext, Next.js, Supabase, and Hostinger documentation for support, limits, and prices. Record source URLs, date, pinned versions/runtime flags, and caveats. Never infer account settings you cannot inspect.

### Superseded research

The 2026-10-28 Cloudflare/R2 spec is useful historical implementation evidence but proposes transitional behavior that conflicts with later decisions: one shared Next app/Worker, Supabase publication-pointer reads, and Supabase media fallback. The later approved direction supersedes those points:

- Two initial application deployments: Admin and Public.
- Ordinary public Portfolio requests make zero Supabase requests, including cold/miss/expiry/error paths, metadata, session refresh, or browser-side data/media/feature reads.
- Generate published HTML during publishing and deliver it through Cloudflare/R2/CDN.
- Keep QR/NFC and VCF as narrow dynamic exceptions in Public.
- Keep publishing coordination inside Admin initially. Do not create a third Worker absent demonstrated CPU, duration, reliability, permission, or scaling need.

Document this decision and trade-offs. Do not rewrite historical evidence or describe the target as already implemented.

### Current findings to revalidate

At preparation, the source worktree was on main at 230adeca680c0fe7e22b3ece0fd9169764b84ffe, with unrelated tracked edits and untracked research/spec files. Inspect fresh state; do not assume it remains clean.

| Concern | Actual source to inspect | Initial evidence to verify |
| --- | --- | --- |
| Versions | package.json and lockfile | Next.js 15.5.28, React 19.1.1, Sharp 0.35.5, @supabase/ssr 0.10.0, supabase-js 2.100.1 are declared; resolve actual lockfile versions. |
| Architecture | docs/ARCHITECTURE.md, src/app, src/lib | Existing modular monolith groups business, cards, media, auth, Supabase, config, security, observability. No assumed need for wholesale monorepo rewrite. |
| Portfolio | src/app/b/[slug]/page.tsx, src/lib/business/public-publication.ts | Dynamic page, publication RPCs, React memoization, five-second process cache, immutable snapshot cache and compatibility fallback. A cache hit is not a zero-Supabase architecture. Inspect metadata and rendering separately. |
| Publication | src/lib/business/public-publication.ts, publication.ts, draft actions and SQL | Snapshot fields, RPC contracts, revision/transaction behavior, alias/status rules, grants/RLS. |
| QR/NFC | src/app/c/[token]/route.ts | Dynamic resolve_card, token validation, uncached redirect, via=qr/nfc, inactive/unassigned/invalid states. Preserve printed URLs. |
| VCF | slug/card contact.vcf routes and contact helpers | Live eligibility and private contact-photo access. Preserve dynamic/no-store behavior. |
| Media | src/app/api/media/[...path]/route.ts, src/lib/media | Private Supabase bucket, publication authorization, draft/owner and contact-photo behavior. |
| Runtime | src/lib/media/optimize.ts, contact-photo.ts, upload handlers | Native Sharp, Buffer and Node APIs require Worker proof or redesign; nodejs_compat alone does not prove native addon support. |
| Auth/config | src/middleware.ts, src/lib/supabase, src/lib/auth, src/lib/config/environment.mjs | Middleware scope, SSR/session usage, environment guard behavior. Adapt, never bypass, existing guards. |
| CI/integrations | next.config.ts, .github workflows and Sentry setup | CSP, source maps, release metadata, build variables, tests, deployment triggers and Vercel-specific assumptions. |

#### AVIF gate

The dated public-media research reported a published AVIF returning 404 because the private.publication_media registration filter omitted .avif although the asset rules accepted AVIF. Inspect migrations 20261024021635_publication_media_privacy.sql and 20261028070727_allow_avif_business_media.sql, later migrations, and any available applied-version evidence. The latest local AVIF-preservation commit does not prove publication registration/backfill is repaired. Plan a forward migration and explicit safe re-registration/republish; do not change already-applied migrations, broaden bucket policies, or execute a backfill now.

The investigation also found one 12,687-byte AVIF re-encoded to around 43-46 kB. This is an example, not a universal ratio. Any pass-through must preserve validation, still-image/pixel limits, orientation, metadata policy, and quality. Research found About already in the document and only one non-repeatable browser trace; do not invent a separate About fetch problem or claim a cold-cache baseline.

## 2. Git and worktree safety

Before creating/reusing a branch or worktree, run and review equivalents of:

- git status --short --branch
- git branch --show-current
- git worktree list --porcelain
- git log -15 --oneline --decorate
- git branch --all
- git rev-parse --show-toplevel
- git rev-parse main
- git cat-file -t 230adeca680c0fe7e22b3ece0fd9169764b84ffe
- git show-ref --verify refs/heads/migration-architecture

The final command can report absence. Inspect remote/tracking freshness without printing credential-bearing URLs. Inventory dirty files, untracked files, branches/worktrees, target path, and diffs. Never overwrite or clean existing work.

Use latest approved main, never old Staging. Verify the known SHA and compare Main. If Main advanced, inspect all intervening commits and approval/release evidence; newer is not automatically approved. If approval is unclear, continue read-only work from the known approved baseline and flag the source choice before runtime work. A read-only fetch, if necessary, must not change files, push, or deploy; report whether remote freshness was established.

Intended branch is migration-architecture and intended sibling worktree is ../nextap-migration-architecture relative to repo root. If both are absent and path unused, create using the reviewed equivalent of:

git worktree add -b migration-architecture ../nextap-migration-architecture <approved-main-sha>

If branch/path exists, inspect ancestry, SHA, attachment, dirty state and contents. Reuse only if clearly the intended worktree. Never force-add, overwrite, reset, delete, or switch the existing Production worktree. If conflict prevents safe creation, stop that operation and explain while continuing independent inspection. All assignment edits go in the dedicated worktree; recheck path/branch before each write.

Untracked research in the original worktree will not automatically appear in a new one. Read it in place and record provenance. Copy only relevant documentation if needed for a self-contained review; never copy the dirty app tree or credentials.

Document that Git branches and deployment environments differ:

| Code location | Hosted target |
| --- | --- |
| Preparation branch from approved Main | Future Cloudflare Staging Admin/Public |
| Dedicated worktree | Existing Supabase Staging only |
| Existing Main/production release | Production Vercel remains live during migration |
| A branch is not an environment | Supabase/Cloudflare Production remain isolated |

Inspect CI/provider triggers before any future push. No push is authorized now.

## 3. Required documents

Create substantive, linked:

- docs/architecture/current-architecture.md
- docs/architecture/codebase-structure.md
- docs/migration/migration-plan.md
- docs/migration/migration-spec.md
- docs/migration/migration-status.md

Keep docs/ARCHITECTURE.md as navigation authority; add a concise link to new documents if safe. Use relative links and keep documents consistent. Preserve unrelated edits.

### 3.1 Current architecture

State baseline SHA/worktree/dirty-state caveat; application structure and dependencies; request/data flow; every public/admin route/action/middleware match with path/method/auth/DB-RPC/storage/transformation/cache/side-effect/runtime; query/RPC inventory and SQL grants/RLS/transaction dependencies; Admin Auth/session and publishing; /b/{slug} including metadata/cache/fallback and asset requests; upload/draft/private/public/contact media; QR/NFC, VCF, export and feature behavior; environment variable names only, scopes and browser/build/runtime use; CI/tests/deployment triggers, Vercel/Sentry dependencies; debt, blockers, gaps.

Define inspection coverage (first-party runtime, SQL/migrations, relevant scripts/config/dependencies; exclude vendor/build output), making "complete inspection" auditable. Label facts vs assumption vs inaccessible evidence.

Provide an actual-code compatibility matrix. Classify each significant used feature: compatible at API level but Worker proof required; configuration; code change; redesign; incompatible/unproven. Cover App Router/RSC, Server Actions, middleware, handlers, Node APIs, static generation, cache/revalidation, streaming if used, Supabase SSR/Auth/cookies/RPC/RLS, Sharp, uploads, Next image behavior, Sentry/maps, QR/ZIP/VCF, environment guards, CI. For each cite use/source, official compatibility evidence, required change, Staging proof and pass criteria. Pin actual Next/OpenNext/Wrangler compatibility. Do not install or upgrade packages now.

### 3.2 Codebase structure

Start from actual existing src/lib domains. Show three distinct trees: actual inspected layout, documentation scaffolding created now, and proposed Phase 1 layout. Describe module responsibility, callers, interface, private internals, allowed imports and gradual migration. Map businesses, publications/publishing, media, cards, features, auth, contacts/VCF and public Portfolio without requiring uniform folders.

Prefer existing domains and gradual seams over moving all Next.js code into apps/admin. A separate public entry point may be useful, but two deployments do not require monorepo tooling. Do not add Nx/Turborepo, DI framework, generic layers, global barrels, or empty trees without an evidenced need.

Document rules: UI calls workflow interfaces, not new infrastructure clients; domain imports no provider/Next/Node/browser SDKs; introduce seams only for real variations/testing; infrastructure implements them; Public renderer consumes approved snapshot and cannot reach drafts/database; Admin code/secrets cannot enter Public output. QR/VCF are explicit exceptions to a blanket Supabase import ban. No cycles, duplicate rules, private cross-module imports, or mixed-runtime barrels. Plan narrow future architecture tests using existing tooling, including transitive/build-output validation and justified exceptions. Document now; implement only after Phase 1 approval.

### 3.3 Migration plan and target

Design (do not claim implemented):

- Admin Worker at admin.nextap.services: existing compatible Next App Router via OpenNext, Supabase Auth/RLS, admin, drafts, business/cards/uploads/private preview, publish coordinator.
- Public Worker at nextap.services: published HTML/slug status and alias, narrow QR/NFC and VCF, response security, suitable limits and sanitized logs. Ordinary Portfolio delivery never calls Supabase. It contains no Admin handlers/secrets/privileged credentials and cannot write R2.
- Supabase: PostgreSQL, Auth/RLS, business identity/source, drafts, publication history/metadata, cards, private media, admin RPC.
- R2: separate protected publication artifacts/pointers from public immutable media served on media.nextap.services. Draft, contact and private media stay in private Supabase Storage initially.
- Future features each have separate repository, frontend/backend/data, Cloudflare deployment and release. Do not create them now.

Include a diagram and responsibility table for Workers/OpenNext/DNS/CDN/R2/Cache API/Supabase DB/Auth/Storage/RLS/image processing/observability; mark needed now, conditional, or deferred. Defer Queues, KV, Durable Objects, D1, Cloudflare Images/Containers and extra services absent an identified benefit. Sharp incompatibility is real: compare supported processing approaches and do not claim two deployments suffice if another execution runtime is actually needed.

Explain static artifacts, Worker execution, direct R2 media. Deploy-time static assets are not automatically dynamic R2 data. Cache API hits execute Worker unless actual routing/billing evidence shows a bypass. Do not claim CDN means zero Worker cost without proof. No request-time HTML business rendering or transformation in ordinary /b.

#### R2 artifacts and publishing

Evaluate this minimal logical key layout, not a mandatory public bucket:

published/{publication_id}/index.html
published/{publication_id}/snapshot.json
slugs/{slug}.json
media/{sha256}.{extension}

Separate access policies/buckets for artifacts/pointers and public media. R2 is not transactional DB. Do not leak old HTML via an unguarded public publication-ID URL/raw bucket endpoint. Reuse publication IDs/business UUID/revisions where sound. Define minimal validated slug mapping/status/alias, versioned sanitized allowlist snapshot, deterministic HTML escaping/URL checks, security/canonical/OG/accessibility behavior. Exclude raw rows, drafts, private/contact projection, auth data, card tokens, credentials.

Specify the actual future sequence: auth/publish authorization and revision validation; idempotent publication attempt; snapshot validation; public media promotion with hash/MIME/extension/dimension/integrity checks; deterministic HTML rendering (inspect Next-specific coupling; never assume RSC can be stored as static HTML); immutable writes/readback; activate slug only after ready; retain last good; purge relevant caches; reconcile status; retry/repair.

Supabase and R2 lack a shared transaction. Model crash windows, interruption after pointer activation, stale/concurrent attempts, retry/idempotency, partial media, orphaned writes and recovery. A revision check before external write alone does not prevent an old publisher overwriting newer state. Specify a supported minimal serialization/precondition strategy; do not add event bus/Queue without evidence. Failed preparation preserves previous page. Cover rename/unpublish/deactivation/feature change, rollback, R2/Supabase outage, retention/GC and shared content-hash references. Do not delete source media during migration.

#### Caching and revocation

Recommend one bounded freshness budget: proposed up-to-60-second canonical /b visibility with purge as acceleration, subject to validation/business approval. It is a target, not existing behavior. Define layers, TTLs, browser vs edge, pointer vs HTML, negative cache, cache keys, query/alias variants, Set-Cookie, stale modes, purge permissions/limits and failure behavior. Avoid accidentally stacking two full TTLs. Cache API deletion is not assumed global across all colos. No stale extension beyond chosen bound. Do not cache authenticated responses, private media, QR resolution or VCF. Prevent cache poisoning.

Matrix: deactivation, unpublish, rename, feature removal, compromised QR/NFC, public media removal, rollback. For each say source change, purge, cache layers, realistic maximum/limitations, outage behavior, test and approval. Downloaded/browser copies cannot be recalled. Card revocation affects next dynamic token resolution, not already-open page or direct active profile. Removing a feature link does not revoke feature authorization. Public immutable media needs an approved retention/purge policy; content-hash deletion must respect sharing. Private gating is required if URL-level eligibility is strict.

#### Domain, security, environments

Intended domain is nextap.services per user and dated research. Verify deployed/configured evidence and flag nextapp.services conflicts. Hostinger stays registrar; Cloudflare becomes DNS authority only after nameserver update at Hostinger. No domain transfer needed. Plan apex/Admin/media routing without inventing IP/CNAME targets. Reserve feature subdomains only. Inventory/preserve MX/SPF/DKIM/DMARC/TXT/CAA, redirects, DNSSEC/DS sequence and TLS. Define staging hostnames/cookies, preflight, TTL, rollback; do not change DNS.

Source-backed security risks and phase controls: RLS/grants/RPC/publish authorization; Admin host-only cookie and callbacks/CSRF/origin; no shared parent-domain cookie by default; private vs public R2 paths; prove R2 read-only enforcement (a TS get-only interface is not a permission); contact eligibility; QR token privacy and existing process-local rate-limit limits; bounded bodies, URL/SSRF and HTML validation, CSP/CORS/cache poisoning, least privilege, safe logs. Use native controls only after verifying availability/plan limits. Do not substitute another Worker for authorization.

Separate Staging/Production Supabase projects, Admin/Public workers, buckets, secrets and bindings. Adapt src/lib/config/environment.mjs and CI guards; never bypass them because Vercel variables disappear. Unknown/wrong resources fail closed. No Staging production credentials. Keep Vercel Production live. Data-copy and code promotion differ. Production gets reviewed forward schema migrations, not Staging rows. Inspect automatic deployment triggers before integration.

#### Production-to-Staging data synchronization (plan only)

Production Supabase is stated Free; verify read-only if possible. Staging is intended as sanitized Production-shaped test data, direction strictly Production to Staging, but is not DR. Do not synchronize or overwrite.

Runbook covers source/destination identity, current Staging backup and Staging-only data, consistent snapshot/scope, schema/extensions/migrations/functions/triggers/indexes/grants/RLS, UUID/FK/sequences, publication/alias/cards, Auth strategy (prefer test users; do not copy credentials/passwords/sessions/MFA/tokens/live login links), sensitive data sanitization, disable email/SMS/payment/webhooks, QR/NFC isolation, Storage metadata plus actual bytes, privacy and origin rewrite, counts/FK/RPC/RLS negative tests/checksums/timestamps, failure/recovery, approvals. Do not print data.

Explain Staging is editable, sanitized, stale/overwritable and potentially shares account failure risks; verify Free backup, egress, storage, Auth, project/inactivity limits. Propose separate encrypted DB and object-byte backup, retention/access control and restore drill; RPO/RTO are owner decisions. Dump without tested restore is not proven recovery. No Production receives Staging data. List unavailable account evidence.

#### Independent features

Evaluate businesses.id UUID as stable identity after verifying lifecycle; slug is mutable and ID is not authorization. Future substantial apps own repo, UI/backend, operational data/migrations, Cloudflare deploy and release. Portfolio uses published feature metadata only, never feature DB/runtime. Start from existing activation data; no empty registry service. Static catalog may define IDs, URL templates and contract versions. Central business activation/config stays in existing source if present; otherwise propose minimum required schema. Activation/config validation and versioning publishes updated snapshot. Each app enforces tenant auth/entitlement; no cross-app tables, service-role sharing, or parent cookie. Physical DB per feature is deferred until justified.

Specify small versioned public contracts and a Menu example: create repo/data model, independently deploy, use stable business UUID, register descriptor, activate, publish preview/link, navigate, deactivate. Identify Core changes versus future metadata-only additions.

#### Costs and performance

Use dated official rates and formula estimates for 100/1,000/10,000 businesses x 1,000 monthly visits. Separate listed prices, calculations, unknown account use. Include page/media request counts, Worker executions/CPU even on Cache API hits, QR/VCF share, R2 Class A/B pointer/artifact/media GET/HEAD/writes/retries, bytes/version retention, CDN cache scenarios, publications, Admin, Supabase DB/storage/egress/Auth, logs, backups/options. Make assumptions explicit/sensitivity-based; never present invented asset counts or cache hit as measured. R2 is not automatically covered by Worker static asset allowance.

Assess Supabase Free with actual limits and available usage: DB, egress, storage, Auth, API/RPC, inactivity/projects, backup/recovery. Zero ordinary visitor DB reads does not zero Supabase consumption. Compare Vercel only with account/plan evidence; no unsupported savings claim.

Define cold/warm CDN/origin/browser, first/return visitor, device/viewport/CPU/network/region, cache flush, run count/date. At least five comparable lab runs per condition; report median/tails, not population p75 without enough real data. Measure HTML TTFB, CWV, compressed HTML/CSS/JS/fonts/images, critical request count, image discovery, errors, Worker CPU, R2 ops, Supabase requests and cache hits. Prove zero DB traffic by server/runtime instrumentation plus browser trace.

Proposed targets, requiring validation, not achieved: ordinary /b Supabase requests exactly zero on all paths; no request-time content render/image transform; field p75 when enough data LCP <=2.5s, INP <=200ms, CLS <=0.1; weak-mobile lab median LCP <=4s at 1.6 Mbps/150ms RTT/4x CPU; comparable warm p95 TTFB <=300ms, cold p95 <=700ms; first view compressed HTML <=35KiB, critical CSS <=20KiB, JS <=75KiB, fonts <=50KiB, total <=300KiB, <=12 critical requests. Explain exceptions with evidence, do not silently drop required content.

## 4. Phased migration specification

For every phase in migration-spec.md record: objective/status, authorization/stop gate, scope and non-goals, prerequisites/dependencies, exact files/modules, infrastructure/database changes, tasks, commands/tests, measurable acceptance evidence, risks/failure modes, rollback/data implications, downtime, unresolved evidence. Use actual paths. Phases below are specifications, not authorization.

0. Repository/architecture baseline (this assignment): approve Main/worktree, inspect flows/dependencies, document compatibility/AVIF/privacy, create five docs. No app/provider/data changes. Ready for review only when evidence is complete.
1. Modular codebase foundation (approval): behavior-preserving seams/import boundaries and separate entry points only as justified; reuse existing domains; regression tests; no Cloudflare runtime implementation. Typecheck, lint, unit, fresh Next build and relevant E2E. Roll back coherent change set.
2. Staging copy preparation (separate execution approval): read-only project/schema assessment, sanitization/Auth/storage/recovery runbook. No sync/overwrite; reviewed plan is acceptance, not a copied dataset.
3. Cloudflare Staging infrastructure (approval): isolated Admin/Public Workers, R2 Staging, bindings, secrets, hostnames/logs. Verify account/plan first; env guards reject Production; Vercel Production untouched.
4. Next/OpenNext/Admin compatibility (approval): pinned real Worker test of App Router/RSC/actions/handlers/middleware/Auth cookies/callback/refresh/logout, upload/error/export/redirect/source maps. Next build is insufficient. Image-dependent paths may await Phase 5.
5. Media correctness/processing (approval): forward AVIF registration fix and safe Staging re-register; JPEG/PNG/WebP/AVIF, animation/dimensions/orientation/crop/metadata/quality/privacy/contact photo. Select proven target processing. Preserve originals.
6. Public Worker/R2 delivery (approval): fixture artifacts, private lookup/simple slug status, HTML and public media, cache policy. Zero Supabase queries on cold/warm/miss/error ordinary path; no Admin/private imports/write credential; prove revocation bounds.
7. Publishing pipeline (approval): idempotent versioned snapshot/media/render/write/verify/activate/last-good/retry/reconcile. Test concurrency, crash windows, stale publish, failed write, partial media and rollback.
8. QR/NFC, VCF and dynamic routes (approval): preserve printed URL/token/query/redirect/serial/eligibility behavior; no-store, privacy, rate tests.
9. Full integration, security, performance and recovery (approval): journeys, RLS negative tests, environment/cache/privacy, weak-mobile benchmark, cost/quota and restore drill; record evidence.
10. Main integration (approval): fresh branch from then-approved Main; coherent changes, inspect conflicts/full diff/trigger impacts, deploy exact integrated SHA to isolated Staging and repeat gates. No blind merge/push.
11. Production readiness/cutover (explicit approval): production identity, backward-compatible schema, backup/asset checks, DNS/TLS/email, catch-up vs publication freeze, canary, monitoring, rollback. No cutover now.
12. Stabilization and Vercel retirement (approval): agreed observation period, errors/latency/quota/restore evidence, confirm no remaining Vercel dependency. Retirement/media cleanup separately approved; preserve rollback until accepted.

For later cutover, DNS rollback/caches are not instant. Keep Supabase backward-compatible in dual-host stage and plan publication catch-up. No Production action until Staging criteria pass and written approval names the exact action.

### Status

Status file tracks Phases 0-12 using only NOT STARTED, IN PROGRESS, BLOCKED, READY FOR REVIEW, COMPLETED, REQUIRES APPROVAL. Record dates, SHA, changed files, environment, exact commands/results/evidence, criteria met/unmet, risks, approvals/scope/approver/date, rollback readiness and next allowed action. Never call a phase complete because code/folders exist; no fabricated commits/tests. Include approval ledger for worktree, code refactor, packages, hosted setup, data overwrite, DB changes, Main integration, Production deploy, DNS, Vercel retirement.

## 5. Acceptance and validation

Define future measurable criteria: zero ordinary public Supabase requests; exactly two initial app deployments with proven route/import/permission separation; Public has no R2 write or privileged credential; safe immutable publish and last-good semantics; private-media and cross-business denial; bounded cache/revocation; tested Auth/domain split; QR/NFC/VCF preserved; measured performance/cost; Staging rejects Production resources; independently restorable DB+object backup; reproducible developer/agent test and deployment path; exact Main-based tested SHA and release approvals.

Foundation acceptance is documentation/evidence only. Verify all five files exist and are substantial/linked; consistency across phase/architecture; relative links/source paths; Mermaid if supported; UTF-8; git diff --check; full diff and final status against initial inventory; no app, lockfile, migration, env, provider/deployment/Production change. Do not run a full build/DB suite just to verify prose. Read scripts before optional baseline tests. Baseline scripts include npm.cmd run typecheck, npm.cmd run lint, npm.cmd test, npm.cmd run build; DB/concurrency/E2E seed scripts can mutate data and need isolation. Report every unrun check. Future Worker build/deployment proof is required; Next build alone is insufficient.

Give final acceptance table for performance, security, reliability, publishing, revocation, Staging isolation, Production recovery, and developer/agent experience. Targets are not measured results.

## 6. Final handoff

Report links to all five docs; branch, absolute worktree, exact approved source SHA and research provenance; Git state; created/copied/moved/modified files and directories (source moves expected none); actual vs proposed structure; dependency rules; concrete blockers (AVIF registration, Sharp/OpenNext, static renderer, current live RPC path to remove, R2 read-only enforcement); Staging sync/DR plan and confirmation no copy occurred; cache/revocation assumptions; unavailable account evidence; only decisions requiring owner input, with options/recommendation/deferral effect; exact commands/tests/results and skips; confirmation Production/provider resources were untouched; current phase status and next step is review, then separate Phase 1 approval.

Do not ask questions answerable from source/docs. Mark actual business approvals: acceptable deactivation freshness, public media retention/revocation, data-copy scope/sanitization/Staging overwrite, independent backup budget/RPO/RTO, image-processing choice if technical evidence cannot decide, and release/cutover. For each give alternatives, recommendation and cost of delay.

Final instruction: create a safe, evidence-backed foundation only. No migration execution, data sync, deployments, DNS changes, Production mutation, broad refactor or unapproved Phase 1.
