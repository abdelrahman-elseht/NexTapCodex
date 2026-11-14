---
Status: current implementation map; Cloudflare migration is the active target
Owner: NexTap engineering
Supersedes: none
Path globs: ["src/**", "tests/**", "scripts/**", "workers/**", "infra/**"]
Topic tags: architecture, structure, runtime, imports
---

# Repository architecture

NexTap is a Next.js App Router modular monolith. The source tree is organized by runtime role first, then by domain.

This map records the legacy implementation that exists today. The active target is the Cloudflare migration in the [landing delivery PRD](../specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md); its Worker, D1, R2, and KV runtime is not implemented yet. For migration changes, follow that PRD for destination behavior and use this map only to locate current behavior, parity obligations, and compatibility boundaries. Keep legacy code until its replacement passes the corresponding migration gate.

## Where code belongs

| Path | Responsibility |
| --- | --- |
| `src/app/` | URL routes, layouts, route handlers, loading and error states. Keep UI used by one route in a nearby `_components/` folder. |
| `src/components/ui/` | Small reusable interface primitives such as branding, submit controls and confirmation controls. |
| `src/components/admin/` | Reusable owner dashboard controls and inventory UI. |
| `src/components/business/` | Public business-page rendering and payment/social/media presentation. |
| `src/lib/business/` | Business content, provider rules, draft/editor helpers and public publication reads. |
| `src/lib/cards/` | Permanent card URLs, QR codes and manufacturing exports. |
| `src/lib/admin/` | Helpers shared by owner business and card administration, including pagination. |
| `src/lib/auth/` | Owner authorization and identity checks. |
| `src/lib/media/` | Image inspection, preparation, optimization and storage. |
| `src/lib/supabase/` | Supabase adapters for server, public and middleware clients. |
| `src/lib/observability/` | Sentry sanitization and operation telemetry. |
| `src/lib/config/` | Environment and startup configuration guards, including Staging/Production project mapping. |
| `infra/cloudflare/` | Cloudflare preparation notes and configuration boundaries; no deployed resource IDs or secrets. |
| `supabase/migrations/` | Ordered database migrations. |
| `supabase/tests/` | SQL contract and security tests. |
| `tests/unit/` | Vitest tests for library modules and route handlers. |
| `tests/e2e/` | Browser journeys run by the e2e runner. |
| `scripts/database/` | Seed and database verification scripts. |
| `scripts/media/` | Media maintenance scripts. |
| `scripts/observability/` | Performance and observability lab scripts. |
| `docs/` | Active product and migration contracts, code maps, reusable component guidance, and research. |
| `docs/legacy/` | Legacy implementation maps and compatibility references. |
| `docs/finished/` | Completed task artifacts and dated implementation evidence; not current instructions. |
| `assets/` | Source artwork and design references; runtime-served files belong in `public/`. |
| `artifacts/` | Generated screenshots and QA evidence. |

## Migration Structure

The current `src/lib/<domain>/` layout already separates profile, card, media, auth, and configuration responsibilities. Do not split it into speculative packages before a second runtime needs a shared contract.

- Keep the existing Next.js application at the repository root while it is the live Core implementation.
- Keep Cloudflare preparation and, later, non-secret deployment configuration under `infra/cloudflare/`. Resource IDs and secrets are environment-specific and do not belong in checked-in `.env` files.
- Create `workers/<runtime>/` only after Phase 0 proves what code must execute at the edge. A warm `/b/{slug}` hit is required to bypass Worker execution, so the folder must not imply that every profile request enters a Worker.
- Create `packages/<contract>/` only when separate runtimes need the same validated contract; keep business rules in application services and database constraints for integrity.
- Keep Menu in its separate repository. Core profile rendering consumes the published `has_menu` value and URL contract only.

The repository remains a single Next.js application until the migration phases extract and replace its responsibilities. Add Cloudflare runtime folders only when the corresponding phase has an implementation and test consumer. Do not let the legacy folder layout define the target runtime boundaries.

## Import and placement rules

- Use the `@/*` alias for imports from `src/`; it resolves to `src/*`.
- Keep route-specific modules in the route segment. Prefix non-route folders with `_` so Next.js does not treat them as route segments.
- Put reusable behavior behind a small domain interface in `src/lib/<domain>/` instead of duplicating it in route files.
- Keep browser-only modules in `src/components/` or a route `_components/` folder and keep server actions/route handlers in `src/app/`.
- Add new unit tests under `tests/unit/` and browser tests under `tests/e2e/`; do not mix generated evidence with source tests.
- Keep root-level files for repository configuration and discovery (`next.config.ts`, Sentry configs, test/build configs, `README.md`, `AGENTS.md`, and environment examples). Next.js middleware and instrumentation live directly in `src/` beside `src/app/`.

## Common change paths

- Public business rendering: `src/app/b/[slug]/` → `src/lib/business/public-publication.ts` → `src/components/business/public-snapshot.tsx`.
- Owner business editing: `src/app/admin/businesses/` and its `_components/` folder → `src/lib/business/`.
- Card inventory/manufacturing: `src/app/admin/cards/` → `src/lib/cards/`.
- Managed images: `src/app/api/admin/media/` → `src/lib/media/`.
- Auth/session: `src/app/auth/`, `src/lib/auth/`, `src/lib/supabase/`, and `src/middleware.ts`.

- Owner editor transport: `src/app/api/admin/businesses/draft/route.ts` receives the editor's same-origin JSON save/publish requests; `src/app/admin/businesses/draft-actions.ts` validates and persists them.
- Capability mapping: `src/lib/auth/owner.ts` enforces the internal admin role, while `src/lib/config/environment.mjs` owns the Staging/Production project mapping.
