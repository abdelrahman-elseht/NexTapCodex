# Task 1.4: Targeted Mutation Baseline

## Contract

Select high-risk modules after Task 1.1 and establish a narrow Stryker baseline against focused existing tests. Classify survivors and introduce a changed-module ratchet only after the baseline is understood.

## Read first

- Accepted architecture risk map and codebook.
- Focused source/tests for auth and authorization, publication visibility/cache, URL/input validation, media routing and business/card invariants.
- Existing `vitest.config.ts`, package scripts, lockfile and CI.
- StrykerJS guidance: https://stryker-mutator.io/docs/stryker-js/getting-started/

## Work

1. Select one or two modules where a mutation can change a consequential contract and where focused tests can execute quickly. Explain inclusions and exclusions.
2. Add pinned Stryker tooling/config only if the lockfile/runtime supports it; limit mutated files and test selection to the chosen boundary.
3. Run a baseline and record module, score, killed, survived, equivalent, timeout and no-coverage counts. Preserve the report in a compact generated artifact or summary that can be regenerated.
4. Review every survivor class. Add missing behavior assertions only when the contract warrants them; document equivalent/unreachable/tooling cases rather than inflating scores.
5. Add a changed-high-risk-module ratchet based on the measured baseline. Provide explicit reviewed survivor exceptions with file/mutant/reason and owner; avoid an unsupported global threshold.

## Selected baseline boundary

- Mutated source range: `src/lib/business/public-publication.ts:47-60` (live pointer resolution, immutable snapshot selection, compatibility fallback, unsupported-RPC memory and failure telemetry).
- Focused suite: `tests/unit/public-publication.test.ts`.
- Excluded range: slug/UUID constants and the Supabase snapshot decoder at lines 10-22; framework cache wrappers at lines 25-34; rate limiting and process-local cache eviction, TTL and in-flight admission outside the selected pointer path. These have separate unit/security contracts and are not included in this narrow changed-module score.
- Reproducible command: `npm run test:mutation:publication`; config: `stryker.config.mjs`.
- Runner setting: run the full focused suite per mutant and restart the Vitest worker for each mutant.
- Baseline: 18 mutants; 17 killed, 1 equivalent survivor, 0 harmful survivors, 0 timeout, 0 no coverage, 0 errors; mutation score 94.44%. The exception is mutant `id=10`, `ConditionalExpression`, `public-publication.ts:51`, replacement `true`: `pointerError` starts as `null`, so assigning `pointerResult.error` (`null`) in the no-error case has no observable effect. Owner: Phase 1 integrator. The error path is tested in `reports pointer error when compatibility fallback also fails`.
- Ratchet: `thresholds.break = 94` in `stryker.config.mjs`. This is limited to the selected source range, not a project-wide score. Negative control: temporarily set `break` to `95` and run `npm run test:mutation:publication`; it exited 1 with `Final mutation score 94.44 under breaking threshold 95` as expected, then the accepted value was restored to `94`.

## Guardrails

- Mutation tests supplement behavior tests; score alone does not prove correctness.
- Do not refactor application code until the baseline and survivor decisions are reviewed.
- Avoid a global Stryker run if it expands cost without improving evidence for selected risks.
- Do not count a timeout or no-coverage mutant as killed.

## Acceptance

- Baseline is reproducible with a documented command and pinned configuration.
- All required mutant categories and exclusions are visible.
- Survivor decisions are linked to contracts and tests.
- Changed-module gate has a negative control and does not impose a blanket project score.

## Gate

G4 in root `GATES.md`. Complete this gate before Task 1.5 selects a refactor.
