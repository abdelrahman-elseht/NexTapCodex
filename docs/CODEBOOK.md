# NexTap Codebook

This file owns code placement, dependency direction, runtime/security boundaries, review budgets and safe change/removal practice. The [architecture map](ARCHITECTURE.md) describes current responsibilities; this codebook describes how changes enter and leave them.

## Placement and ownership

| Change | Owner path | Rule and check |
| --- | --- | --- |
| URL entry, layout, route handler, loading/error state or route-only UI | `src/app/` | Keep framework request/response behavior at the route. Put UI used by one route in its nearby underscore-prefixed `_components/`. Next build/typecheck and affected route tests own the boundary. |
| Reusable presentation | `src/components/` | Keep reusable UI free of database access and owner authorization. Public components receive public-safe data. ESLint/typecheck plus component/route tests verify use. |
| Shared business/card/auth/media rule or workflow | `src/lib/<domain>/` | Keep invariants with their domain and expose only what callers need. Domain tests own behavior. A framework adapter may live here when the code demonstrably coordinates a framework cache/request lifecycle; do not ban all framework imports from `src/lib/`. |
| Provider or persistence variation | Existing `src/lib/<domain>/` adapter; a distinct infrastructure module only when a second implementation or runtime boundary needs it | Add the smallest interface with an actual caller and focused tests. A proposed abstraction without variation, boundary or test seam needs a documented exception/review. |
| Database schema, grants, RLS, RPCs and SQL contracts | `supabase/migrations/`, `supabase/tests/` | Migrations are append-only after use; add a new migration and contract tests. Run the isolated database harness. No production data or hosted mutation in ordinary local checks. |
| Unit/route/domain behavior | `tests/unit/` | Group by behavior/module using the existing `*.test.ts` convention. Cover negative/security and recovery branches for consequential behavior. |
| User/browser journey | `tests/e2e/` | Name journeys by workflow; use isolated deterministic fixtures. Run affected journeys when routes or user-visible behavior change. |
| Maintenance and verification tooling | `scripts/` and package scripts | Prefer Node scripts for cross-platform deterministic checks. CI must invoke the script once and preserve non-mutating behavior. |
| Agent workflow and implementation record | `AGENTS.md`, `docs/program/phase-1-tasks/`, `docs/program/PHASE_1_CONTINUATION.md` | Keep always-loaded rules short. Task packets own step-by-step context; the continuation note records current progress, not a second specification. |

Use the `@/*` alias for `src/*` imports. Prefix non-route folders under the App Router with `_`. Keep Next.js middleware and instrumentation directly under `src/`. Runtime-served assets belong under `public/`; source artwork belongs under `assets/`.

## Dependency direction and runtime

- Route modules may compose domain rules, server actions, providers and UI. Domain code does not import a route or reusable presentation component.
- Reusable components do not import `src/app`, privileged Supabase server clients, secret-bearing configuration or owner authorization. Public renderers receive a publication snapshot rather than querying drafts.
- Browser/client modules do not import Node APIs, storage service credentials or server Supabase clients. Node-only handlers must declare their runtime where required and remain covered by build/route tests.
- Public database reads use the cookie-free anonymous client. Owner writes use the authenticated server client, explicit capability checks and database RLS/RPC contracts. A valid Auth identity alone is not internal-owner authorization.
- Keep current provider and database helpers in their domain unless evidence shows separate deploy/runtime ownership. Shared contracts belong in a small shared location only after multiple independent domains consume them.
- Import-boundary CI checks enforce the stable path/runtime rules. A documented exception names the importing and owning modules, reason, tests and review owner.

## Naming and contracts

- Use descriptive kebab-case filenames for multiword modules, camelCase for functions/variables, PascalCase for React components/types and UPPER_SNAKE_CASE only for true constants.
- Export the smallest public surface needed by a caller. Prefer explicit domain types and validated inputs at route/provider/database boundaries over casts that bypass checks.
- Keep persisted/public contracts stable: routes, card tokens/serial exports, RPC arguments/return values, publication snapshots and vCard fields need focused tests before changing.
- Comments explain a non-obvious invariant, constraint or compatibility reason. They should not restate a function name or nearby code.
- Add a glossary term only when it resolves repeated domain ambiguity; do not create a glossary or abstraction as ceremony.

## Test and mutation policy

- Unit tests prove domain behavior, route outcomes and important error/recovery paths. SQL tests prove grants, RLS and transactional invariants. Browser tests prove workflows that unit/SQL checks cannot exercise end to end.
- For authorization, publication visibility/revocation, URL/input validation, media privacy, card assignment/manufacturing and shared business invariants, select focused tests and a scoped mutation run when the change can alter a consequential branch.
- Mutation survivors remain classified as killed, survived, equivalent, timeout or no coverage. A score is not acceptance by itself; review surviving behavior against the contract.
- CI uses existing project scripts and disposable local database fixtures. Hosted Auth, Staging and Production are not targets for ordinary tests.
- `clean-code-guard`, `test-guard` and `docs-guard` are reactive review aids for applicable diffs. They provide judgment, not deterministic CI evidence.

## File budgets

Count physical lines consistently. These are initial review limits, not extraction targets:

| File kind | Maximum | Enforcement |
| --- | ---: | --- |
| Route, page, layout, route handler or server action | 250 | Baseline overages warn; changed overage requires extraction or a scoped exception. |
| Reusable UI component/module | 250 | Same; review state ownership, cohesion and accessibility before splitting. |
| Domain/workflow module | 300 | Same; keep invariants together when a split weakens the contract. |
| Unit, integration or browser test file | 500 | Review behavior grouping and setup reuse; do not split only for count. |
| Generated, migration, lock, snapshot, fixture, config and documentation file | Excluded | Use format-specific checks and review contracts. |

`npm run check:file-budgets` reports the base and changed-file findings. Legacy overages warn; a changed overage blocks unless `.file-budget-exceptions.json` names the exact file, owner, reason and expiry/review condition. Expired and unused exceptions are reported for review. The check must never modify files. If baseline evidence shows a limit harms cohesion, revise the limit in a reviewed codebook change before enforcement changes.

## Add, change, deprecate and remove

1. Identify the owning module and all callers, including framework entry points, dynamic imports, route discovery, tests, scripts and SQL dependencies.
2. State the contract and failure/recovery behavior that must remain stable. Add the narrowest test that would fail if the contract broke.
3. Add a module or dependency only for a concrete caller, provider/runtime difference or test seam. Check supported Node/Next versions and existing equivalent tools first.
4. For every dependency change, review exact resolved version and lockfile diff, license, security advisories and registry status. Query npm metadata (`npm view <package> deprecated time version license`) for deprecation; `npm outdated` only reports version drift. Record evidence in the change description.
5. Treat Knip and other unused-code output as candidates. Verify reachability, framework conventions, generated/dynamic references, ownership, public contracts and tests before removal.
6. Deprecate before removing a shared contract when another caller may exist. State replacement and removal condition in the owning docs/API.
7. Remove only after caller review, tests and rollback implications are understood. Do not delete migrations or production-relevant history; append a migration for schema evolution.

On a changed manifest, `npm run check:dependency-status -- --base <sha>` reports exact locked package version, license, engine range and registry deprecation; removed packages are named for caller review. A weekly report checks all direct dependencies, outdated versions, deprecations and the full npm audit summary. Registry failures are marked unverified, not green evidence. The PR review records any action; existing CI gates the runtime audit. Knip is report-only. CI never upgrades/removes a dependency, export, file or function.

## Exceptions and ownership

An exception is local, reviewable and temporary where possible. It identifies the exact path/rule, owner, reason, preserved invariant and expiry or revisit condition. Import exceptions belong beside the boundary rule; file-budget exceptions belong in `.file-budget-exceptions.json`; mutation survivors belong in the Stryker baseline report. CI reports stale exceptions for removal. No exception can authorize a hosted/Production operation outside a separately approved task.

## Enforcement map

| Concern | Deterministic authority | Review authority |
| --- | --- | --- |
| Types and code style | `npm run typecheck`, `npm run lint` | Changed-code review |
| Import/runtime boundaries | ESLint boundary rules and their positive/negative fixtures | Codebook exception review |
| File budgets | `npm run check:file-budgets` | Scoped exception review |
| Dependency/dead-code candidates | CI dependency status report and Knip report | Owner/caller/reachability review |
| Database behavior/security | `npm run test:db`, `npm run test:db:concurrency` | Migration and policy review |
| High-risk branch quality | Focused unit tests and scoped Stryker ratchet | Survivor classification |
| User workflow | Affected `npm run test:e2e` journeys | Browser evidence review |
| Continuation contract | `node scripts/continuity/continuation.mjs validate-contract` plus controlled-clock tests; actual session commands still enforce freshness | Host loading/trust remains separately unverified |
| Phase completion | CI plus root `GATES.md` evidence | Integrator checks every package and open owner decision |
