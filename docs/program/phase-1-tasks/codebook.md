# Task 1.2: Codebook and Structure Rules

## Contract

Create `docs/CODEBOOK.md` as the single detailed source for module ownership, import/runtime boundaries, naming, contracts, tests, migrations, dependencies, file budgets, deprecation and safe addition/removal. Make concise, non-duplicative links from `docs/ARCHITECTURE.md` and `AGENTS.md`.

## Read first

- Accepted Task 1.1 output in `docs/ARCHITECTURE.md`.
- `AGENTS.md`, `docs/README.md`, `GLOSSARY.md`, `package.json`, `tsconfig.json`, `eslint.config.mjs`, and CI.
- Current examples in `src/app/`, `src/components/`, `src/lib/`, `supabase/`, `tests/`, and `scripts/`.
- Next.js project structure guidance: https://nextjs.org/docs/app/getting-started/project-structure

## Work

1. Define placement by current runtime-first/domain-owned structure: route-owned UI and handlers in `src/app`, reusable presentation in `src/components`, domain/workflow rules in `src/lib/<domain>`, explicit provider adapters only where variation exists, migrations/contracts in `supabase`, and tests beside their existing suite conventions.
2. State server/browser and public/owner boundaries, alias/private-folder conventions, allowed dependency direction and where shared contracts belong only when multiple consumers justify them.
3. Define test expectations by risk and contract, including auth/privacy negatives, database contracts, behavior tests and targeted mutation for high-risk modules.
4. Confirm proposed per-kind budgets against Task 1.1 cohesion evidence. Exclude generated/config/migration/lock/docs files from generic counting. Legacy overages warn; changed overages require a scoped extraction or documented exception.
5. Define add/remove/deprecate flow: inspect callers and reachability, verify tests/exports and lockfile/license/security/status evidence, record owner and impact, then remove only after review.
6. For every rule name its enforcing CI check, test, review owner or explicit exception path. Do not add architecture layers without a caller, runtime boundary, test seam or provider variation.

## Guardrails

- Keep `AGENTS.md` short and point to the codebook; avoid duplicating detailed rules.
- A line budget is a review signal, not an instruction to split cohesive code.
- Keep platform-neutral rules authoritative; agent-specific adapters remain thin.

## Acceptance

- `docs/CODEBOOK.md` covers all contract areas with concrete ownership and enforcement.
- `AGENTS.md` and architecture link to it without duplicating its content.
- No rule claims a check exists until its implementation and CI wiring are verified.
- Enumerated relative targets resolve; anchors and external URLs are not verified. Source/docs staged whitespace passes; report full staged raw-log whitespace findings separately.

## Gate

G2 in root `GATES.md`. Record accepted budgets, boundaries and exception policy before Tasks 1.3 and 1.4.
