# Phase 1 Task Index

Implementation base: `230adeca680c0fe7e22b3ece0fd9169764b84ffe` (`main`).
Implementation candidate: branch `phase1/codebase-foundation` based on the SHA above. See the reconciliation review for its integration disposition.

The authoritative scope is carried in this repository:

- `../PHASE_1_IMPLEMENTATION_HANDOFF.md` defines sequence and dispatch boundaries.
- `../PHASE_1_CODEBASE_FOUNDATION.md` defines requirements and acceptance.
- `../NEXTAP_MIGRATION_PROGRAM_PRD.md` defines owner decisions and phase boundaries.
- `../RESEARCH_APPENDIX.md` records prior research, including framework and hook contract findings.

Re-check implementation claims against the current worktree. The planning files are not proof that source behavior or external hook contracts remain unchanged.

## Ordered tasks

| Task | File | Depends on | Main deliverable |
| --- | --- | --- | --- |
| 1.1 | [responsibility-map.md](responsibility-map.md) | None | Evidence-backed architecture and risk map |
| 1.2 | [codebook.md](codebook.md) | 1.1 | `docs/CODEBOOK.md` and concise repository pointers |
| 1.3 | [maintenance-guardrails.md](maintenance-guardrails.md) | 1.2 | Non-destructive CI reports and changed-scope gates |
| 1.4 | [mutation-baseline.md](mutation-baseline.md) | 1.1, 1.2 | Focused Stryker baseline and ratchet |
| 1.5 | [bounded-refactor.md](bounded-refactor.md) | 1.1-1.4 | One or two migration-relevant behavior-preserving refactors |
| 1.6 | [agent-continuity.md](agent-continuity.md) | 1.2, 1.3 | Continuation packet, supported hooks, review guidance |

Review each task's acceptance evidence before starting the next dependent task. The implementation owner integrates the result and re-runs [GATES.md](../../../GATES.md) at the end.

## Shared constraints

- Supabase remains the authority for core records, Auth, RLS and owner writes. Measure current public reads; do not assume zero reads or invent a projection.
- This phase changes no hosted resources, credentials, schemas, Production data, DNS, hosting, runtime adapter or deployment.
- Keep unrelated local worktree changes untouched. This candidate is based on the main SHA above.
- Do not split, remove or rewrite code just to satisfy line counts or scanner output. Review cohesion, callers, contracts and tests first.
- Keep continuation content secret-free and limited to decisions, current worktree/base, reviewed/changed files, checks, unknowns and next action.
- Use `clean-code-guard`, `test-guard` and `docs-guard` as reactive review guidance for relevant diffs. These skills do not replace executable checks.

## Final handoff

Update the continuation packet and task status with actual evidence. Report the base SHA, changed paths, gate state, commands and outcomes, mutation survivor categories, browser evidence, hook event limitations and any unresolved owner decisions. A missing gate remains open.
