# Agent Prompt: Set Up Project-Local Codex Hooks

You are the Codex hooks and task-continuity implementation agent for this repository. Inspect the current project and configure a small, reliable, reusable hook system that improves safety, code quality and continuity across ordinary tasks and phases. Treat the lifecycle below as project-wide policy, not as a phase-specific workflow. Do not implement the product feature that happens to be active when this prompt is used.

## Outcome

Leave the repository with appropriate project-local Codex hooks, focused deterministic checks, concise task continuity and evidence that distinguishes configuration, local harness results and real Codex-host behavior. Keep the setup portable, understandable and easy to extend. Hooks should run small scripts and return small messages; they must not invoke a language model or read whole documentation files on every event.

## Discover the current contract

1. Resolve the repository root and inspect the worktree before editing. Preserve tracked and untracked changes. Inspect only the relevant instructions, current `.codex/` configuration, scripts, package commands, and focused tests. Use targeted search and line-scoped reads; follow a documentation pointer only when the active task needs that branch of guidance. Do not create a broad "read first" list or dump whole repositories, architecture documents, task plans or test trees into context.
2. Recheck the current official Codex Hooks and configuration documentation, then check the installed CLI/version and effective project-hook discovery/trust. Use documented event names, matchers, input fields, output forms, timeout limits and loop behavior for that host version. Existing config, examples and synthetic tests are not proof that the active host loaded or ran a hook.
3. Prefer the repository's existing scripts, lint rules, CI commands and continuity format. Make the smallest coherent change. Keep project settings local; do not install global hooks, weaken tool approval, or bypass a trust prompt. Do not copy a third-party hook implementation without checking its current contract.

## Lifecycle contract

Configure only events supported by the current Codex host. Use the following behaviors as the target; explain any event that cannot be configured or verified.

| Event | Required behavior |
| --- | --- |
| `SessionStart` | On ordinary startup/resume, provide at most a short repo/task orientation and a conditional pointer to the one relevant source of truth. On compact resume, restore the bounded checkpoint described below before further work. Keep injected context within a small explicit limit. Never inject complete docs, test inventories or generic instructions on every start. |
| `PreToolUse` | Enforce only narrow, deterministic safety rules before a matched action, such as a clearly prohibited destructive command or a required task-specific precondition. Match the documented tool and payload precisely. Avoid broad denials, duplicate approval prompts and reading policy documents for every tool call. |
| `PostToolUse` | For relevant successful mutations, record concise metadata or invalidate stale verification evidence. Do not rerun full lint, tests, builds or documentation reads after every edit. State clearly that this event runs after the action and cannot undo its effects. Account for writes made through tools the matcher does not observe. |
| `Stop` | If supported, use as a bounded completion gate: detect missing or stale evidence and give one concise next action. Avoid full-suite commands when they exceed the documented hook timeout. Prevent recursive stop-hook loops and repeated identical notices. The agent still runs the required project checks and reports their results. |
| `PreCompact` + `SessionStart(source=compact)` | Save and restore the already-authored bounded checkpoint. Preserve its canonical text exactly; never claim to preserve the whole conversation or private model reasoning. Verify exact text and digest through the supported adapter path. |
| `SessionEnd` | Make a best-effort save of current authored progress when useful. Treat this as a backup only: session-end delivery is not guaranteed and must not be the only checkpoint mechanism. |
| `SubagentStart` / `SubagentStop` | Add only when the current host supports them and they solve a concrete coordination problem, such as isolating a worker's short status or checkpoint. Keep worker state separate and avoid duplicating the coordinator's full context. |

Do not configure an event merely to have a hook for every lifecycle stage. Every hook must have one stated purpose, a narrow matcher, bounded runtime/output and a focused test. If a hook adds no reliable value, leave it out and document why.

## Lint, checks and file budgets

- Keep linting and other quality checks deterministic and owned by the existing project commands. Follow the repository's codebook and its real file classifications and limits; do not copy a second, drifting policy into hook code.
- Use `PostToolUse` to invalidate a check receipt when relevant files change, not to run the full lint or test suite for every tool call. At a stable completion boundary, require the agent to run the applicable lint, typecheck, tests, file-budget checks and build required by repository policy.
- If a fast hook checks receipts, bind each receipt to the exact candidate inputs and command/tool scope. A stale or absent receipt must produce a short actionable message; it must never be reported as a pass. Recheck at completion for writes the hooks may not have observed. CI remains authoritative where configured.
- Hook command timeouts are short. Keep hooks comfortably within the current documented limit, bound output, avoid network calls and expensive scans, and let the agent run long checks directly. Hooks must not auto-fix code, relax rules, suppress diagnostics or silently accept failures.
- Test event adapters with representative documented payloads, including denial, error, missing state, stale evidence and loop cases that apply. Keep tests focused on behavior that changed; do not add redundant tests that simply restate the implementation.

## Task continuity and context budget

- Use the repository's existing continuity mechanism if it is sound. Otherwise add a small, validated, secret-free checkpoint format selected for the active task/session, not hard-coded to a phase. Do not turn checkpoints into a second task/status or ownership database.
- Keep one canonical `VERBATIM_CHECKPOINT` block containing only the information needed to resume: active objective and task identity, accepted decisions/constraints, completed and pending work, changed paths, checks and evidence actually observed, current leases/processes when relevant, and the exact next or interrupted action. Preserve its UTF-8 text byte-for-byte through save and restore; validate identity, size, freshness and a digest. Never store raw transcripts, credentials, customer data or private reasoning.
- Update progress at meaningful accepted milestones and before handoff/compaction. `PreCompact` can save authored notes and observed metadata; it cannot invent missing progress. Restore through the documented compact-resume path. On resume, reconcile the checkpoint with live repository/task state before mutation.
- Keep normal startup context minimal. Emit only the current task identity, a short next-step note, and a conditional path when the task requires it. Read the smallest relevant section or source file only when its trigger applies. Do not put a "read all these files first" instruction in a hook, and do not make each tool call reload docs or the checkpoint unless that event needs the data.
- Never use a hook to invoke an LLM, spawn another agent, or trigger token-consuming tests. A hook may run a deterministic local command; model-backed work happens only when the agent is explicitly assigned it.

## Verification and handoff

Run focused adapter tests and the repository checks required for the configuration/script changes. Observe the actual Codex hook list/trust state and perform a real lifecycle check when the current host makes that available. Do not label a contract-shaped harness as host verification. If a host trust action or lifecycle event is unavailable, finish all local work and report the exact remaining host observation without claiming success.

Before reporting completion, record:

- changed paths and the candidate/worktree identity;
- hooks configured, their purpose/matcher, and which lifecycle behavior was exercised;
- exact commands and results, separating unit/harness, project checks and actual-host evidence;
- continuity round-trip/digest evidence and output bounds;
- limitations or host-only steps that remain.

Completion means every configured hook has a bounded, tested purpose; stale checks cannot masquerade as current; context injection stays concise and conditional; the checkpoint restores exactly within its declared limit; and configured, locally tested and host-observed behavior are clearly distinguished. Do not claim hooks were installed or verified unless the evidence proves it.
