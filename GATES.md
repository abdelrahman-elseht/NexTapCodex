# Phase 1 Acceptance Gates

Base: `230adeca680c0fe7e22b3ece0fd9169764b84ffe`
Candidate: `phase1/codebase-foundation` at the base above.
Integration review worktree: `F:/projects/NexTap-contacts-phase1-integration-review`

## G1 Responsibility map is source-verified

- [x] G1: `docs/ARCHITECTURE.md` maps each migration-relevant flow to its route, domain owner, persistence/security boundary, and tests or explicit gaps.
  Evidence: verify links and named symbols against source at this worktree; include public publication pointer/snapshot and compatibility fallback.
  Result: verified draft save/publish, public publication, card resolution/contact export, owner auth and media flows against current routes, modules, unit/browser tests and SQL contracts. Confirmed publication pointer/snapshot eligibility, aliases, current-snapshot check and the legacy fallback. The source/docs staged whitespace check passes; the full staged check reports trailing whitespace in retained raw CLI logs.

## G2 Codebook and repository rules are actionable

- [x] G2: `docs/CODEBOOK.md` owns placement, runtime/import, test, dependency, file-budget, deprecation and safe-removal rules; `AGENTS.md` points to it without copying it.
  Evidence: every rule identifies an enforcement mechanism or review owner.
  Result: codebook checked against current directory structure and import graph; `AGENTS.md` and `docs/README.md` link to it. Initial budgets and exception schema are implemented in Task 1.3. Dependency removal requires caller/lock/security/license review and Knip is report-only.

## G3 Maintenance checks preserve legacy and require review

- [x] G3: CI reports import boundaries, per-kind changed-file budgets, dependency status and Knip candidates without deleting code or packages.
  Evidence: positive and negative fixtures prove only newly changed violations gate; existing findings warn; documented budget exceptions work.
  Result: ESLint boundaries fail forbidden imports and pass allowed ones; focused tests cover both directions. Budget checks warn on the unchanged 307-line legacy card route, while new/changed overages fail unless an exact unexpired owner/reason exception applies; stale/unused exceptions are reported. Dependency changes query exact locked versions for license, Node engines and deprecation; a weekly workflow reports outdated packages, full audit summary and Knip candidates. The dependency status tool and Knip exit successfully; no flagged code or dependency was removed.

## G4 Mutation baseline and ratchet are evidence-based

- [x] G4: the public publication pointer-to-fallback range has a recorded Stryker baseline with survivor classification and a changed-range ratchet.
  Result: `npm run test:mutation:publication` runs 18 mutants over `src/lib/business/public-publication.ts:47-60` with `tests/unit/public-publication.test.ts`: 17 killed, 1 equivalent survivor, 0 harmful survivors, 0 timeout, 0 no coverage and 0 errors (94.44%). Mutant `id=10` at line 51 assigns the already-null `pointerError` only when the pointer error is null, which has no observable effect; this is the only scoped exception. `thresholds.break=94` passes. Negative control temporarily set the threshold to 95 and the same run exited 1 at 94.44%, then restored 94. `git diff --check` remains part of G7.

## G5 Refactor preserves the selected contract

- [x] G5: one or two map-selected slices have clearer responsibility boundaries with behavior preserved.
  Evidence: focused regression, SQL contract where applicable, mutation run, browser journeys where affected, and a fresh production build.
  Result: `/admin/cards` now retains owner authorization, messages and UI while `src/lib/admin/card-inventory.ts` owns normalized query handling and inventory loading. Unit and SQL/concurrency regression checks pass; the focused 31-mutant parser ratchet is 100%; and a fresh production build passes. Earlier direct desktop/mobile journey assertions have no retained reports and are not independently verified here. The identified local synthetic desktop owner-card report is the retained browser evidence. Follow-up resolved the broader journey's draft-endpoint 403: Next.js reconstructed localhost while the browser used 127.0.0.1; local origin validation now uses the actual Host and hosted origin validation remains fixed. The full desktop `owner-card-journey.e2e.ts` passes (1/1) on a disposable local project. No hosted project was configured or mutated.

## G6 Continuity adapters follow supported hook contracts

- [x] G6: a secret-free continuation packet plus platform-neutral checks and thin Codex/Claude adapters save and restore supported state.
  Evidence: documented event payload shapes are exercised in the local harness, including automatic compaction/resume; unsupported Claude context injection is documented; selected guard skills are used as review guidance.
  Result: packet validation passes; local contract tests exercise manual/automatic `PreCompact`, compact `SessionStart`, ordinary startup suppression, secret/malformed/stale/missing packets and both adapter output shapes. Official contracts and a read-only comparison with established public hook repositories are summarized in `docs/research/PHASE_1_HOOK_CONTRACTS.md`. Codex/Claude host loading, trust and installed versions remain unverified. The selected guard reviews are recorded in Task 1.6.

## G7 Integrated phase checks pass

- [x] G7: phase changes pass required local checks and documentation/diff review without touching hosted resources or Production data.
  Evidence: lint, typecheck, unit, SQL/migration, concurrency, build, affected browser and focused mutation commands, plus `git diff --check`.
  Result: lint passes with 13 existing warnings; typecheck passes; 44 unit files/290 tests pass after the integration durability repair; all 31 SQL migrations and contracts pass; disposable real-PostgreSQL concurrency/rollback checks pass; fresh production build passes; publication mutation is 17/18 (94.44%) with one equivalent survivor and a 94% ratchet; card inventory mutation is 31/31 (100%) with a 100% ratchet; budget, dependency-status, Knip, continuity and runtime high-severity audit checks pass. Runtime audit still reports five moderate Sentry dependency findings. Only the identified local synthetic desktop owner-card journey is independently retained, as qualified under G5. No hosted resources or Production data were used. The source/docs staged whitespace check passes; the full staged check reports retained raw-log trailing whitespace.

## Integration repair qualification

The original candidate results above are historical. Current dependency, controlled-clock continuity, mutation and regression outputs are in [integration repair evidence](reports/phase1-integration-repair/README.md). CI validates the committed packet contract without session freshness; actual session validation/save/restore still reject expiry. Relative-link checks cover enumerated relative targets only, not anchors or external URLs. Hook loading/trust remains unverified.
