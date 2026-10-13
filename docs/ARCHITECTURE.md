# Repository architecture

NexTap is a Next.js App Router modular monolith. The source tree is organized by runtime role first, then by domain.

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
| `src/lib/config/` | Environment and startup configuration guards. |
| `supabase/migrations/` | Ordered database migrations. |
| `supabase/tests/` | SQL contract and security tests. |
| `tests/unit/` | Vitest tests for library modules and route handlers. |
| `tests/e2e/` | Browser journeys run by the e2e runner. |
| `scripts/database/` | Seed and database verification scripts. |
| `scripts/media/` | Media maintenance scripts. |
| `scripts/observability/` | Performance and observability lab scripts. |
| `docs/` | Product specs, handovers, implementation notes and research. |
| `assets/` | Source artwork and design references; runtime-served files belong in `public/`. |
| `artifacts/` | Generated screenshots and QA evidence. |

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
