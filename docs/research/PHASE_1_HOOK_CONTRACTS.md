# Phase 1 Hook Contract Research

Checked 2026-11-05 against the current official documentation. The installed Codex and Claude Code versions are not available in this worktree, so local harness results do not prove host lifecycle execution.

## Codex

Source: [Hooks](https://learn.chatgpt.com/docs/hooks).

- `PreCompact` runs before manual or automatic compaction. Its matcher is applied to `trigger` (`manual` or `auto`). Plain stdout is ignored and JSON output supports common hook fields; it is not a context injection point.
- `SessionStart` exposes `source` values `startup`, `resume`, `clear`, `compact` and `fork`. For a compacted root session, Codex runs matching hooks before the next model request. The documentation explicitly includes automatic compaction during a turn and says the returned context reaches the immediate continuation.
- JSON `hookSpecificOutput` with `hookEventName: "SessionStart"` and `additionalContext` is a documented context path. The hook setting `additionalContextLimit` bounds the context budget.
- Command hook timeouts are limited to one through three seconds, so the project adapters use the three-second ceiling.
- Project-local `.codex/` hooks load only for a trusted project. A user reviews and trusts changed non-managed hook definitions in the Codex hook browser (`/hooks`).

## Claude Code

Sources: [Hooks reference](https://code.claude.com/docs/en/hooks) and [Memory](https://code.claude.com/docs/en/memory).

- `PreCompact` runs before manual or automatic compaction and supplies `trigger` and `custom_instructions`. The transcript path is part of its input. `systemMessage` and `continue` are discarded for this event.
- `SessionStart` runs after auto or manual compaction with `source: "compact"`, before the next response. It supports `hookSpecificOutput.additionalContext`, which is injected at the event point and becomes available to the next model request.
- `PostCompact` has no decision/context output. The adapter therefore restores at `SessionStart` and does not persist the transcript or `custom_instructions`.
- Project hooks are configured in the repository's `.claude/settings.json`; `AGENTS.md` is supported as project instruction memory. These are checked-in project settings, not global machine-specific hook installs.

## Open-source comparison

Read-only GitHub repository search and tree inspection on 2026-11-05 compared the official [Anthropic Claude Code](https://github.com/anthropics/claude-code) and [OpenAI Codex](https://github.com/openai/codex) repositories with two active Claude Code hook examples: [claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery) (about 4,000 stars at lookup) and [claude-code-infrastructure-showcase](https://github.com/diet103/claude-code-infrastructure-showcase) (about 10,000 stars). The examples keep hook definitions and scripts project-scoped under `.claude/`; the second also carries `.codex/` configuration. Their READMEs describe broad lifecycle automation, multiple hook scripts and setup/install flows, rather than a bounded continuation-only adapter.

For this phase, the useful pattern is project-local config with script adapters, while official platform docs remain authoritative for payloads and context injection. The phase implementation deliberately keeps only the selected `PreCompact`/compact `SessionStart` path and a platform-neutral packet utility; no third-party hook code or dependency was copied.

## Implementation evidence and limits

The deterministic harness tests manual and automatic `PreCompact`, compact `SessionStart`, ordinary-startup suppression, missing/malformed/stale packets, secret-like data rejection and output shape for both adapters. It exercises contract-shaped JSON locally; it does not invoke an installed host, generate a real compact summary, or prove that the host loaded/trusted its project settings. `PreCompact` updates only checkpoint metadata on the already-authored packet. It does not extract model state, raw transcript text or credentials.
