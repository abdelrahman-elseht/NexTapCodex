# Phase 1 Implementation Handoff

Status: Phase 1 implementation and exit are verified for the existing `phase1/codebase-foundation` candidate. This handoff is retained as the original execution plan; Phase 1 does not need restarting. The candidate remains uncommitted and unintegrated; a Phase 1-only review diff is staged but uncommitted in a separate worktree. Phase 2 implementation has not started. See the [reconciliation review](PHASE_1_RECONCILIATION_REVIEW.md) and [closeout evidence](../../reports/phase1-closeout/README.md).

## Dispatch Shape

Phase 1 is broad enough to split into six ordered work packages. Keep one implementation agent responsible for integration, use a review checkpoint between packages, and keep each package's diff reviewable. Do not parallelize edits across the same repository files.

| Package | Deliverable | Depends on | Review gate |
| --- | --- | --- | --- |
| A. Responsibility map | Verify current route, domain, provider, database/security, runtime and test boundaries. Update `docs/ARCHITECTURE.md` with evidence and migration-relevant risks. | None | Reviewer accepts the source-linked map and selected risk candidates before structure or code changes. |
| B. Codebook | Create `docs/CODEBOOK.md`; update `docs/ARCHITECTURE.md` and `AGENTS.md` with concise links and non-duplicated rules. | A | Reviewer accepts module ownership, import/runtime boundaries, naming, test, file-budget, dependency, deprecation and safe-add/remove rules. |
| C. Maintenance checks | Add or configure only justified checks for import boundaries, changed-file line budgets, dependency deprecation/status review and Knip candidate reporting. Wire deterministic checks into existing CI without duplicating the self-review checklist. | B | Baseline is recorded; legacy issues warn, new/changed violations gate; no automatic deletion or unrelated dependency cleanup. |
| D. Mutation baseline | Select high-risk modules from A, configure focused Stryker runs, classify survivors and add a changed-module ratchet based on evidence. | B; coordinate with C if scripts/CI overlap | Baseline and survivor decisions are reviewed before the refactor uses them as a gate. |
| E. Behavior-preserving refactor | Refactor one or two migration-relevant slices selected from A, with clear responsibility boundaries and preserved behavior. | A, B, C and D accepted | Small diff passes the required regression checks and focused mutation gate. |
| F. Agent continuity | Add a compact durable continuation packet and platform-neutral checks, with thin Codex/Claude adapters only where current event contracts support the behavior. | B and C | Demonstrate save/restore behavior for manual and automatic compaction/resume, document platform differences and verify exact hook events. |

Packages A and B are primarily discovery and documentation; C, D and F add tooling; E changes application code. Package F can be implemented after C and alongside the completed refactor only if file ownership is independent. The integrator must run the full phase checks after all packages land.

## Copyable Agent Prompt

```text
You are implementing NexTap Phase 1: Codebase Foundation. Work only after the owner/orchestrator explicitly dispatches this handoff.

Read these task-specific sources first:
- docs/program/PHASE_1_IMPLEMENTATION_HANDOFF.md
- docs/program/PHASE_1_CODEBASE_FOUNDATION.md
- docs/program/NEXTAP_MIGRATION_PROGRAM_PRD.md
- docs/ARCHITECTURE.md
- docs/product/PRODUCT.md
- AGENTS.md
- GLOSSARY.md

Those files are planning references. Re-check each implementation claim against the target worktree's current source, tests, package scripts, CI and configuration. Historical documents and proposed limits are not proof of current behavior.

Git/worktree rules:
- Inspect status, branch, recent history and worktrees before acting. Preserve all existing user changes and untracked files.
- Use a new, clean implementation worktree based on the latest approved main. Do not implement in the original dirty checkout, the migration trial worktree, or the planning-document worktree. The planning references above may be read-only inputs.
- Do not switch, reset, clean, stash, overwrite, commit or push. Report the exact base SHA and worktree path.
- If main moved or the correct approved base is unclear, stop before edits and report the evidence.

Owner-approved direction:
- Codebase foundation precedes Cloudflare Staging. Keep the refactor robust but bounded to migration-relevant responsibilities; no broad rewrite.
- Supabase remains responsible for core records, Auth, RLS and owner writes. Measure existing public-read behavior; do not assume zero Supabase reads or design a replacement projection without evidence and an owner decision.
- R2 is for later isolated Staging validation with synthetic fixtures and new Staging uploads. Production data/object copying is out of scope.
- Use targeted Stryker baselines and ratchet changed high-risk modules, with reviewed survivor exceptions. Use per-kind file budgets, warn on legacy overages, and require a documented exception for changed-file overages.
- Keep repository rules and CI platform-neutral. Use Codex and Claude Code adapters only where current documented hook behavior supports them. The owner identified amElnagdy/guard-skills: use clean-code-guard, test-guard and docs-guard as reactive review guidance where applicable. They are not CI checks or lifecycle hooks; do not install WordPress/WooCommerce guards.
- Production remains on its current host. This phase includes no deployment or provider changes.

Execute the six packages in the handoff table in order. At each review gate, report changed paths, evidence, checks, unresolved points and the next package. Do not proceed past a failed gate or silently widen scope. Select the refactor only after the responsibility map and mutation baseline show a concrete high-risk boundary. Line count is a review signal, never a reason by itself to split or delete code.

Continuity requirements:
- Keep one concise, secret-free continuation packet containing objective, owner decisions/constraints, worktree/base SHA, reviewed files, changed files, checks, unknowns and exact next action. Link source documents instead of copying them.
- For Codex, test PreCompact persistence and SessionStart(source=compact) restoration, including automatic mid-turn compaction. Plain PreCompact stdout is not injected as verbatim model context.
- For Claude Code, test the installed documented lifecycle. PostCompact can expose its generated summary, but do not claim that hook output enters the next request unless a documented injection path is demonstrated. Record unsupported or unverified behavior plainly.
- Never write credentials, secrets, customer content or Production data to the continuation packet or logs.

Scope boundaries:
- No Cloudflare/OpenNext/vinext/R2 implementation, deployment, DNS, hosting, secrets, Supabase project mutation, database schema/migration changes, Production data access/copy, cutover, Vercel retirement or hosted environment changes.
- Do not delete dependencies, files or functions merely because a scanner flags them. Verify reachability, ownership and compatibility first; report unresolved candidates.
- Do not change unrelated product behavior. If evidence shows the bounded refactor needs a behavior change or schema change, stop and ask the orchestrator to re-scope.

Verification:
- Inspect package.json and CI first; use existing scripts where possible and avoid redundant tests.
- Run the Phase 1 packet's relevant lint, typecheck, unit, database contract, concurrency, build, affected browser and focused mutation checks. Read scripts before running them and ensure any database tests target isolated local fixtures only.
- A successful Next build is not evidence of Cloudflare Worker compatibility.
- Check all changed documentation claims against source, resolve local links, and run git diff --check. Review production code, tests and documentation with the applicable guard skills when available.

At completion, report: base SHA and worktree; package-by-package status; changed paths; architecture/codebook decision summary; mutation baseline with survivor categories and ratchet; line/import/dependency/Knip findings and exceptions; hook save/restore evidence and platform limits; commands run with results; browser evidence; remaining risks; and the next owner decision. Do not claim the phase passed if any required gate is missing.
```

## Orchestrator Checkpoints

Dispatch Package A first. Review its source-linked map and risk candidates, then dispatch B. Once B is accepted, dispatch C and D as separate changes so guardrail configuration and mutation results remain independently reviewable. Dispatch E only after the chosen mutation scope is understood. Dispatch F after B and C, then run phase-wide verification against the combined result. Keep any failed or unverified item visible; do not mark Phase 1 complete until every exit criterion in the [Phase 1 task packet](PHASE_1_CODEBASE_FOUNDATION.md) has evidence.

## Source of Truth

The [program PRD](NEXTAP_MIGRATION_PROGRAM_PRD.md) owns program decisions and later-phase gates. The [Phase 1 task packet](PHASE_1_CODEBASE_FOUNDATION.md) owns Phase 1 requirements and acceptance checks. This handoff owns only the dispatch sequence and implementation-agent prompt. Update one of those sources rather than copying evolving requirements into multiple places.
