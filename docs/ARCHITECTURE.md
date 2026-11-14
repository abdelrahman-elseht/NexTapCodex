---
Status: current implementation map and active migration boundary
Owner: NexTap engineering
Supersedes: none
Path globs: ["src/**", "tests/**", "scripts/**", "workers/**", "infra/**"]
Topic tags: architecture, structure, runtime, imports, migration
---

# Repository Architecture

This document is the working architecture reference for agents. It describes the current compatibility application, the Cloudflare migration scaffolding that exists, and the boundary between implemented behavior and target phases. It is intentionally usable without opening the legacy architecture archive. The migration PRD owns target requirements; source, migrations, tests, and phase evidence establish what exists today.

## Current State

The current NexTap Core product is a Next.js App Router modular monolith using Supabase Auth, Postgres/RPC/RLS, and Storage, hosted through Vercel. It remains the compatibility and rollback baseline until each replacement phase passes its exit gate. Cloudflare is the active target, but the migration is incomplete: Phase 0 and Phase 1 remain open. Phase 0's P0.3 static Pages route proof is reviewed; this does not authorize public route implementation. Phase 1 D1 schema migrations `0001`, `0002`, and `0003` are applied to development and staging, and a Phase 1 foundation Worker/scripts exist. They do not constitute the full admin, publication, card, or media runtime. Phases 2-6 remain target work in the [migration PRD](specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md).

The [documentation index](README.md) points to current phase records. Phase status is owned by each phase's execution/closeout record, not this summary. Do not promote a local test, resource inventory, candidate schema, or route proof into a phase pass.

## Current Application Ownership

| Path | Responsibility and boundary |
| --- | --- |
| `src/app/` | Next.js routes, layouts, route handlers, loading/error states, and server actions. Keep route-specific UI in a nearby `_components/` directory. |
| `src/app/b/[slug]/` | Current public business profile route and profile-local components. It reads a published profile through the current Supabase-backed publication layer. |
| `src/app/c/[token]/` | Current permanent card-token resolution route. Preserve its distinct unavailable-card behavior and stable token URL. |
| `src/app/admin/` | Internal NexTap staff administration screens. The application does not provide business-owner self-service. |
| `src/app/api/admin/` | Same-origin administrative HTTP handlers, including draft and managed-media operations. Authorization remains server-side. |
| `src/components/ui/` | Reusable interface primitives. |
| `src/components/admin/` | Shared staff dashboard and inventory interface. |
| `src/components/business/` | Public business profile presentation, including contact, payment, social, and media UI. |
| `src/lib/business/` | Business/page rules, provider normalization, draft/editor helpers, and public publication reads. |
| `src/lib/cards/` | Permanent card URLs, QR generation, assignment rules, and manufacturing/export helpers. |
| `src/lib/admin/` | Logic shared by staff business and card administration. |
| `src/lib/auth/` | Current owner/staff authorization checks and capability mapping. |
| `src/lib/media/` | Image byte inspection, validation, preparation, optimization, and managed-media storage adapters. |
| `src/lib/supabase/` | Current Supabase clients/adapters. Treat these as compatibility dependencies until their replacement gates pass. |
| `src/lib/observability/` | Sentry sanitization and operation telemetry helpers. |
| `src/lib/config/` | Runtime/environment validation, including current Staging/Production project mapping. |
| `src/middleware.ts`, `src/instrumentation.ts` | Next.js middleware and runtime instrumentation; these files belong directly under `src/`. |
| `supabase/migrations/`, `supabase/tests/` | Authoritative current database evolution, RLS/RPC behavior, and SQL contract/security tests. |
| `tests/unit/`, `tests/e2e/` | Vitest unit/contract coverage and browser journeys. Mutation journeys require isolated fixtures and runtime guards. |
| `scripts/database/`, `scripts/media/`, `scripts/observability/` | Legacy-compatible database, media, and measurement utilities; inspect each script's required environment before running. |

The `@/*` alias maps to `src/*`. TypeScript uses strict checking. Keep server-only data and credentials out of client component imports. Do not introduce a package boundary until separate runtimes have a real shared contract and consumer.

## Cloudflare Migration Work That Exists

| Path | Existing responsibility | Current limit |
| --- | --- | --- |
| `workers/phase1-foundation/` | Phase 1 foundation Worker code for health/smoke and publication-snapshot support. | It is not the complete Core public, admin, card, or publication runtime. |
| `infra/cloudflare/d1/migrations/` | Candidate D1 schema migrations. `0001`-`0003` are applied to development and staging as recorded in the environment runbook. | Applied schema does not prove application behavior or complete schema approval. |
| `infra/cloudflare/phase1-*.toml`, `phase1-resource-matrix.json` | Non-secret Wrangler/runtime and environment inventories for Phase 1. | Inventory/configuration does not prove deployed bindings, credential isolation, or acceptance gates. |
| `infra/cloudflare/PHASE_1_*.md`, `infra/cloudflare/d1/` | Environment, authorization, operations, recovery, schema decision, and schema review records. | These are Phase 1 operational evidence/decisions, not a substitute for migration acceptance. |
| `scripts/cloudflare/` | Guarded D1 workflow, deployment/preflight, target validation, restore-integrity, operational checks, and scheduled-backup candidates. | Follow the specific runbook and target guards. No production execution is authorized by these files. |
| `infra/cloudflare/phase0-pages/` | Disposable Phase 0 Pages routing proof and synthetic Menu/media fixtures. | Evidence only; do not treat as the production target implementation. |

## Target Boundaries and Phase Map

The target and phase acceptance contract lives in the [Landing Delivery and Supabase Exit PRD](specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md). The phase summary below is a navigation aid; consult the linked phase record and dated evidence before work.

| Phase | Target responsibility | Current status and implementation boundary |
| --- | --- | --- |
| 0: Baseline and routing proof | Measure current journeys and prove warm static `/b/{slug}` delivery with Menu path coexistence. | Incomplete. P0.3 is reviewed; physical Android/card evidence and other open gates remain. No route-dependent implementation is authorized. See [Phase 0 plan](specs/NEXTAP_PHASE_0_EXECUTION_PLAN.md). |
| 1: Environments and data contract | Establish isolated Cloudflare resources, schema and authorization contracts, recovery, and operational controls. | Incomplete. D1 resources/schema and foundation tooling exist; recovery, identity, operations, schema approval, and other closeout gates remain. Route-independent work only within the approved scope. See [Phase 1 spec](specs/NEXTAP_PHASE_1_EXECUTION_SPEC.md) and [closeout](research/PHASE_1_CLOSEOUT_STATUS_20261114.md). |
| 2: D1 migration and internal admin replacement | Replace Supabase-backed data and staff administration after approved migration/identity design. | Target only; not implemented. |
| 3: Static publication and CDN media | Generate immutable public profiles and media while preserving the proven Worker-free warm profile path. | Target only; gated on Phase 0 completion and its approved route contract. |
| 4: Card and manufacturing parity | Replace card assignment, token resolution, QR/NFC manufacturing, and exports while retaining URLs and state behavior. | Target only; not implemented. |
| 5: Canary, cutover, and rollback | Validate production parity, staged traffic, rollback, and URL continuity. | Target only; no production cutover is authorized by the current Phase 0/1 work. |
| 6: Supabase decommission | Remove legacy runtime and credentials only after rollback and reconciliation criteria pass. | Target only; Supabase remains the compatibility baseline. |

Core and Menu remain separate products. Core owns the `has_menu` publication field. The current owner-approved target link is `/b/{slug}/menu`; Core must not query Menu services to render a profile. Phase 1 records the contract only; implementation belongs to a later approved phase.

Cloudflare target responsibilities are distinct: D1 is the durable mutable Core record store; R2 stores immutable publication output and media; KV is a bounded, non-authoritative fallback cache; static/CDN delivery serves warm profiles without Worker, D1, KV, Supabase, or NexTap application-origin work. The actual target runtime is incomplete. See [DATA_MODEL](DATA_MODEL.md), [TECH_STACK](TECH_STACK.md), and the PRD for detailed contracts.

## Common Change Paths

- Public profile (current): `src/app/b/[slug]/` → `src/lib/business/public-publication.ts` → `src/components/business/public-snapshot.tsx`.
- Staff draft save/publish (current): `src/app/api/admin/businesses/draft/route.ts` → `src/app/admin/businesses/draft-actions.ts` → business/Supabase domain adapters.
- Card inventory and manufacturing (current): `src/app/admin/cards/` → `src/lib/cards/` → current database adapters.
- Managed image upload (current): `src/app/api/admin/media/` → `src/lib/media/` → Supabase Storage.
- Identity/session (current): `src/app/auth/` → `src/lib/auth/`, `src/lib/supabase/`, and `src/middleware.ts`.
- Cloudflare foundation (migration): `scripts/cloudflare/` and `workers/phase1-foundation/` → environment bindings and D1/R2/KV recorded under `infra/cloudflare/`.

These paths describe ownership, not permission to implement a future-phase route or mutate a remote environment. Follow the active phase's gate and environment guard before making cross-boundary changes.

## Documentation Ownership

- `AGENTS.md`: repository-wide agent workflow, source precedence, memory refresh, archive rules, and documentation health-review triggers.
- `AGENT_MEMORY.md`: bounded continuation snapshot only; it never owns project history or architecture decisions.
- `CODEBOOK.md`: stable product vocabulary, entity relationships, URL semantics, and durable invariants.
- `docs/DATA_MODEL.md`: current and target records, persistence boundaries, integrity, and unresolved data decisions.
- `docs/TESTING.md`: commands, test selection, evidence rules, and phase-aligned checks.
- `docs/COMPONENTS.md` and `docs/functions-components/`: stable shared interface catalog.
- `docs/specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md`: broad target requirements and phase exits; approved phase decisions can supersede a stated clause and must be linked.
- `docs/README.md`: navigation to current owners and dated evidence; it does not duplicate their full content.
- `docs/legacy/`: supplemental historical implementation evidence. Agents should be able to use this architecture document without opening it for ordinary task routing.
- `docs/finished/`: completed task artifacts retained as historical evidence, not active instructions.

## Placement and Change Rules

- Keep route-specific UI in route `_components/`; shared UI belongs in `src/components/`; shared domain behavior belongs in the documented `src/lib/<domain>/` modules.
- Place Next.js middleware and instrumentation directly under `src/`.
- Add unit tests under `tests/unit/` and browser journeys under `tests/e2e/`; keep generated artifacts under ignored or designated artifact locations.
- Update this map when ownership, runtime boundaries, active phase state, or a source path changes. Update `docs/README.md` when an authoritative document is added, moved, superseded, or changes ownership.
- Run `npm run check:docs` after authoritative document and link changes. Phase status requires the phase's documented evidence and exit review; documentation edits do not pass gates.
