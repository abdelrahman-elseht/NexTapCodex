# Repository Guidelines

## Navigation

* Cloudflare migration is the active architecture direction. For landing, data, media, auth, cards, or deployment changes, start with `docs/specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md`; implement the active migration phase and its exit gates. Do not extend Supabase or Vercel as the target architecture.
* Treat the current Next.js/Supabase/Vercel source as the compatibility and rollback baseline until its replacement phase passes. Consult `docs/ARCHITECTURE.md` only to locate current behavior that must be preserved or replaced.
* For NexTap domain terms such as page, publication, slug alias, and card token, consult `CODEBOOK.md`.
* For a database or cross-module change, read only the relevant current-vs-target sections of `docs/DATA_MODEL.md` and the active migration PRD; use `docs/legacy/README.md` and its architecture map only to locate legacy behavior. The migration PRD owns target contracts; current source, migrations, and tests establish legacy parity facts.
* For tests, hooks, or foundation changes, follow `docs/TESTING.md` and the relevant phase in `docs/specs/NEXTAP_ENGINEERING_FOUNDATION_PRD.md`. Keep migration acceptance authoritative over legacy-only coverage. Run `npm run check:docs` after authoritative documentation changes and `npm run check:stories` after story/E2E coverage changes.
* Before adding shared functions or UI, search `docs/COMPONENTS.md`, its categorized files under `docs/functions-components/`, and source imports/callers. Reuse a matching contract when its domain meaning, runtime, authorization, and side effects fit; update the catalog when a stable shared interface is added or changed. For genuinely new reusable behavior, research reputable, highly starred GitHub projects for design references, then inspect implementation, license, maintenance, and security before adapting anything to this repo's Codebook and architecture.
* For product and code changes, account for UX, agent experience (discoverability and verifiability for coding agents), and developer experience (clear ownership and maintainable interfaces). Prefer focused, testable modules that remain easy to extend as the migration progresses.
* Project hooks record edit paths in `PostToolUse` and run focused checks once at `Stop`; they do not run test suites. Ordinary source edits get changed-file lint; architecture checks require import changes or a new source module, and file-budget checks require a new source module. Terra is reserved for exact, allowlisted high-risk or cross-module changes and is advisory. Hooks never prove that a test ran; unavailable/skipped output is not passing evidence.
* Use `docs/README.md` to find authoritative target contracts, current-baseline references, and historical evidence. Historical handoffs are evidence for their dated task, not current architecture direction.
* When a task, implementation, prompt, or spec has completed its purpose or been superseded, move its record under the matching `docs/finished/` category, update inbound links and `docs/README.md`, and label any status that could be mistaken for current guidance. Keep `docs/legacy/` for references needed to understand existing legacy behavior, compatibility, or rollback; age alone is not a reason to move an active contract.
* Use `AGENT_MEMORY.md` as the active task continuation checkpoint, not durable project guidance or another `AGENTS.md`. At session start, read it and resume the listed unfinished task after checking current source and latest user instructions. If its task is finished, clear it or replace it with the next unfinished task; do not restart completed work. Before compaction, run `scripts/quality/task-checkpoint.mjs` with the exact latest continuation state: task/goal, current status, last completed step, next concrete action, blockers, and only paths/checks needed for that next action. The command replaces memory and prepares the matching local checkpoint. Do not list broad file inventories or instruct the agent to reread every changed document. After compaction, resume from that state and revalidate it. Keep at most 20 nonblank lines and 2 KB; never append history. The local ignored checkpoint may hold detailed paths, but does not replace updating memory.
* Run a scoped documentation health review at each migration phase closeout, after a substantial docs/source reorganization, or when 30 days pass without either trigger and a repo task is underway. Compare affected guidance with implementation, tests, phase gates, and dated evidence; flag redundant/conflicting files, archive only completed work, consolidate only where ownership/update cadence match, and update inbound links plus `docs/README.md`. Record review scope, discrepancies, archive/consolidation decisions, unresolved questions, and checks in the phase closeout or dated review note. Do not silently rewrite requirements or claim phase completion from plans/local tests.
* When package manifests or lockfiles change, use `npm run check:dependencies` and `docs/TESTING.md`; never auto-install packages from a hook and treat failed/offline audits as unverified.
* When you resolve a new reusable error or blocker, add one canonical record under `docs/known-issues/` and update the stable `docs/KNOWN_ISSUES.md` index if a category is added. Include symptom, verified cause (or explicit uncertainty), solution, and regression guard with links to owning docs/tests. If uncertain, record an open issue instead of guessing.
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
* Keep tests aligned with the active migration phase and its acceptance gates. As Cloudflare target behavior is implemented, add or adapt focused tests for its domain, Worker, D1/R2, and user-facing contracts; keep legacy tests where they verify compatibility or rollback behavior, and retire tests only when their behavior is no longer supported. Follow `docs/TESTING.md` and the migration PRD when choosing coverage.
* Use UTF-8-safe operations and literal paths for Next.js directories such as `[id]` and `[slug]`.
