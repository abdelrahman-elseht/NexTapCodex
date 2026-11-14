---
Status: current guidance; story tagging and deterministic coverage checks are active
Owner: NexTap engineering
Supersedes: none
Path globs: ["src/**", "tests/**", "supabase/**", "scripts/**", ".github/workflows/**", "package.json", "package-lock.json", "e2e*.config.ts"]
Topic tags: [testing, e2e, database, security, dependencies, migration]
---

# Testing Guide

This guide directs implementation and default CI toward product behavior and the Cloudflare migration contract in `docs/specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md`. Supabase/PostgreSQL internals, Vercel-hosted runs, and legacy-route performance are not default migration gates. Keep their local scripts only for an explicitly requested rollback investigation. Add Cloudflare tests in the same phase that introduces each target runtime boundary.

## Current Commands

| Command | What it checks | When to use |
| --- | --- | --- |
| `npm run lint` | ESLint across the repository | Changed JS/TS, imports, UI, tests, or structural/config changes |
| `npm run typecheck` | TypeScript project | Shared types, routes, components, config, and before release |
| `npm test` | Vitest unit and route-contract tests | Domain behavior, validation, route handlers, and focused regressions |
| `npm run check:docs` | Required documentation metadata, index registrations, and local index links | Authoritative docs or documentation index changes; required CI gate |
| `npm run check:stories` | E2E test tags, story references, and story coverage metadata | E2E/story catalog changes; required CI gate |
| `npm run select:stories -- --paths <file...>` | Routes changed paths through `docs/STORY_ROUTING.json`, rejects unmapped paths, and prints matching story/test selectors | Before running focused E2E for a change; use `--from <git-ref>` for a committed diff |
| `npm run check:architecture` | Documented import-direction and client/server boundaries | Module moves, cross-domain imports, or client/server boundary changes; required CI gate |
| `npm run check:file-budget` | Handwritten TS/TSX line budgets with an explicit grandfathered baseline | New or substantially changed source modules; required CI gate |
| `npm run check:performance` | Measures the legacy production build at `/` and `/demo` under cold-cache Slow 3G and 4× CPU | Explicit legacy diagnostics only; target gates cover static `/b/{slug}`, CDN behavior, and migration fixtures |
| `npm run check:performance-report -- <report.json>` | Rechecks a saved legacy performance report against its deterministic budgets | Explicitly reviewing an existing baseline report |
| `npm run check:dependencies -- --require-audit` | Dependency diff policy and required full-tree audit | Required CI gate; run `npm run check:dependencies` locally for package changes |
| `npm run test:db` | Legacy migrations and SQL/RLS contracts against disposable PostgreSQL | Explicit rollback diagnostics only; not an active CI or migration gate |
| `npm run test:db:concurrency` | Legacy PostgreSQL contention, idempotency, and rollback behavior | Explicit rollback diagnostics only; target behavior belongs in D1/application contract tests when implemented |
| `npm run build` | Current compatibility application's production build | Compatibility build while the current app remains in use; add Worker builds with the target runtime |
| `npm run test:e2e -- <files/options>` | Local compatibility browser journeys from `e2e.config.ts` | Select important product journeys while the Next.js baseline remains; add target journeys as Cloudflare phases land |
| `npm audit --omit=dev --audit-level=high` | High/critical production dependency advisories | Current CI gate; rerun for production dependency changes |
| `git diff --exit-code -- package.json package-lock.json` | Detects unexpected manifest/lockfile mutation in CI | Current CI manifest verification |

CI (`.github/workflows/ci.yml`) runs docs/story/architecture/budget/dependency checks, lint, typecheck, unit tests, the compatibility build, and selected local public journeys. Supabase SQL/PostgreSQL internals, Vercel-hosted E2E, and legacy-route performance are excluded from default CI. Cloudflare phase acceptance uses isolated target fixtures and the migration PRD's functional gates; do not recreate a platform-hosted legacy workflow for target acceptance.

The legacy performance script measures `/` and `/demo`, without business-profile or Cloudflare fixtures; it is an explicit diagnostic, not a default gate. Target performance tests should cover warm static `/b/{slug}` delivery, media/CDN cache behavior, Worker invocation counts, and field measurements against the migration PRD when those runtimes are introduced. A Next.js measurement cannot establish Cloudflare performance.

## Change Routing

| Change surface | Focused checks | Broaden when |
| --- | --- | --- |
| Pure domain helper, schema, or content rule | Owning `tests/unit/` test, then `npm run typecheck` when types cross modules | It changes public/editor contracts or persisted values: add caller and publication tests |
| Next.js route or route-local UI | Route test and relevant E2E story | URL, auth, responsive, media, QR/NFC, or public behavior changes: run affected browser journeys on desktop/mobile as relevant |
| Shared UI or domain module | Owning unit tests and component/story E2E tags | Shared behavior affects multiple routes: run all mapped consumers |
| Auth, ownership, or tenant authorization | Auth/owner unit and route tests plus anonymous/non-owner E2E | Any permission boundary changes: include deny-path and cross-business access cases on local and Staging where supported |
| Cloudflare D1 data contract | D1 schema and application-service contract tests for the affected user outcome | Transaction, idempotency, retry, authorization, or rollback changes: add isolated D1/application integration cases |
| Media upload, optimization, or delivery | Media unit/route tests plus the upload/rendering E2E stories | Public formats, image derivatives, cache headers, AVIF/WebP, or weak-network behavior changes: add representative browser/device measurements |
| Package/dependency manifests, Node, build, or workflow | Lock consistency, dependency audit, lint, typecheck, unit tests, `npm run build` | E2E runner/browser or runtime changes: list and run a safe focused E2E selection; run CI-equivalent checks |
| E2E config, fixtures, coverage map, or test runner | E2E selection/coverage checker tests and `npx e2e list` for intended selectors | Model/provider, cache, fixture isolation, or report handling changes: verify safe and mutation suites separately |
| Cloudflare Worker/D1/KV/R2 code | `npm run select:stories -- --paths <paths...> --track cloudflare-target`; Worker contracts, D1/application contracts, R2 artifact/media tests, and targeted Cloudflare-local E2E as implemented | Warm CDN path, slug/card URLs, purge, rollback, publication, or Menu route changes: run mapped `MIG-*` stories and the migration PRD phase exit in isolated Cloudflare Staging |
| Documentation-only/read-only work | `npm run check:docs`; `npm run check:stories` when story evidence changes | A requirement or ownership claim changes: reconcile spec, Architecture, Codebook, tests, and current implementation |

Use the lowest row that covers the behavior, then add the checks implied by its broader contract. A test passing locally does not replace required CI or an isolated Cloudflare phase gate.

## Story-Based E2E

`docs/specs/USER_ADMIN_STORIES.md` is the behavioral catalog. Keep each stable story ID and its actor, acceptance outcome, product stage (`current`, `active-migration`, `planned`, `blocked`, or `retired`), risk, required environment/fixture, edge cases, and E2E evidence together. A planned or blocked story is visible coverage debt; a skipped test is not a pass.

Tag E2E tests with the story IDs and selection dimensions they prove:

- `story:PUB-02`
- `domain:public`
- `risk:critical` (or `risk:high`, `risk:normal`)
- `env:local` or `env:staging`
- `mutation:read` or `mutation:write`

Tests may carry multiple story tags. Tags organize selection; they do not provide authorization or data isolation. A mutation test must still verify its environment identity, synthetic fixture, explicit mutation opt-in, and deny production/shared targets in code/config.

The E2E runner supports file selection, `--tag`, `--tag-mode all`, `--exclude-tag`, `--grep`, `--target`, `--agent`, `--last-failed`, and `list`. Story and selection tags are present on current E2E registrations; use `npx e2e list` first to inspect selected test-target pairs. `npm run check:stories` validates tag syntax, referenced story IDs, required selection dimensions, and that stories marked covered have a tagged test. It does not assess whether a test's assertions prove the full acceptance contract.

```sh
npx e2e list --tag story:PUB-02 --target mobile
npx e2e run --tag story:PUB-02 --target mobile
npx e2e run --tag domain:cards --tag risk:critical --tag-mode all
npx e2e run --last-failed
```

Today, the local compatibility configuration uses one worker with desktop (1440x960) and mobile (390x844) targets. CI smoke selects `public-journey.e2e.ts` and `quick-actions-layout.e2e.ts`. Story selectors are available now; the checker reports metadata and mapping gaps explicitly, while humans still need to review behavioral depth and assertion quality.

### Selection Policy

| Trigger | Selection |
| --- | --- |
| One route/component behavior change | Mapped story IDs plus the changed module's focused tests; choose viewport based on changed layout/interaction |
| Auth, tenant access, public URL, slug/card, publication, cache, media privacy | All mapped `risk:critical` stories and negative/old-URL cases; local plus Staging when hosted behavior is material |
| Copy or isolated layout change | Relevant story and target viewport/locale; avoid admin mutation coverage |
| Shared contract, database, runtime, dependency, folder boundary, or runner change | Story coverage checker plus all mapped stories/domains and deterministic contract tests |
| Release, migration phase gate, or explicit full regression request | All active stories across required targets/environments; isolate mutations and record environment-blocked cases separately |

Adaptive selection uses [story routing](STORY_ROUTING.json), which labels paths as `legacy-baseline`, `cloudflare-target`, or `quality-only`. For migration implementation use `npm run select:stories -- --paths workers/public/profile.ts --track cloudflare-target`, or `--from <git-ref> --track cloudflare-target` for a committed diff. The selector prints paired `e2e list`/`run` commands for exact tagged registrations. Optional `--risk`, `--env`, `--mutation`, and `--target` filters narrow the plan. Legacy paths are selected with `--track legacy-baseline` only for compatibility/parity work. Changed E2E registrations route their tagged stories directly. Unknown paths, E2E files without story tags, or a target story with no test registration fail explicitly; they never expand to the entire legacy suite. A gap means write the target contract test when its phase runtime exists, or record the actual prerequisite blocker.

### Agent-Driven Journeys

Tests using `agent.act`, `agent.assert`, `agent.waitFor`, or `agent.extract` need a configured AI SDK model and provider authentication. Deterministic tests that use `screen`, `browser`, and `expect` do not. Keep exact URL, state, counts, authorization, headers, persistence, and data-integrity checks in deterministic assertions after model-driven UI actions.

The `agent.*` model used by E2E journeys is separate from the Terra semantic-review subprocess described below. The runner does not inherit this Codex session's selected model; its `chatgpt()` adapter uses a separate saved OAuth login and model list. Using Terra for E2E actions requires the exact model to be exposed by that adapter or an independently reachable AI SDK-compatible endpoint, plus separate authentication. Do not add provider dependencies or auth, substitute a different model, or claim Terra-backed E2E until a harmless non-mutating fixture verifies the exact model/provider/effort combination. Deterministic tests remain runnable without model access. The verified replay cache may reduce repeated action calls, but changed screens/contracts must be run live; never treat replay as proof of backend integrity.

## Codex Session Continuity

Codex manages trust for project hooks separately from repository code. Dispatcher fixtures cover `SessionStart`, `PreCompact`, `PostCompact`, and `SessionEnd`. `AGENT_MEMORY.md` is the tracked, replaceable continuation note for the latest unfinished task; it is limited to 2 KB and 20 nonblank lines. `SessionStart` loads it with a worktree-matched local handoff. Before compaction, the agent must replace the note with the state immediately before compaction and prepare a local checkpoint. `PostCompact` loads both the updated note and that checkpoint; `SessionEnd` finalizes the checkpoint. Checkpoints carry branch, Git summary, current state, changed paths, check results, and repository-relative file references; malformed, mismatched, and older-than-30-day state is ignored. `PreCompact` does not read or summarize the transcript, so the agent must write both continuation records before compaction.

Before a substantial context compaction or when ending a session with unfinished work, prepare a checkpoint using the session ID supplied in hook context. The command replaces `AGENT_MEMORY.md` and writes the matching local checkpoint from the supplied current task, status, last completed step, next action, blockers, and selected paths/checks; each file write is atomic. Do not put a broad changed-file inventory in memory; the local checkpoint can retain detailed paths. Keep memory within its stated limits and remove earlier task history:

```sh
printf '%s\n' '{"sessionId":"SESSION_ID","task":"Foundation implementation","completed":["Docs and quality checks"],"decisions":["Keep project hooks untrusted"],"nextSteps":["Review deferred hook work"],"blockers":[]}' | node scripts/quality/task-checkpoint.mjs
```

Record concise facts and next actions only. The validator rejects credential-like text, oversized fields, unsupported fields, invalid session IDs, and checkpoints from another worktree. The state is local and ignored under `.codex/state/`; it is not committed or treated as an authority over current source or requirements. Do not include transcripts, secrets, private business data, or speculative conclusions.

The project records session-attributed `apply_patch`, `Edit`, and `Write` events in ignored `.codex/state/review-ledger/` files. A synchronous, three-second `PostToolUse` handler stores only safe repository-relative paths and redacted exact patch text when available; sensitive/out-of-repository mixed patches keep paths only. It runs no tests or model review. At `Stop`, changed TS/JS files receive one focused ESLint run (60-second bound); architecture checks run only when imports change or a source module is added, and file-budget checks run only for a new source module. Documentation and story metadata checks run only when their authoritative inputs changed.

At `Stop`, the synchronous final review loads only that session's ledger and reconciles Git's complete changed-path list against the SessionStart baseline and each recorded post-edit file fingerprint. Bash-only changes, files changed again after their last recorded edit, unavailable baselines for dirty worktrees, malformed/overflowed ledgers, and paths that cannot be fingerprinted block completion. Successful deterministic checks are reused only when the changed paths and all relevant source/config inputs have the same fingerprint; failures, unavailable results, or changed inputs run again. For exact JavaScript/TypeScript source and unit/integration test patches, Stop also requests a bounded semantic review against `AGENTS.md`, the testing guide, known-issue log, shared-interface catalog, and relevant architecture/domain guidance. It checks reuse of catalogued interfaces, catalog updates for stable new shared interfaces, KNOWN_ISSUES entries for resolved reusable blockers, focused tests, and applicable repository rules. Findings or reviewer unavailability block Stop and prevent auto-commit until resolved; a clean review is cached only for the same redacted patch and guidance fingerprint. High-risk and cross-module edits continue to trigger this review regardless of source extension when every changed path is allowlisted. Path-only edits, patches containing detected contact values, sensitive paths, or mixed patches that cannot be safely isolated skip semantic review; the result is reported as unverified and auto-commit is disabled. `stop_hook_active` marks continuation and does not waive a gate. If the reviewer provider is unavailable, the hook asks the current agent to delegate to a reviewer configured with `gpt-6.1-terra` at low effort, then rerun Stop after the review result is available. The Terra subprocess uses `codex exec --ephemeral --disable hooks --sandbox read-only` and a mode-0700 temporary directory, but that directory is not an OS-level boundary against reading other files. Pattern screening is heuristic; do not send confidential or customer data for model review. The hook does not parse the transcript or certify tests. Codex controls trust for the exact hook definition; CI and migration phase gates remain authoritative.

After a successful Stop review, the hook may create `codex: validated session changes`. It requires a clean Git worktree at `SessionStart`, the same branch and HEAD, exact patch attribution for every edit, a current diff limited to those session paths, passing applicable deterministic checks, and a passing Terra result whenever Terra was required. Missing baselines, pre-existing or unrelated changes, path-only edits, skipped/unavailable checks, Terra findings/provider unavailability, or Git errors skip the commit. The Git add and commit attempts are bounded to one and two seconds respectively. This gate does not run or certify unit/E2E tests; test commands remain task- and CI-driven. The Stop hook has a 90-second overall limit to accommodate focused lint and any required Terra review.

`SessionEnd` finalizes only a prepared checkpoint and removes that session's temporary review ledger and commit baseline. It does not perform the final code review or summarize the transcript. Prepare checkpoints during work and before compaction because session-end delivery is not a reliable completion gate.

The SessionStart hook has a 15-second bound to capture baseline fingerprints for an already-dirty worktree; Git status/revision reads allow five seconds because the full repository status can exceed one second. The shared user Codex config at `/home/supabase/.codex/hooks.json` has a Bash `PreToolUse` handler at `/home/supabase/.codex/hooks/pretooluse-guard.mjs`; its three standalone tests pass. The former Lavish `SessionStart` launcher was removed. Its command matcher is heuristic and is not a security boundary; normal Codex sandbox and approval policy remain primary.

## Dependency and Runtime Changes

When `package.json`, `package-lock.json`, Node pins, or package workflows change:

1. Review the exact direct dependency/runtime changes and why they are needed; do not run an unreviewed install command or execute package lifecycle scripts as a substitute for review.
2. Confirm the manifest and committed lockfile agree using a deterministic lockfile check, then use `npm ci` in a clean environment to prove reproducibility.
3. Run `npm audit --audit-level=high` across production and development dependencies for dependency changes; retain the existing production-only audit as its separate CI gate. Report lower-severity advisories and the existing baseline rather than hiding them.
4. Review package provenance, maintenance, license, install scripts, and newly introduced transitive footprint. Automated audit is vulnerability evidence, not proof of supply-chain safety.
5. Run focused affected tests and the build; use full required CI for runtime, framework, or build-chain changes.

The planned dependency-change hook should trigger only when package manifests/lockfiles change. Its fast deterministic checks verify parseability, lock alignment, added/removed direct packages, and unexpected lockfile-only changes. A bounded audit may run with network access; on timeout or unavailable registry, report `not verified` and let CI's networked gate remain authoritative. Never let an agent silently install or upgrade dependencies, auto-fix a lockfile in a hook, or treat a Terra recommendation as authorization. Terra may advise on a proposed package after deterministic evidence is collected; it does not replace npm audit or human review.

The current legacy toolchain pins Node `22.23.5` for local and CI consistency. It does not define the Cloudflare Worker runtime; target Worker compatibility is configured and verified in the migration implementation. No Vercel setting changes are part of target implementation.

## Migration Test Evolution

Default migration tests prove product outcomes and target boundaries, not that Supabase, PostgreSQL, or Vercel internals still work. Existing platform-specific scripts remain opt-in rollback diagnostics and do not gate Cloudflare work. Do not port every old RPC or policy as an independent target test; express its required user-visible behavior as a focused application/D1 contract.

Prioritize these functional contracts as the target runtime is introduced:

- Published profile HTML is available at the stable slug, and warm delivery is static/CDN with no Worker or database execution.
- Publish, update, unpublish, and rollback keep the previous valid version available and meet the stated freshness limits.
- Slug aliases, `/b/{slug}`, `/c/{token}`, QR/NFC destinations, unavailable-card states, and contact VCF URLs remain correct.
- Media derivatives and public assets use the expected R2/CDN URLs, formats, privacy, and cache behavior.
- Admin access is staff-only through Cloudflare Access plus application authorization; deny cross-tenant access and unauthorized writes.
- D1 data changes, publication artifacts, inventory actions, exports, restore, and cutover preserve required integrity and idempotency.
- `/menu/*` continues to resolve to the separate Menu application through the agreed hostname routing.

For each phase, add deterministic domain tests first, Worker/D1/R2 integration tests at the actual service boundaries, then isolated Cloudflare-local or staging journeys for URLs, auth, caching, and cutover behavior. Keep fixtures synthetic and mutation targets isolated. Do not claim target coverage before a runnable test passes against that target phase.

The migration PRD's functional acceptance and phase exits remain authoritative. Label unimplemented runtime tests as planned; do not substitute legacy platform tests or local Next.js measurements for target evidence.

## Keeping This Guide Current

Update this guide and the story catalog in the same change when a test command, route, runtime, domain owner, fixture, workflow, release gate, actor, or acceptance contract is added, removed, or changes meaning. Register new authoritative specs with `Status`, `Owner`, `Supersedes`, `Path globs`, and `Topic tags` in the docs index. Link test evidence to story IDs; never mark skipped or unavailable evidence as passing. Record reusable failures in the matching category under [`docs/known-issues/`](known-issues/), using the stable [`KNOWN_ISSUES.md` index](KNOWN_ISSUES.md) for categories and the symptom/cause/solution/regression-guard format. Label uncertain causes as open rather than guessing.
