# NexTap Migration Program

Status: Phase 1 exit is verified for the existing `phase1/codebase-foundation` candidate based on approved main. The candidate remains uncommitted and unintegrated; its Phase 1-only integration review diff is staged but uncommitted in a separate worktree. Phase 2 implementation has not started. See the [Phase 1 reconciliation review](PHASE_1_RECONCILIATION_REVIEW.md) and [closeout evidence](../../reports/phase1-closeout/README.md).

Evidence labels: **Source verified** means checked in clean base 230adec; **Historical** means a dated handoff or earlier plan; **Owner decision** means direction given by the owner; **External** means current vendor or project documentation; **Assumption** is a working proposal; **Unresolved** needs evidence or a later decision.

## Problem

**Source verified:** NexTap is a Next.js App Router modular monolith with Supabase-backed business/page data, owner Auth and RLS, publication reads, media storage, and SQL migrations. Its current CI runs lint, typecheck, unit and SQL/concurrency tests, a Next.js production build, and public browser smoke tests. The repository has no Cloudflare Worker/R2 deployment adapter, runtime validation, mutation-testing setup, import-boundary enforcement, unused-code scan, or agent lifecycle hooks in this base. It does contain a PR self-review template and evaluator script; a dated handoff says a workflow runs them, but that workflow is absent from the clean base, so current automation is unresolved.

**Historical:** The migration plans describe different phase sequences and record hosted Staging evidence from October 2026. Those reports are not current proof of provider configuration or Cloudflare compatibility. The program therefore needs a bounded refactor, a representative Staging environment, and observable pass/fail gates before any Production move.

## Intended Outcomes

| Outcome | Acceptance evidence |
| --- | --- |
| Staging supports meaningful owner and public workflow testing without Production records. | Inventory migrations/schema, database functions/RPCs, triggers, RLS, Auth configuration/flows, Storage buckets/policies, scheduled work, webhooks and integrations; apply the supported schema to an isolated Staging project; exercise synthetic fixtures and workflows; retain a fixture manifest proving the data source. **No Production dataset or object copy.** |
| The codebase is easier to navigate and change without a broad rewrite. | Responsibilities and import/runtime boundaries are documented; changed modules fit agreed per-kind size budgets or have a reviewed exception; high-risk behavior has regression and targeted mutation evidence; unused/deprecated dependency findings are reviewed rather than deleted automatically. |
| A real Cloudflare Staging deployment proves runtime and media behavior. | A pinned Worker adapter build and deployed/preview Worker pass route, Auth, security, media, performance, logging, rollback and resource-isolation checks. Staging domains, identities, secrets, Supabase project and R2 resources are isolated from Production. Email uses a controlled sink/test mailbox; other external effects are sandboxed or disabled. A Next.js build alone does not pass this gate. |
| Production stays on its current host until Staging evidence passes and the owner separately approves the exact cutover. | A written Staging evidence record passes the agreed gate; Production change, DNS change and Vercel retirement each remain separately approved actions. **Owner decision.** |

## Users and Critical Workflows

**Source verified:** Internal owners sign in, edit businesses and ordered page sections, upload and preview media, save drafts, publish, manage branches and cards, and export manufacturing assets or CSV. Public visitors open Arabic RTL or English LTR pages from an NFC/QR destination, use contact/location/review/payment-information links, and may download a VCF contact. NexTap does not process customer payments.

**Source verified:** The public business route is dynamic. `getPublicPublication` currently resolves a live publication pointer through Supabase, reads an immutable snapshot keyed by publication ID, has a five-second fallback cache for older database schemas, and keeps a five-second process-local slug lookup. The SQL pointer and snapshot functions both check that the business/page is active and the snapshot remains current. This is a candidate read contract to measure and preserve; it does not show that Cloudflare serves these reads today. See [the resolver](../../src/lib/business/public-publication.ts), [the route](../../src/app/b/[slug]/page.tsx), and [the SQL contract](../../supabase/migrations/20261010122933_phase6_publication_cache.sql).

Phase 2 parity must cover the workflows present in the current product and the failure paths that protect data:

- Owner password sign-in, callback/session handling, authorization, sign-out, draft edit/save, media upload, preview, publish, section ordering, branch/card management, and relevant exports.
- Public published page rendering, activation/unpublish/slug behavior, card QR/NFC resolution, media delivery, contact/VCF path, and external action links.
- Denied owner-only, draft, private-media, cross-business, inactive-page, and malformed-input cases.

The exact hosted Auth email flow and provider settings remain unverified. The owner wants Staging sign-in exercised using a dedicated test identity stored in environment secrets and a controlled mailbox or email sink. Credentials must not appear in chat, PRDs, fixtures, or logs.

The Phase 2 evidence packet must show that the complete committed migration chain and database contract tests run against an isolated Staging-compatible database; required Auth callbacks and authorization work with a dedicated test identity; Storage policies permit intended synthetic public media and deny draft/private access; and every scheduled job, webhook, email, SMS, payment and outbound callback is either routed to a sandbox/sink or disabled. Current source search found no application-owned mail/SMS sender, payment processor, webhook consumer or scheduled job, but hosted provider settings remain unverified. Staging evidence must include all named owner/public journeys passing, negative security cases denied, and a comparable request/performance baseline. The Supabase public-read reduction target and latency/quota thresholds are set after measurement and owner review; zero Supabase reads is not an approved assumption.

## Owner Direction and Boundaries

- **Owner decision:** Work in a clean, separate worktree based on approved main. Do not continue the earlier migration trial as the planning base. The existing dirty checkout and migration-architecture worktree remain untouched.
- **Owner decision:** Codebase foundation comes before Cloudflare Staging. Use a bounded, migration-relevant refactor, not an open-ended rewrite.
- **Owner decision:** Try OpenNext first. Cloudflare currently recommends vinext for new Workers deployments and documents OpenNext as a path for maintaining existing OpenNext apps. Resolve this through a bounded compatibility check; compare vinext if OpenNext evidence fails or leaves a material gap. Do not force either adapter by preference alone.
- **Owner decision:** Keep Supabase for core business/page/section/card records, Auth, RLS, and owner writes. Evaluate Cloudflare/R2 for media delivery and evaluate whether a Worker cache or public read projection can reduce Supabase work. Measure the existing live-pointer/snapshot request path first; preserve its active-page, publish, unpublish, alias, and revocation behavior or get an explicit replacement decision. Freshness bounds, measured workload reduction, and any zero-query target remain unresolved; zero Supabase reads is not assumed.
- **Owner decision:** Exercise R2 in Staging with synthetic fixtures and new Staging uploads. This is not permission to move Production objects or cut over Production.
- **Owner decision:** Baseline Stryker against high-risk modules, then ratchet changed modules with reviewed survivors. Use per-kind file budgets, warn on legacy overages, require a documented exception for changed-file overages, and review import-boundary, deprecated-dependency, and Knip findings without auto-deleting candidates.
- **Owner decision:** Keep agent rules and CI checks platform-neutral; provide Codex and Claude Code adapters where supported. Preserve a concise durable continuation packet for session/compaction recovery. Do not claim hook output can be injected verbatim into compacted model context.
- **Owner decision:** The owner identified [amElnagdy/guard-skills](https://github.com/amElnagdy/guard-skills). Use its relevant `clean-code-guard`, `test-guard`, and `docs-guard` as reactive review guidance where applicable; the WordPress and WooCommerce guards do not fit NexTap. These skills do not replace repository linting, CI, file-budget checks, dependency scans, or mutation tests, and NexTap's accepted codebook takes precedence where a general skill rule conflicts.

### Non-goals

- Copying, exporting, restoring, or sanitizing a Production dataset or Production object store into Staging.
- Using real customer records to establish parity. Use generated or owner-approved synthetic fixtures; fixture content must not be derived from Production exports.
- Changing application code, migrations, schemas, Staging/Production resources, DNS, hosting, secrets, or data in this documentation assignment.
- Replacing Supabase wholesale, introducing additional Cloudflare products without a measured need, or rewriting the application.
- Production deployment, DNS cutover, Vercel retirement, and Production media backfill before the relevant later approval gates.

## Program Roadmap

These are the canonical program phase names. They replace the conflicting number systems in the historical plans; old phase numbers are not carried forward.

| Phase | Outcome and entry | Exit gate |
| --- | --- | --- |
| **Phase 1: Codebase Foundation** | Selected by the owner. Starts after this packet is reviewed and implementation is separately authorized. Map responsibilities, define codebook and boundaries, establish targeted mutation and maintenance baselines, make a small behavior-preserving refactor, and define session recovery guardrails. | Architecture/codebook review accepted; current high-risk baseline is recorded; changed-scope mutation survivors are triaged; changed-file budgets and import rules pass or have explicit exceptions; existing lint/typecheck/unit/DB/build checks and affected journeys pass. |
| **Phase 2: Cloudflare Staging Validation** | Begins only after Phase 1 exit. Provision isolated Staging resources under a separate approved execution task; prove Worker compatibility, Supabase/Auth isolation, synthetic functional parity, R2 uploads/reads, safe outbound behavior, security, performance, observability and rollback. OpenNext gets the first bounded test; compare vinext when evidence requires. | Evidence packet demonstrates all required workflows and negative security tests on a real Worker; no Production data or resources were used; costs/quotas, freshness and rollback are within owner-approved bounds; remaining exceptions are accepted explicitly. |
| **Phase 3: Production Transition and Closeout** | Requires Phase 2 to pass and a new written owner approval naming the Production deployment, DNS action, timing and rollback authority. Keep the present host available throughout the accepted rollback window. | Cutover meets separately approved monitoring thresholds and recovery evidence. Vercel retirement and any source-media cleanup require their own later approval after stabilization. |

**Current status:** Phase 1 exit is verified for the existing `phase1/codebase-foundation` candidate at base `230adeca680c0fe7e22b3ece0fd9169764b84ffe`, with retained final checks, mutation negative control and a passing local synthetic owner-card journey. See the [reconciliation review and integration diff](PHASE_1_RECONCILIATION_REVIEW.md) for evidence, integration decisions and remaining nonblocking limitations. The candidate remains uncommitted and unintegrated; the separate Phase 1-only review diff is staged but uncommitted. Phase 2 implementation has not started; Cloudflare/Worker/Staging readiness remains unverified. No Production cutover is approved.

## Phase 1 Gates and Work Boundary

The detailed deliverables, dependencies, acceptance evidence and checks are in [Phase 1: Codebase Foundation](PHASE_1_CODEBASE_FOUNDATION.md). This PRD and task packet authorize documentation planning only. Application changes, dependency additions, hosted resources and deployment need a separate execution authorization.

## Codebook and Documentation Strategy

Keep one source of truth per concern:

- Update docs/ARCHITECTURE.md with the actual responsibility map, runtime/import boundaries, and gradual refactor path.
- Update AGENTS.md with concise repository-wide workflow rules and links; it should not duplicate detailed architecture or tool configuration.
- Create docs/CODEBOOK.md only in Phase 1. It will define module ownership, routes/UI/domain/infrastructure/migrations/tests/contracts placement, naming, runtime boundaries, test and mutation expectations, deprecation/removal practice, file budgets, and how to add/remove code.
- Keep docs/program/NEXTAP_MIGRATION_PROGRAM_PRD.md as the concise program charter, docs/program/PHASE_1_CODEBASE_FOUNDATION.md as the only detailed ready-phase packet, and docs/program/RESEARCH_APPENDIX.md as research and reconciliation evidence.
- Keep platform-neutral commands/checks authoritative in package scripts and CI. Add Codex/Claude hooks as thin adapters; avoid a second rulebook in agent-specific files.
- Maintain a small task continuation packet during active agent work. It records objective, decisions/constraints, worktree and base SHA, reviewed sources, changed files, checks, unresolved items and next action. It is not a transcript or a replacement for source files.
- Add an ADR for public read projection/cache and revocation only when Phase 2 design has enough evidence to decide; do not create competing architecture proposals now.

## Risks and Unresolved Evidence

| Risk or unknown | Resolution gate |
| --- | --- |
| Hosted Staging Auth/SMTP, Storage policies, migration state, outbound integrations and secrets are not established by source code. | Phase 2 inventory and isolated provider verification. |
| OpenNext may not support one or more used Next.js, Node, image, middleware, Auth or export paths; current Cloudflare guidance favors beta vinext for new deployments. | Pinned runtime compatibility matrix, actual Worker build and route tests; bounded adapter comparison if needed. |
| Reducing Supabase reads can change freshness, unpublish/deactivation behavior, privacy and load. The current path has an uncached live pointer lookup plus cached immutable snapshots and a short fallback. | Record present request and quota baseline; agree freshness/revocation and any Worker read projection before implementation. |
| Supabase and R2 do not share a transaction; publish retries, partial uploads, stale writes and rollback can expose inconsistent content. | Phase 2 publish design and failure-injection evidence before public R2 use. |
| Mutation survivors can be equivalent, unreachable or indicate weak assertions; raw score is not a quality result. | Review each survivor class and ratchet only scoped modules after baseline. |
| Historical handoffs record a working Vercel/Supabase Staging path as of October 2026, but provider state can change. | Recheck provider dashboards/configuration during the authorized Staging phase. |

## Evidence Sources

**Source verified:** clean base 230adec; docs/ARCHITECTURE.md, docs/product/PRODUCT.md, package.json, .github/workflows/ci.yml, current source under src/app, src/lib, supabase/migrations and tests. The repository evidence is current as of the reviewed base, not proof of deployed state.

**Historical/read-only inputs:** the original dirty checkout contained additional untracked research and planning documents, including docs/research/AGENT_CONTEXT_AND_PHASE_PLANNING.md, docs/research/PUBLIC_PROFILE_MEDIA_AND_PERFORMANCE.md, docs/specs/NEXTAP_MIGRATION_FOUNDATION_AGENT_PROMPT.md, and docs/specs/CLOUDFLARE_R2_MIGRATION_SPEC.md. These were reviewed read-only and intentionally were not copied into the clean main-based worktree. Their classifications, plan comparison, and external sources are recorded in [Research Appendix](RESEARCH_APPENDIX.md). Dated handoffs linked from docs/README.md remain historical unless revalidated.

**Next action:** review the evidenced Phase 1 candidate and follow the reconciliation report's integration steps in a separate task that preserves the dirty original checkout. Keep Phase 2 implementation and all provider or Production actions under their own approved scope.
