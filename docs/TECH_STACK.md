---
Status: current stack reference; Cloudflare migration is the active target
Owner: NexTap engineering
Supersedes: none
Path globs: ["package.json", "package-lock.json", "next.config.ts", "src/**", "tests/**", "scripts/**", ".github/workflows/**", "e2e*.config.ts", "vitest.config.ts", "infra/cloudflare/**", "workers/**"]
Topic tags: stack, runtime, dependencies, deployment, testing, migration
---

# NexTap Technical Stack

This document records the checked-in stack and its runtime boundaries. It does not describe planned Cloudflare services as current. Update this guide when the framework, runtime, package manager, test runner, deployment model, or major service boundary changes.

## Current Runtime

| Area | Verified repository state | Evidence |
| --- | --- | --- |
| Application | Next.js `15.5.28`, App Router, React `19.1.1`, TypeScript `5.9.2` | `package.json`, `src/app/`, `next.config.ts` |
| Server runtime | Node.js; repository policy permits `^22.23.5 || >=24.8.0`; local `.nvmrc` and CI pin Node `22.23.5` | `.nvmrc`, `package.json`, `.github/workflows/ci.yml` |
| Package manager | npm with committed lockfile v3. No `packageManager` field pins an npm release. CI uses `npm ci`. | `package.json`, `package-lock.json`, workflows |
| Current backend/data services | Supabase Auth, Postgres/RPC/RLS, and Storage are used by the current Core app. | `src/lib/supabase/`, `supabase/migrations/`, `docs/ARCHITECTURE.md` |
| Current hosting | The landing migration PRD records Vercel as the current application host. This repository contains no `vercel.json` or checked-in Vercel project/runtime settings. | [Landing migration PRD](specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md), checked-in configuration inventory |
| Error monitoring | Sentry Next.js integration is in build/runtime configuration. Source-map upload requires `SENTRY_AUTH_TOKEN`; uploaded maps are configured for removal from deploy artifacts. | `next.config.ts`, `src/instrumentation.ts`, `package.json` |
| Public media | Current managed-media paths and optimization are implemented in the Next.js/Supabase app; the image remote pattern is derived from `NEXT_PUBLIC_SUPABASE_URL`. | `next.config.ts`, `src/lib/media/`, `src/app/api/admin/media/` |

Do not infer the deployed Node patch, Vercel framework preset, build command, output settings, environment variables, domains, or deployment protection from repository files. Confirm those in the Vercel project before changing deployment assumptions. The `22.23.5` workflow pin controls GitHub Actions only; `.nvmrc` controls compatible local version managers only.

## Source and Module Boundaries

The application is a modular monolith organized by route/runtime and domain. The detailed ownership map lives in [Repository Architecture](ARCHITECTURE.md); this section summarizes stack-level boundaries:

- Next.js routes, layouts, and route handlers live under `src/app/`.
- Route-private UI lives in route `_components/`; shared UI lives under `src/components/`.
- Domain behavior lives in `src/lib/<domain>/`. Current Supabase adapters live in `src/lib/supabase/`.
- Next.js middleware and instrumentation are directly under `src/` (`src/middleware.ts` and `src/instrumentation.ts`).
- `@/*` aliases to `src/*`; TypeScript uses strict mode, bundler module resolution, and the Next.js plugin.
- SQL migrations/contracts live in `supabase/migrations/` and `supabase/tests/`.
- Worker and shared-package folders do not currently implement the product runtime. Architecture only permits introducing them when the migration phase establishes real consumers.
- Menu & Ordering remains a separate application/repository; Core renders the published Menu link contract and does not own Menu data or runtime calls.

## Build and Quality Tooling

| Concern | Current tool/command | Notes |
| --- | --- | --- |
| Development/build | `npm run dev`, `npm run build`, `npm start` | Standard Next.js dev, production build, and production server scripts. CI runs the build. |
| Lint/types | ESLint 9 with `eslint-config-next`; `npm run lint`, `npm run typecheck` | Existing lint rules include some warning/off overrides; see `eslint.config.mjs`. |
| Unit tests | Vitest 4; `npm test` | `vitest.config.ts` owns test discovery and setup. |
| Legacy database diagnostics | `npm run test:db`, `npm run test:db:concurrency` | Opt-in rollback diagnostics only; they are not default CI or Cloudflare migration gates. Target data behavior belongs in D1/application boundary tests as those services are implemented. |
| Repository quality checks | `npm run check:docs`, `npm run check:stories`, `npm run check:architecture`, `npm run check:file-budget` | Validate document registrations, E2E story metadata, import boundaries, and source file budgets; all run in CI. |
| Browser E2E | `e2e@0.18.0`, `@e2e-dev/web@0.13.0`, `playwright-core@1.63.0`; `npm run test:e2e` | The runner uses Chromium via its web engine. It requires Node `^22.22.3 || >=24.8.0`; repository Node 22.23.5 satisfies that minimum. Browser binaries are provisioned with `npx e2e-web install chromium --with-deps` in CI. |
| E2E model agent | Optional AI SDK model configured in E2E config for tests that use `agent.*` | Deterministic tests using `screen`, `browser`, and `expect` do not need a model. This runner's provider/model configuration and authentication are separate from the Codex Terra review subprocess. `gpt-6.1-terra` at low effort is requested but provider/model/effort support is not verified. Do not silently substitute another model. |
| Security/dependency CI | `npm run check:dependencies -- --require-audit`; `npm audit --omit=dev --audit-level=high` | CI checks dependency changes and runs a required full-tree audit plus a production-only high-severity gate. Dependency changes require the policy in [Testing Guide](TESTING.md), including lock consistency and review of new packages. |

Use [Testing Guide](TESTING.md) for adaptive test selection and current workflow details. Use its story tags to select only relevant customer, admin, manufacturing, and migration journeys; do not treat the full E2E suite as a default check for every edit.

## Environment and Secret Handling

- Local environment examples are templates only. Secret files are ignored; never add credential values to this document, test source, logs, traces, screenshots, or tracked configuration.
- The local E2E config loads `.env.local` when present and validates its Supabase environment before runner test discovery. Even `e2e list` needs valid test-only Supabase environment values if `.env.local` is absent.
- The former hosted legacy E2E workflow has been removed. Target acceptance uses isolated Cloudflare environments and the migration PRD's phase gates.
- Public build-time variables such as `NEXT_PUBLIC_*` are not secrets and may be embedded in browser output. Private keys, auth tokens, and bypass secrets must remain server/workflow-only.
- Do not use Production credentials or data to list/run tests, seed E2E fixtures, or validate mutation paths.

## Dependency Policy

The lockfile is the reproducible dependency source. Keep `package.json` and `package-lock.json` synchronized, review direct and transitive changes, and use `npm ci` for clean CI/reproducibility checks. Never auto-install or auto-upgrade packages from an agent hook. A manifest/lock change should produce a report of added, removed, and version-changed packages, lifecycle scripts, audit status, and provenance/license/maintenance evidence. An audit timeout or registry outage means “not verified,” not “clean.” Automated vulnerability scanning does not prove package provenance or safety.

Node pins, engine ranges, and E2E package engine requirements must be reviewed together. The installed E2E packages require at least Node `22.22.3` within Node 22 or Node `24.8.0`; the project currently uses the newer Node 22.23.5 patch. Recheck the official package engine metadata whenever E2E dependencies are upgraded.

## Active Cloudflare Migration Target

The active target is specified in the [Landing Delivery and Supabase Exit PRD](specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md). The direction is active; the target runtime is **not implemented**. It separates static/CDN public profile delivery from the administrative runtime, replaces Supabase across Core after migration gates, and uses Cloudflare services according to the PRD’s routing proof and phase gates. The target logical model is documented in [DATA_MODEL.md](DATA_MODEL.md).

Cloudflare development/staging resources and D1 migrations `0001`-`0003` are recorded in the [Phase 1 environment runbook](../infra/cloudflare/PHASE_1_ENVIRONMENTS.md), and a limited foundation Worker and guarded scripts exist in the repository. These do not implement the complete Core runtime or pass Phase 1. No production route, public delivery, admin replacement, or cutover is established. Describe resource provisioning, applied schema, code presence, and accepted runtime behavior as separate evidence states; do not call a target component active without deployment and behavior evidence.

## Change Rules

- Update this document in the same change when the framework/runtime, package manager, major backend/media service, hosting model, test runner, or build/deploy boundary changes.
- Record exact checked-in versions as dependency declarations, not as guarantees of the externally deployed version.
- Link platform settings to verified configuration or dated evidence. Label uninspected provider settings as unknown.
- Update [Repository Architecture](ARCHITECTURE.md) for code ownership/folder changes and [Testing Guide](TESTING.md) for command/test routing changes; avoid duplicating their full maps here.
- Register new authoritative stack documents with path globs and topic tags so reviews can discover them from changed paths.
- Record newly solved reusable setup failures in the [Known Issues](KNOWN_ISSUES.md) index and its matching file under [known-issues/](known-issues/), including symptom, cause, fix, and regression guard. Mark uncertain causes as unconfirmed.

## Evidence

- [Repository Architecture](ARCHITECTURE.md)
- [Testing Guide](TESTING.md)
- [Shared Components and Services](COMPONENTS.md)
- [Current and target data model](DATA_MODEL.md)
- [Landing Delivery and Supabase Exit PRD](specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md)
- [`package.json`](../package.json) and [`package-lock.json`](../package-lock.json)
- [`next.config.ts`](../next.config.ts), [`vitest.config.ts`](../vitest.config.ts), and E2E configuration files at repository root
- [CI workflow](../.github/workflows/ci.yml)
