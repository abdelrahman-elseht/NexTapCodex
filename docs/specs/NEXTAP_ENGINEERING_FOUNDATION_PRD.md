---
Status: approved-scope / implementation-ready
Owner: abdelrahman-elseht
Supersedes: none
Path globs: AGENTS.md, CODEBOOK.md, docs/**, scripts/quality/**, tests/unit/**, tests/e2e/**, e2e*.config.ts, package.json, package-lock.json, .github/workflows/**, .codex/**
Topic tags: foundation, documentation, testing, e2e, codex-hooks, dependencies, architecture
---

# NexTap Engineering Foundation

**Date:** 2026-11-12
**Status:** Approved scope; implementation proceeds in gated phases
**Owner:** NexTap product and engineering owner

## Implementation Status

The durable maps, story metadata checker, track-aware adaptive selector, dependency guard, architecture/file-budget checks, Node baseline, project session-continuity hooks, repository performance budgets, session edit ledger, and bounded `Stop` review are implemented. The catalog now includes Cloudflare target stories `MIG-01`–`MIG-07`; they remain uncovered until their runtime and fixtures exist. `STATE-01` is unmapped, `ADM-BIZ-06` is blocked on a disposable mutation fixture, and `AUTH-02` has isolated-local mobile evidence while Staging remains unverified. These are visible coverage gaps, not passing evidence. `PostToolUse` runs deterministic path-routed checks; Stop reuses successful deterministic results only when candidate and relevant inputs are unchanged. Terra runs only for exact, allowlisted high-risk or cross-module session changes with bounded, path-selected Codebook/Architecture and registered-doc context. Deterministic failures/unavailability and required Terra findings or provider unavailability keep Stop blocking on continuation until they pass. If the Terra provider is unavailable, Stop asks the current agent to delegate to `gpt-6.1-terra` at low effort, then rerun Stop after the review result is available. A live synthetic packet smoke returned exact `PASS` through `codex exec` on 2026-11-12; this verifies only that invocation path in the current environment, not hook activation, privacy isolation, provider reliability, or the E2E runner's separate model configuration. The project hook config remains untrusted until its exact definition is reviewed. The wrapper invokes a separate ephemeral `codex exec` child at low reasoning effort with hooks disabled; that does not configure or authenticate the E2E runner's AI model. See [Testing Guide](../TESTING.md) for candidate provenance, exclusions, loop behavior, cache behavior, and auto-commit limits. This status does not weaken the acceptance criteria below.

## Problem

NexTap already has useful architecture guidance, a detailed user/admin story catalog, layered tests, and release workflows. The information is spread across current contracts, planned migration documents, and historical handoffs. Shared module ownership and story coverage are not mechanically discoverable, E2E tests cannot be selected consistently by story or risk, dependency changes can bypass focused review, and Codex hooks/session handoffs lack a repository-specific tested design. As NexTap moves from Supabase-backed Next.js to Cloudflare delivery and D1 administration, these gaps increase regression risk and encourage agents to guess which sources and tests matter.

## Outcome

Create a small, enforceable engineering map that helps a developer or agent find the current contract, reuse stable modules, choose the smallest sufficient tests, and preserve work between sessions. Every active user/admin/manufacturing story must have a traceable E2E test or an explicit environment blocker. Tests remain selectable by story, domain, risk, environment, and mutation class; a full run is reserved for phase and release gates.

The foundation must adapt as new PRDs, runtimes, folders, routes, data models, and user stories are introduced. Its primary job is to guide the active Cloudflare migration. Describe the current Next.js/Supabase implementation as the compatibility baseline and source for product parity evidence; use the landing migration PRD as the target contract. Supabase/PostgreSQL and Vercel-hosted tests are not default migration gates. Never report planned D1/Worker behavior as deployed behavior.

## Success Measures

- Every authoritative technical document is indexed with machine-readable status, owner, supersession, repo-relative path globs, and topic tags; links and metadata pass a deterministic check.
- A new authoritative PRD or technical guide is discoverable by task scope and changed paths without editing hook code.
- Current source ownership, stable shared interfaces, test commands, target data model, and known issues each have one clear home.
- Every story has a stable ID, stage/status, risk, environment/fixture requirements, edge cases, and either E2E tags or a specific blocker. Skipped tests do not count as passing coverage.
- A changed route/domain can select its matching tests; high-risk changes select related negative and compatibility stories; release gates can select all active stories.
- Dependency or lockfile changes trigger deterministic integrity checks, an audit, and a review of newly added packages. No hook silently installs packages.
- Hook checks are bounded, path-aware, tested against fixtures, and inactive until their exact project config is reviewed and trusted.
- Session continuity preserves concise task evidence without copying transcripts or overwriting current requirements from stale memory.
- Existing behavior, user config, production data, and deployment settings are not changed by the foundation work.

## Principles and Constraints

- `AGENTS.md`, current code/configuration, accepted PRDs, and tests outrank historical handoffs and compact agent memory.
- One document owns each durable fact. Do not copy SQL schemas, package scripts, or full file inventories into prose.
- Use current package scripts and GitHub workflows as the executable command inventory.
- Keep shared Codex protections user-wide and project checks repository-specific. Do not duplicate the destructive-action guard.
- PreToolUse may deny with a reason but cannot request approval. Normal Codex approval policy remains separate.
- PostToolUse runs after a tool action and cannot undo it. Stop checks are deterministic, fast, bounded, and loop-safe. CI remains the merge gate.
- Model judgments are advisory, privacy-reviewed, and skipped when source attribution is ambiguous. Do not send secrets, full transcripts, generated artifacts, private business data, or unrelated dirty files to a model.
- User/admin mutations run only against an explicitly isolated test database or protected Staging fixtures. No production mutations are part of this work.
- Maintain compatibility with the landing migration PRD and the separate Menu application. Do not add D1, Worker runtime code, or new infrastructure in this foundation task.

## Deliverables

| Deliverable | Required content and behavior |
| --- | --- |
| `docs/TESTING.md` | Adaptive checks by changed surface/risk, authoritative commands sourced from `package.json`/workflows, local vs Staging vs future Worker/D1 test boundaries, E2E selection and phase updates. |
| `docs/COMPONENTS.md` | Curated stable shared UI/domain exports only; owner, purpose, public contract, runtime/side effects, and primary tests. No private helper inventory. |
| `docs/DATA_MODEL.md` | Current Supabase state references and proposed D1 logical model, publication/artifact ownership, slug aliases, cards, admin identity, media, integrity/transactions, migration map, open decisions. Migrations/tests remain current-schema truth. |
| `docs/specs/USER_ADMIN_STORIES.md` | Durable story IDs; actor, acceptance, edge cases, stage/status, priority/risk, environment and fixture, mapped tests/tags, explicit blockers. Include customer, admin, manufacturing, error/security, compatibility, and migration stories. |
| `docs/README.md` | Group authoritative contracts, active operational handoffs, specs, research, and history; register technical docs and preserve valid links. |
| `docs/KNOWN_ISSUES.md`, `docs/known-issues/`, and `AGENTS.md` | The index routes agents to categorized canonical issue records. Every newly solved reusable error/blocker has symptom, verified cause or explicit uncertainty, solution, and prevention/regression guard. |
| `scripts/quality/docs-index.mjs` + focused unit tests | Validate index entries, file links, front matter/registration fields, path globs, topic tags, status, and supersession targets. Do not decide semantic truth. |
| Story coverage and routing checker + tests | Validate story IDs against discovered test tags and story states; identify uncovered, stale, untagged, blocked, and planned entries. Map changed paths/topics to a reviewable, narrow test selection. Unknown/ambiguous mapping requires human/agent scope confirmation and never silently selects the entire suite. |
| E2E test metadata and runner config | Tags include `story:<ID>`, `domain:<area>`, `risk:<critical|high|normal>`, `env:<local|staging>`, and `mutation:<read|write>`. Runtime fixture guards, not tags alone, enforce mutation safety. Keep current desktop/mobile targets and hosted Staging protections. |
| Dependency change checker + tests | On `package.json` or `package-lock.json` changes, verify manifest/lock synchronization and unexpected root dependency changes; report added/removed packages and lifecycle scripts; run full dependency audit with a bounded timeout; state network-unavailable behavior. CI is authoritative. Never auto-install or auto-fix dependencies. |
| Public performance regression gate | Production-mode Chromium measurement of stable public routes under cold cache, Slow 3G, and 4× CPU; deterministic byte/request/layout budgets fail CI, while LCP/TTFB are reported until repeated runner baselines calibrate timing thresholds. Run on every CI change because shared assets and styles have broad impact. |
| `scripts/quality/architecture-check.mjs` + tests | Enforce documented import direction, route-local placement, and client/server boundary. Data-driven rules with positive/negative fixtures and narrow documented exceptions. |
| `scripts/quality/file-budget.mjs` + tests | Warn at 250 and cap at 350 handwritten TS/TSX lines after inventory calibration; growth-only for grandfathered files; exclusions and exception owner/reason are explicit. |
| `scripts/quality/post-tool-check.mjs`, `scripts/quality/session-review.mjs`, `scripts/quality/terra-review.mjs` + tests | PostToolUse records safe path/exact-patch provenance and runs focused deterministic checks. Stop reuses successful checks by relevant-input fingerprint and submits only exact, allowlisted high-risk or cross-module session patches with path-selected Codebook, Architecture, and registered docs to an ephemeral read-only Terra child. It may auto-commit only after applicable checks pass, required Terra returns a clean result, and a clean SessionStart baseline plus exact diff scope prove the commit contains only session edits. Sensitive/ineligible candidates cannot receive Terra review. Deterministic failures/unavailability and required Terra findings or provider unavailability block every continuation until pass; provider unavailability asks the agent to delegate a `gpt-6.1-terra` low-effort review, then rerun Stop. Git errors skip commit. |
| `scripts/quality/task-checkpoint.mjs`, `scripts/quality/session-state.mjs`, `scripts/quality/codex-hooks.mjs` + tests | Bounded, secret-free checkpoint validation and handoff finalization; repo/worktree/session identity checks; atomic writes; SessionStart/PostCompact load the current continuation note; no transcript parsing/model/network work at SessionEnd. |
| `.codex/hooks.json` and dispatcher/tests | Project hook configuration for PostToolUse checks, bounded Stop review, and continuity events. It remains untrusted until its exact current definition is reviewed and trusted. Stop uses the supported `decision: block` continuation response and `stop_hook_active` loop guard. |
| `AGENT_MEMORY.md`, `.codex/state/` ignore rule | Replaceable latest-unfinished-task continuation capped at 20 nonblank lines/2 KB; it carries only the next action's needed context, while the local ignored checkpoint may retain detailed paths. The checkpoint command refreshes both immediately before compaction. Completed tasks are cleared/replaced, never appended as history. Current user instructions and source outrank memory. |
| Node runtime baseline | Use the current Node 22 security patch `22.23.5` in `.nvmrc` and CI workflows; package engines allow `^22.23.5 || >=24.8.0`, matching installed E2E package minimums. The current Vercel runtime is a legacy rollback concern; the Cloudflare runtime and bindings follow the landing migration PRD and are verified at their phase gates. |

## Story and E2E Contract

The existing E2E package supports selecting files, tags, title patterns, targets, named agents, and last-failed tests. The foundation adds stable story tags rather than inventing a second test runner. Examples:

```sh
npx e2e list --tag story:PUB-02 --target mobile
npx e2e run --tag story:PUB-02 --target mobile
npx e2e run --tag domain:cards --tag risk:critical --tag-mode all
npx e2e run --last-failed
```

The story map covers, at minimum:

- Public/visitor: landing/demo, direct business URLs, published content, contacts/VCF, phone/WhatsApp, location/hours, reviews, social/payment links, menu handoff, media, language, QR/NFC/card entry.
- Admin: authentication/session lifecycle, unauthorized/non-owner denial, dashboard and search, create/edit/slug aliases, sections and ordering, draft/preview privacy, publish/rollback, branches/templates, image upload, failed-save recovery.
- Manufacturing: batch bounds/idempotency, inventory, QR/NFC manifests, CSV/ZIP consistency, card assign/reassign/disable/delete, permanent token resolution.
- System/security: unknown/unpublished/inactive states, tenant ID tampering, cache poisoning/staleness/purge, upload validation, broken images, keyboard/RTL, responsive widths, error recovery, data/export privacy.
- Migration: Supabase-to-D1 parity when implemented, static/CDN warm delivery, cache freshness, R2 media formats, old URL preservation, Worker/D1 outage behavior, rollback, and `/menu/*` coexistence.

Represent story stage independently from coverage: `current`, `migration-active`, `planned`, `blocked`, or `retired`; coverage state is `covered`, `partial`, `blocked`, or `not-covered`. A skipped test only records the exact missing prerequisite and cannot turn a story green. As migration phases add or replace routes, keep old URL/QR/NFC compatibility stories active until the agreed retention/cutover gate passes.

### Selective test policy

| Change class | Required selection |
| --- | --- |
| Narrow component or copy change | Focused unit/component test and mapped story; mobile/layout/locale targets only when relevant. |
| Public route, media, contact, card, URL, cache, auth, tenant boundary, or publication | Mapped story set plus negative/compatibility stories; broaden to the affected domain when shared contracts change. |
| DB/schema/transaction change | Owning unit and DB contract tests; add concurrency/rollback; select admin/public stories that exercise persisted behavior. |
| Worker/D1/KV/R2 or routing phase change | Current/new boundary contract tests and mapped migration stories; Staging integration and real-device evidence at the PRD phase gate. |
| Test framework, shared component API, architecture boundary, dependency/runtime/workflow | Checker tests plus changed-path stories; broaden to active domain/phase if mapping is wide or uncertain. |
| Release, migration phase exit, or explicit full regression request | All active stories across required desktop/mobile, isolated mutation, and Staging environments; report blocked prerequisites separately. |

Ordinary PR CI keeps deterministic core checks and a small public smoke. Changed-story and critical-risk selection is added only when it can run safely and predictably in CI. Full agent-driven journeys remain a deliberate release/phase/manual or scheduled gate, not an all-or-nothing requirement for every edit.

### E2E model setup gate

Agent-driven E2E journeys require an AI SDK model/provider instance and separate provider authentication. If such a journey is introduced, verify the selected provider's exact model and reasoning settings with its model list and a harmless fixture test. Availability of the Codex Terra review subprocess does not prove that the E2E runner can call the same model. Do not substitute another model silently. Tests without `agent.*` must remain runnable without model credentials. Pin critical outcomes with deterministic assertions after each model action; authorization, data integrity, URLs, cache headers, downloads, and DB states require deterministic assertions or independent tests.

The e2e CLI currently requires Node `^22.22.3 || >=24.8.0`; both installed E2E packages declare that range. The project baseline is therefore raised within Node 22 to `22.23.5`, a patch/security release compatible with the dependency range. Agent-driven E2E execution is enabled only after supported Node is used and the exact model/provider/reasoning option is verified.

## Dependency Safety Policy

When a package manifest or lockfile changes:

1. A deterministic hook validates package/lock root agreement and reports every new, removed, or version-changed direct dependency and install lifecycle script.
2. A focused dependency review checks package purpose, official registry/source, maintenance/release history, license, transitive footprint, install scripts, and alternatives. Terra may advise from supplied registry metadata and diff evidence; it cannot approve a package by itself.
3. Run `npm audit --audit-level=high` with a fixed timeout on manifest/lock changes. Network failure is reported as `not verified`, never as a clean audit; CI must complete the authoritative audit before merge.
4. Do not run `npm install` from a hook or let a model edit manifests. A developer/agent must make an explicit dependency change, update the lockfile using the approved package manager, explain it, and run the relevant tests.
5. Existing moderate advisories are reported distinctly from new findings. The baseline at authoring time includes five moderate production-path findings in the Sentry/glob/minimatch dependency tree, zero high/critical findings, and available fixes. Track this baseline and resolve it separately; do not disguise it as a new Node compatibility regression.

`npm audit --omit=dev --audit-level=high` and committed manifest verification already run in CI. Align CI with the hook checks without weakening the current production audit. Add a full dependency audit in CI or a required dependency-change workflow only after observing audit behavior and documenting accepted exceptions.

## Hook Behavior and Failure Policy

| Event | Responsibility | Failure behavior |
| --- | --- | --- |
| `SessionStart` | Read bounded `AGENT_MEMORY.md` as the latest unfinished-task continuation and the latest matching local handoff; capture the session's branch, HEAD, and clean-worktree flag for guarded auto-commit; add a bounded live branch and working-tree count summary. | Resume only if the task remains unfinished and consistent with latest user instructions/source. Ignore stale/mismatched handoff; never load another worktree's state. |
| `PostToolUse` | Record bounded, session-attributed edit paths and redacted exact patches; run no tests or model review. | Synchronous ledger write is capped at three seconds and fails open. |
| `Stop` | Run changed-file lint once; run architecture checks only for import changes or a new source module, and file-budget checks only for a new source module. Require a clean Terra result for verified high-risk or cross-module candidates. Auto-commit only the exact session diff after every applicable deterministic check and any required Terra review pass. | Deterministic failure/unavailability and required Terra findings or provider unavailability return `decision: block` on every continuation until pass; a Terra provider outage asks the agent to delegate to `gpt-6.1-terra` at low effort, then rerun Stop. `stop_hook_active` marks continuation and does not waive deterministic checks. Cache successful checks only for identical candidate/input fingerprints. A missing/dirty SessionStart baseline, unrelated diff, ineligible edit, or Git error skips commit. CI remains merge gate. |
| `PreCompact` / `PostCompact` | Before compaction, agent replaces `AGENT_MEMORY.md` with the latest continuation and explicitly prepares a local checkpoint. After compaction, load both the current memory note and matching checkpoint. | `PreCompact` does not parse or summarize transcript data. Reject invalid/stale local state, then re-establish from latest memory/source. |
| `SessionEnd` | Finalize the already prepared checkpoint into a concise handoff and clear the session's review ledger and auto-commit baseline. | Synchronous advisory operation under the documented 3-second limit; no model, network, tests, git, or transcript parsing. |
| Shared user `PreToolUse` | Deny narrowly identified high-confidence catastrophic target commands with a reason. | Cannot request approval and is not a shell parser/security boundary. Broad-command approval remains Codex policy. |

Before implementation, re-check current official Codex hook event schemas, matchers, output contracts, and trust behavior. Project hook config remains inactive/untrusted after this foundation change. Separately, the active user-level config at `/home/supabase/.codex/hooks.json` now removes the Lavish SessionStart launcher and defines a narrowly scoped Bash PreToolUse guard at `/home/supabase/.codex/hooks/pretooluse-guard.mjs`; its standalone tests pass, but its trust record remains untouched and Codex must review/trust it before activation. This user-level edit is distinct from the repository's project hooks and is not a security boundary.

## Phased Implementation

### Phase 0 — Baseline and compatibility

- Record current dirty state and avoid modifying unrelated pre-existing changes.
- Pin Node `22.23.5`; update package engines, lock root metadata, `.nvmrc`, and CI workflow versions.
- Verify clean install, typecheck, lint, unit and product journey tests, compatibility build, and a harmless E2E test listing. Supabase/PostgreSQL diagnostics are opt-in rollback evidence, not default migration gates.
- Record Vercel runtime only as legacy rollback evidence where it is available; target-runtime validation belongs to the Cloudflare migration phase gates.
- Record the existing audit advisory baseline and ensure no new high/critical finding is introduced by the runtime-only change.

**Exit:** clean dependency install and baseline checks pass, or each pre-existing failure is reproduced and recorded in Known Issues with cause status clearly marked.

### Phase 1 — Durable maps and registration

- Add TESTING, COMPONENTS, and DATA_MODEL documents with status/scope metadata.
- Reorganize docs index without deleting/moving handoffs; validate links and authority/supersession.
- Update AGENTS navigation and the existing story catalog stage/coverage model.
- Keep `AGENT_MEMORY.md` on the latest unfinished task only; replace the whole note before compaction and clear/replace it when work completes. Enforce the 20-nonblank-line/2 KB ceiling.

**Exit:** docs checker validates registrations; docs describe current state and target state separately; every new reusable issue discovered is recorded.

### Phase 2 — E2E story coverage and selection

- Tag existing tests with story/domain/risk/environment/mutation dimensions and preserve runtime isolation guards.
- Fill high-priority missing customer/admin/manufacturing stories or declare exact blockers; do not falsely claim complete coverage based on file presence.
- Add deterministic story-tag coverage checking and changed-path/topic selection that produces a reviewable command.
- Verify `e2e list` selections without starting the app, then run safe local public/read-only journeys.
- Keep deterministic E2E model-independent. Verify a provider/model/reasoning combination only if a test actually introduces `agent.*` steps; this is separate from the project Terra review subprocess.

**Exit:** each active story has passing evidence or a documented blocker; selective commands behave as documented; full suite includes all active stories at explicit gate.

### Phase 3 — Deterministic repository checks

- Implement docs index, architecture boundaries, file budgets, dependency-change guard, and task checkpoint validation with focused positive/negative tests.
- Add checks to local scripts and CI at a deliberate cadence. Keep network audit bounded and CI authoritative.
- Do not use full application E2E on every file write.

**Exit:** new checks pass on the current tree; existing issues are either resolved or explicitly grandfathered with owner/reason; ordinary PR feedback stays bounded.

### Phase 4 — Hook plumbing, implemented and untrusted

- Implemented a single dispatcher and fixture-tested asynchronous PostToolUse handler for `apply_patch`, `Edit`, and `Write` events.
- A synchronous bounded PostToolUse ledger records session-attributed safe paths and redacted exact patches for final review. Stop runs changed-file lint once, with architecture/file-budget checks reserved for structural source changes; it reuses successful checks only while their relevant inputs remain unchanged and keeps blocking each continuation until deterministic failures/unavailability and required Terra review pass.
- Stop-triggered Terra compares exact eligible high-risk or cross-module session patches with path-selected authoritative docs. Isolated low-risk edits skip model review. Findings block Stop until corrected and the review passes. Provider unavailability blocks completion and asks the current agent to delegate a low-effort `gpt-6.1-terra` review, then rerun Stop; auto-commit remains disabled without a passing review.
- Use only tool-event patch/path provenance. Shell writes, ambiguous paths, patches containing email/phone-like values, legacy business/auth/media paths, tests, fixtures, and generated paths do not receive semantic review. Known credential-shaped text is redacted; all pattern screening is heuristic.
- Select Cloudflare-target stories and registered docs from changed paths; the Terra child is instructed to review a bounded patch/context packet from a mode-0700 temporary working directory with hooks disabled and read-only sandboxing. The temporary working directory limits its initial context but is not an OS-level guarantee that unrelated files are unreadable; never submit confidential or customer data.
- Cache only clean Terra results by patch/document fingerprint. Keep findings and unavailable runs visible; never let Terra remove deterministic checks or certify a test.
- Project hook config remains untrusted until its exact current definition is reviewed and trusted. Do not modify user config.

**Exit:** met for the implemented hook scope: fixtures cover continuity, event attribution, path allowlisting, safe redaction, Stop continuation/loop behavior, deterministic failures, Terra pass/findings/unavailable/timeout, and clean-review caching. User review/trust remains outstanding.

### Phase 5 — Ongoing adaptation

- When a new route/domain/runtime/spec/story arrives, update the owning registration and map in that same change.
- Update architecture, test mapping, and data model when Worker/D1/KV/R2 implementation is added. Gate migration work on target functional contracts; keep Supabase/PostgreSQL scripts only for an explicitly requested rollback investigation.
- Promote stories from planned to active only when the runtime/phase exists. Retire compatibility stories only after accepted retention/cutover gates.
- Update Known Issues when an error or blocker is newly reproduced and solved; label unconfirmed causes explicitly.

**Exit:** the foundation stays accurate through the landing migration and unrelated features without hard-coded phase logic in hooks.

## Risks and Mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Story catalog claims coverage not actually run | High | Separate stage from coverage state; require discovered tags and evidence; skipped prerequisites remain blockers. |
| Agent model makes a false pass | High | Deterministic assertions for invariants, model advisory only, trace review, no model-only auth/data approval. |
| Terra model/provider/reasoning mode unavailable | Medium | Explicit safe setup gate; no silent model substitution; deterministic tests remain runnable without model. |
| Node/runtime mismatch causes E2E or deployment failure | Medium | Node 22 patch upgrade only; verify local/CI consistency. Record Vercel runtime only as legacy rollback evidence; verify Cloudflare runtime compatibility at its migration phase gate. |
| Dependency audit network outage hides risk | High | Report unverified, preserve CI gate, never treat timeout as clean. |
| Hook misattributes dirty or concurrent edits | High | Baseline provenance and isolated worktree policy; skip semantic judgment on ambiguity. |
| Hook latency or repeated blocking disrupts work | Medium | Event/path matchers, budgets, fingerprints, pass-only caching, loop-safe Stop. |
| Stale docs/memory conflict with source | Medium | Source precedence and registration checks; memory remains compact pointers only. |
| Mutation test reaches shared/production data | Critical | Require environment assertion plus isolated synthetic namespace/database; tags are not security control. |

## Acceptance Criteria

- The current architecture and Cloudflare target are clearly distinguished in every new document.
- `docs/README.md` links all new specs and all registered links resolve.
- Story coverage checker catches a missing ID, stale ID, missing tag, and prerequisite-blocked test in fixtures.
- E2E filters can list and run one story, one risk/domain slice, one target, last-failed set, and all active stories.
- Current tests retain their mutation gates; no story tag can bypass them.
- Node `22.23.5` runs the project scripts and installed E2E CLI; CI uses the same Node 22 patch. Vercel runtime is recorded only as legacy rollback evidence; Cloudflare runtime configuration is verified during migration phases.
- Dependency changes produce a reviewable manifest diff, lock consistency result, audit status, and package provenance/maintenance review; timeout/network failure is visibly unverified.
- Architecture, documentation, dependency, checkpoint, session handoff, and hook dispatcher tests cover expected and failure paths.
- PostToolUse selects Cloudflare-target stories/docs from attributable edit events. Stop performs the final deterministic gate and optional Terra comparison against selected authoritative docs; Terra caches clean results by candidate+document fingerprint. Deterministic failures, required Terra findings, and required Terra provider outages keep Stop blocked until they pass; outages request delegated review. Auto-commit is limited to a clean-start session's exact diff after all applicable checks and required Terra review pass.
- Project hooks are not activated/trusted. The separately edited user-wide Bash PreToolUse definition also remains untrusted until Codex reviews it.
- No production data/configuration, DNS, or deployment is modified.
- The migration PRD’s user-visible URL, performance, security, and release requirements remain unchanged.

## Open Verification Items

- Confirm the migration's Cloudflare runtime and bindings at their implementation phase gates. The Vercel runtime remains external legacy rollback evidence and is not a target requirement.
- Only if agent-driven E2E steps are introduced, determine which E2E provider supports the chosen model/effort and verify it with a harmless fixture. The Codex Terra semantic review subprocess does not configure or authenticate the E2E runner.
- Reconcile current moderate production audit advisories (Sentry/glob/minimatch) with the package update policy; five moderate and zero high/critical were observed at PRD drafting time.
- Extend attribution only when Codex supplies a verified per-write patch/path event; shell commands and concurrent worktree snapshots remain excluded from semantic review until provenance can be established safely.
- Confirm which user/admin stories are current versus planned as Cloudflare migration phases advance; update the story catalog in the same implementation work.
