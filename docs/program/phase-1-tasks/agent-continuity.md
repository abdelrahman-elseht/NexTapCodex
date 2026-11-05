# Task 1.6: Agent Continuity and Review Guardrails

## Contract

Create one compact, secret-free continuation packet; make platform-neutral checks authoritative; add only thin Codex and Claude Code adapters supported by current event contracts. Use the selected `clean-code-guard`, `test-guard` and `docs-guard` skills as reactive review guidance where each diff requires it.

## Read first

- Accepted `docs/CODEBOOK.md`, Task 1.3 checks, `.github/pull_request_template.md`, `scripts/ci/self-review.mjs`, and actual workflow files.
- Current official Codex hook contract: https://learn.chatgpt.com/docs/hooks
- Current official Claude Code hook contracts: https://code.claude.com/docs/en/hooks and https://code.claude.com/docs/en/memory; verified findings are summarized in [`docs/research/PHASE_1_HOOK_CONTRACTS.md`](../../research/PHASE_1_HOOK_CONTRACTS.md).
- Current selected skill instructions, when applicable: `clean-code-guard/SKILL.md`, `test-guard/SKILL.md`, `docs-guard/SKILL.md`.
- Prior research is indexed in `../RESEARCH_APPENDIX.md`; recheck version-sensitive event behavior.

## Work

1. Define a small task packet schema containing objective, owner decisions/constraints, worktree/base SHA, reviewed files, changed files, checks, unresolved items and exact next action. Never store credentials, secrets, customer content or raw transcripts.
2. Add a platform-neutral validate/save/restore command or script with deterministic tests. It should reject secret-like content and malformed/stale data without printing the packet contents to logs.
3. Implement Codex `PreCompact` persistence and `SessionStart` restoration only for `source=compact`; return `additionalContext` at the documented supported injection point. Keep unrelated startup context unloaded.
4. Implement Claude `PreCompact` checkpoint persistence and `SessionStart(source=compact)` restoration only for fields the current documented contract supports. `PreCompact` discards `systemMessage`/`continue`; `SessionStart` supports `hookSpecificOutput.additionalContext`. Do not persist `custom_instructions` or transcript content. Record that host execution is unverified when no Claude host is available.
5. Add only minimal adapter config/commands. Do not install global machine-specific hooks; keep repository files portable and project-scoped.
6. Test exact input/output payloads, missing packet, malformed packet, automatic mid-turn compaction and resumed-session behavior. If the environment cannot invoke a host lifecycle, provide a deterministic adapter-contract harness and mark real host behavior unverified.
7. Apply selected guard skills reactively: clean-code review for production changes, test-guard for changed tests, docs-guard for changed docs. They are reviewer guidance, not CI commands or lifecycle hooks.

## Guardrails

- Plain Codex `PreCompact` stdout is ignored; recovery belongs in `SessionStart(source=compact)` `additionalContext`.
- Claude `PreCompact` discards `systemMessage` and `continue`; restore through the documented `SessionStart(source=compact)` context output, not `PostCompact` summary availability.
- Hooks are not an OS security boundary, authorization mechanism or substitute for CI.
- Keep save operations atomic, bounded in size, scoped to the current repository/task, and tolerant of absent session environment.
- Do not install unrelated skills or WordPress/WooCommerce guards.

## Acceptance

- Continuation note is short, durable, secret-free, schema-validated and points to authoritative files rather than copying them.
- Codex save/restore contract passes for manual/automatic compaction and compact resume, or host limitation is explicitly evidenced.
- Claude behavior is reported precisely: checkpoint before compaction and inject only through the demonstrated `SessionStart` output path; host-version execution stays marked unverified unless a host run is available.
- Hook checks are thin adapters to platform-neutral commands and do not block normal local edits.
- Selected review skills are applied to relevant changed artifacts; CI remains deterministic.

## Gate

G6 in root `GATES.md`.

## Verification record (2026-11-05)

- `npm test`: continuation packet and adapter contract cases pass for Codex and Claude-shaped payloads, both `manual` and `auto` `PreCompact`, `SessionStart(source=compact)`, ordinary-startup suppression, missing/malformed/stale/secret-like packets, output shape and compact restore.
- `npm run continuity:validate`: packet status is `valid`.
- Official docs reviewed: Codex Hooks; Claude Code Hooks and Memory. Findings and the absence of installed-host/version evidence are in [`PHASE_1_HOOK_CONTRACTS.md`](../../research/PHASE_1_HOOK_CONTRACTS.md). Real Codex/Claude hook loading, project trust and host execution remain unverified.
- Guard review outcomes: `clean-code-guard: clean` for the scoped extraction and adapters; `test-guard: clean` for behavior-focused, contract-shaped tests; `docs-guard: clean` after source/path and hook-contract link checks. These remain reviewer guidance, not CI lifecycle hooks.
- G6 is complete with the explicit host limitation recorded. No global hooks or external project settings were changed.

## Integration durability repair

CI now runs `node scripts/continuity/continuation.mjs validate-contract`, checking schema, date formats, bounded size and secret-like content without requiring a historical session to stay fresh. Ordinary `continuity:validate`, save, restore and hooks still enforce session freshness. Child-process tests supply a controlled clock and verify that the committed packet remains contract-valid after its expiry while actual session validation returns `stale`. Current outputs are in the [integration repair index](../../../reports/phase1-integration-repair/README.md).
