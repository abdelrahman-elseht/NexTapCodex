# Repository Guidelines

## Navigation

* For architecture, database, or cross-module changes, consult `docs/ARCHITECTURE.md` and only read the related file in it before implementation.
* Use `docs/README.md` to locate relevant specifications and handoffs only when needed.
* Inspect existing patterns before introducing new modules.

## Structure

* `@/*` maps to `src/*`.
* Keep route-specific UI in route `_components/`.
* Keep shared logic in the documented domain folders.
* Place Next.js middleware and instrumentation directly under `src/`.

## Changes & Verification

* Preserve existing functionality and avoid unrelated refactoring.
* For file moves, update imports, aliases, tests, CI paths, and documentation references.
* Run relevant tests based on the changes. For structural or configuration changes, run typecheck, lint, unit tests, and a fresh production build.
* Run browser/E2E tests when modifying user-facing workflows or routes.
* Use UTF-8-safe operations and literal paths for Next.js directories such as `[id]` and `[slug]`.
