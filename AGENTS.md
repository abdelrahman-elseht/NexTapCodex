# Repository Guidelines

## Migration intent and guardrails

- This branch prepares Nextapp's permanent move from Vercel to Cloudflare. Production stays on Vercel until a separately approved cutover.
- Target initially has two deployments: Admin on OpenNext/Workers at `admin.nextap.services`; static-first Public on Workers at `nextap.services`, including only necessary QR/NFC and VCF dynamic routes. Keep publishing in Admin; do not add a third Worker without a measured need.
- Supabase remains the Admin control plane and source of truth. Ordinary Portfolio visits must not query Supabase. R2 holds verified published artifacts and public media; it is object storage, not a database.
- Substantial future products (Menu, Booking, Store, Ordering) get independent repositories, data, backends, and Cloudflare releases. Core shares stable business IDs and versioned published contracts, not private data or operational logic.
- Approved Main is the schema and code authority. Staging must converge through reviewed forward migrations; never infer intended schema from live Production or Staging drift.
- Use the existing `migration-architecture` worktree and record the exact tested commit. Production is `jezpobjlfvihikplxrta` and Staging is `flkakuysakgwfoemgbwn`; verify project identity before any hosted operation. Keep their credentials, data, buckets, and deployments separate.
- Phase 2 current-Staging recovery is complete, but Production-to-Staging copy readiness is blocked. Retain the recovery artifacts and running restore target at `C:\Users\elseh\NexTapRecovery\phase2-staging-20261031` until owner review; deletion requires separate approval.
- Before architecture, database, or cross-module work, follow `docs/ARCHITECTURE.md` to the relevant document. For migration work, also check `docs/migration/migration-status.md` and the applicable phase in `docs/migration/migration-spec.md`; Phase 2 details are in `phase-2-staging-copy-preparation.md` and `phase-2-assessment-evidence.md`.
- Treat authorization as operation-specific. Inspection permission does not authorize export, writes, migration, deployment, DNS changes, credential rotation, cleanup, or Production access beyond the explicitly approved scope. Stop before destructive or uncertain actions and obtain specific approval.
- Work in reviewable phases, preserve existing behavior, and update the status ledger with evidence. Never mark a phase complete based on code or documentation alone; run and report the checks required by its acceptance criteria.
- for unfamiliar features donot write form scratch , first search github for open source projects mostly the mosre stars but authentic ones , compare approaches , then get started

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
*donot run in circles or redundant tests
* Preserve existing functionality and avoid unrelated refactoring.
* For file moves, update imports, aliases, tests, CI paths, and documentation references.
* Run relevant tests based on the changes. For structural or configuration changes, run typecheck, lint, unit tests, and a fresh production build.
* Run browser/E2E tests when modifying user-facing workflows or routes.
* Use UTF-8-safe operations and literal paths for Next.js directories such as `[id]` and `[slug]`.
