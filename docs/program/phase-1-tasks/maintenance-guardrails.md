# Task 1.3: Maintenance Baselines and Guardrails

## Contract

Add only justified deterministic checks for import boundaries, changed-file line budgets, dependency deprecation/status review and Knip candidate reporting. Reuse existing CI and self-review behavior where present. Baseline legacy findings as warnings and gate only introduced/changed violations, with reviewed exceptions. No automatic deletion.

## Read first

- Accepted `docs/CODEBOOK.md` and `docs/ARCHITECTURE.md`.
- `package.json`, `package-lock.json`, `eslint.config.mjs`, `tsconfig.json`, `.github/workflows/ci.yml`, `.github/pull_request_template.md`, `scripts/ci/self-review.mjs`, and all workflow files.
- Relevant current tools: https://github.com/javierbrea/eslint-plugin-boundaries, https://knip.dev/reference/configuration, https://docs.npmjs.com/cli/v11/commands/npm-view

## Work

1. Record existing Node/npm lockfile state, scripts, CI invocations and current import patterns. Do not rely on dated workflow handoffs; verify actual workflow wiring.
2. Choose the smallest stable boundary rules consistent with imports currently in use. Add positive and negative fixtures or focused tests proving the rule catches a violation and permits a valid route/domain import.
3. Implement a portable per-kind line counter over physical lines. Compare against base to distinguish legacy from added/modified files. Enforce codebook budgets only on changed files; support an explicit, reviewable exception with owner, reason and scope.
4. Report dependency changes with lockfile integrity, license/security and registry deprecation/status evidence. `npm outdated` is not a deprecation oracle. Never auto-upgrade or remove dependencies.
5. Configure Knip as a report-only candidate finder with accurate entries/framework configuration. Do not turn findings into automatic removals.
6. Wire checks into existing CI or package scripts once each, without duplicating the self-review checklist. Keep reports understandable and deterministic.

## Guardrails

- No broad package refresh, deletion or unused-code cleanup is in scope.
- Existing violations warn and are recorded; new/changed violations fail unless a precise documented exception applies.
- Avoid a network-dependent CI check unless cache, version pinning, failure behavior and offline alternative are explicit.
- Don't treat old self-review documentation as evidence that `scripts/ci/self-review.mjs` currently runs in CI.

## Acceptance

- Baseline output names findings, scope and legacy treatment.
- Positive/negative checks prove import and budget gating, including exception behavior.
- Dependency and Knip checks report candidates without mutating manifests or source.
- CI runs each deterministic guard once; no duplicate checklist or automatic cleanup exists.
- Required focused tests and source/docs staged whitespace pass; report the full staged raw-log whitespace result separately.

## Gate

G3 in root `GATES.md`. Record commands, fixture behavior, baseline counts and CI evidence.
