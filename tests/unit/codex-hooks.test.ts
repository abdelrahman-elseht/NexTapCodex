import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { dispatchContinuityEvent, summarizeGitStatus } from '../../scripts/quality/codex-hooks.mjs';
import {
  finalizeHandoff,
  formatContext,
  parseEvent,
  prepareCheckpoint,
  readCheckpoint,
  readLatestHandoff,
  validateCheckpoint,
  worktreeId,
} from '../../scripts/quality/session-state.mjs';

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe('Codex hook continuity state', () => {
  it('keeps project hook config to supported bounded command events', async () => {
    const config = JSON.parse(await readFile('.codex/hooks.json', 'utf8')) as {
      hooks: Record<string, Array<{ matcher?: string; hooks: Array<{ type: string; timeout: number; command: string; async?: boolean }> }>>;
    };
    expect(Object.keys(config.hooks).sort()).toEqual(['PostCompact', 'PostToolUse', 'PreCompact', 'SessionEnd', 'SessionStart', 'Stop']);
    for (const handlers of Object.values(config.hooks)) {
      for (const handler of handlers) {
        expect(handler.hooks).toHaveLength(1);
        expect(handler.hooks[0].type).toBe('command');
        expect(handler.hooks[0].timeout).toBeLessThanOrEqual(90);
      }
    }
    expect(config.hooks.SessionEnd[0].hooks[0].timeout).toBe(3);
    const postToolHandlers = config.hooks.PostToolUse.flatMap((entry) => entry.hooks);
    expect(postToolHandlers).toHaveLength(1);
    expect(config.hooks.PostToolUse.every((entry) => entry.matcher === 'apply_patch|Edit|Write')).toBe(true);
    expect(postToolHandlers.find((handler) => handler.command.includes('session-review.mjs'))?.timeout).toBe(3);
    expect(config.hooks.Stop[0].hooks[0].command).toContain('scripts/quality/codex-hooks.mjs Stop');
    expect(config.hooks.Stop[0].hooks[0].timeout).toBe(90);
  });

  it('bounds and validates event JSON', () => {
    expect(parseEvent('{"session_id":"safe_1"}')).toEqual({ session_id: 'safe_1' });
    expect(() => parseEvent('x'.repeat(33 * 1024))).toThrow(/input limit/);
    expect(() => parseEvent('[]')).toThrow(/JSON object/);
  });

  it('rejects unexpected, oversized, secret-like, and cross-worktree checkpoint data', () => {
    const base = { sessionId: 'session_1', worktreeId: worktreeId(), task: 'Foundation update' };
    expect(validateCheckpoint(base).version).toBe(1);
    expect(() => validateCheckpoint({ ...base, password: 'private' })).toThrow(/Unsupported/);
    expect(() => validateCheckpoint({ ...base, task: 'CLOUDFLARE_API_TOKEN=private' })).toThrow(/credential/);
    expect(() => validateCheckpoint({ ...base, task: 'x'.repeat(1201) })).toThrow(/exceeds/);
    expect(() => validateCheckpoint({ ...base, worktreeId: 'another-tree' })).toThrow(/different worktree/);
    expect(() => validateCheckpoint({ ...base, changedPaths: ['../outside'] })).toThrow(/repository-relative/);
    expect(() => validateCheckpoint({ ...base, fileRefs: ['C:\\private\\notes.md'] })).toThrow(/repository-relative/);
  });

  it('writes checkpoints atomically and finalizes only matching worktree state', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'nextap-hooks-'));
    const root = path.join(tempDir, 'repo');
    const stateDir = path.join(tempDir, 'state');
    const checkpoint = await prepareCheckpoint({
      sessionId: 'session_2', worktreeId: worktreeId(root), task: 'Add hook continuity',
      branch: 'feature/foundation', gitSummary: '3 modified files; 2 staged, 1 unstaged.',
      currentState: 'Dispatcher fixtures are being added.',
      completed: ['Validate event payload'], nextSteps: ['Review activation separately'],
      changedPaths: ['scripts/quality/session-state.mjs'],
      checkResults: ['npm test -- tests/unit/codex-hooks.test.ts passed'],
      fileRefs: ['docs/TESTING.md'],
    }, { root, stateDir });
    expect(await readCheckpoint('session_2', { root, stateDir })).toMatchObject(checkpoint);
    const memory = await readFile(path.join(root, 'AGENT_MEMORY.md'), 'utf8');
    expect(memory).toContain('Task: Add hook continuity');
    expect(memory).toContain('Next action: Review activation separately');
    expect(memory).toContain('Key paths: docs/TESTING.md');
    expect(memory).not.toContain('scripts/quality/session-state.mjs');
    expect(memory).not.toContain('Relevant paths:');
    expect(Buffer.byteLength(memory)).toBeLessThanOrEqual(2048);
    expect(memory.split(/\r?\n/).filter(Boolean).length).toBeLessThanOrEqual(20);
    expect(await finalizeHandoff('session_2', { root, stateDir })).toMatchObject({ task: 'Add hook continuity' });
    expect(await readLatestHandoff({ root, stateDir })).toMatchObject({ sessionId: 'session_2' });
    expect(JSON.parse(await readFile(path.join(stateDir, 'latest-handoff.json'), 'utf8')).finalizedAt).toBeTruthy();
    expect(await finalizeHandoff('missing', { root, stateDir })).toBeNull();
    expect(await readLatestHandoff({ root: `${root}-other`, stateDir })).toBeNull();
  });

  it('renders only the bounded continuation memory and handoff fields', () => {
    const context = formatContext('Current unfinished task and next action', {
      task: 'Implement hooks', branch: 'feature/foundation',
      gitSummary: '2 modified files.', currentState: 'Checkpoint restore is covered.',
      completed: ['Tests pass'], decisions: [], nextSteps: ['Review'], blockers: [],
      changedPaths: ['scripts/quality/session-state.mjs'],
      checkResults: ['unit tests pass'], fileRefs: ['docs/TESTING.md'],
    }, 'session_3');
    expect(context).toContain('Current Codex session ID: session_3');
    expect(context).toContain('AGENT_MEMORY.md (latest task continuation; resume if unfinished)');
    expect(context).toContain('Current unfinished task and next action');
    expect(context).toContain('Latest local continuation');
    expect(context).not.toContain('transcript');
    expect(context).toContain('Current state:');
    expect(context).toContain('Branch: feature/foundation');
    expect(context).toContain('Git state: 2 modified files.');
    expect(context).toContain('Changed paths:');
    expect(context).toContain('Checks:');
    expect(context).toContain('File references:');
  });

  it('summarizes current Git state without exposing changed paths', () => {
    const summary = summarizeGitStatus('## feature/hooks...origin/feature/hooks\n M docs/TESTING.md\nA  scripts/quality/codex-hooks.mjs\n?? notes.txt\n');
    expect(summary).toBe('Branch: feature/hooks\nWorking tree: 3 changed file(s) (1 staged, 1 unstaged, 1 untracked).');
    expect(summary).not.toContain('docs/TESTING.md');
    expect(summarizeGitStatus('not git status output')).toBe('');
  });

  it('ignores stale and malformed checkpoint state', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'nextap-hooks-stale-'));
    const root = path.join(tempDir, 'repo');
    const stateDir = path.join(tempDir, 'state');
    await prepareCheckpoint({ sessionId: 'session_stale', worktreeId: worktreeId(root), task: 'Stale checkpoint' }, { root, stateDir });
    const filename = path.join(stateDir, 'checkpoint-session_stale.json');
    const state = JSON.parse(await readFile(filename, 'utf8'));
    state.updatedAt = '2000-01-01T00:00:00.000Z';
    await writeFile(filename, JSON.stringify(state));
    expect(await readCheckpoint('session_stale', { root, stateDir })).toBeNull();
    expect(await dispatchContinuityEvent('PreCompact', {
      cwd: root, session_id: 'session_stale',
    }, { root, stateDir })).toMatchObject({ warning: expect.stringContaining('No fresh task checkpoint') });

    state.updatedAt = '2999-01-01T00:00:00.000Z';
    await writeFile(filename, JSON.stringify(state));
    expect(await readCheckpoint('session_stale', { root, stateDir })).toBeNull();

    await writeFile(filename, '{not-json');
    expect(await readCheckpoint('session_stale', { root, stateDir })).toBeNull();
  });

  it('restores a fresh checkpoint after compaction and warns rather than inventing a handoff', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'nextap-hooks-events-'));
    const root = path.join(tempDir, 'repo');
    const stateDir = path.join(tempDir, 'state');
    await mkdir(root, { recursive: true });
    await prepareCheckpoint({
      sessionId: 'session_events', worktreeId: worktreeId(root), task: 'Restore context',
      currentState: 'Waiting on parent verification.', nextSteps: ['Run the parent verification'],
      changedPaths: ['scripts/quality/session-state.mjs'],
    }, { root, stateDir });

    const restored = await dispatchContinuityEvent('PostCompact', {
      cwd: root, session_id: 'session_events',
    }, { root, stateDir });
    expect(restored).toMatchObject({
      hookSpecificOutput: { additionalContext: expect.stringContaining('Next action: Run the parent verification') },
    });
    expect(JSON.stringify(restored)).toContain('Waiting on parent verification.');
    expect(await dispatchContinuityEvent('PreCompact', {
      cwd: root, session_id: 'session_events',
    }, { root, stateDir })).toBeNull();
    expect(await dispatchContinuityEvent('SessionEnd', {
      cwd: root, session_id: 'session_missing',
    }, { root, stateDir })).toMatchObject({ warning: expect.stringContaining('no session handoff was created') });
    expect(await readLatestHandoff({ root, stateDir })).toBeNull();

    const ended = await dispatchContinuityEvent('SessionEnd', {
      cwd: root, session_id: 'session_events',
    }, { root, stateDir });
    expect(ended).toBeNull();
    expect(await readLatestHandoff({ root, stateDir })).toMatchObject({ task: 'Restore context' });
  });

  it('loads a worktree-matched handoff on SessionStart and ignores a foreign cwd', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'nextap-hooks-start-'));
    const root = path.join(tempDir, 'repo');
    const stateDir = path.join(tempDir, 'state');
    await prepareCheckpoint({
      sessionId: 'session_start', worktreeId: worktreeId(root), task: 'Resume task',
      changedPaths: ['docs/TESTING.md'],
    }, { root, stateDir });
    await finalizeHandoff('session_start', { root, stateDir });
    const started = await dispatchContinuityEvent('SessionStart', {
      cwd: root, session_id: 'session_next',
    }, { root, stateDir, memory: 'Curated project memory.', repositoryState: 'Branch: feature/session-start\nWorking tree: clean.' });
    expect(started).toMatchObject({
      hookSpecificOutput: {
        additionalContext: expect.stringContaining('Curated project memory.'),
      },
    });
    expect(JSON.stringify(started)).toContain('Changed paths:');
    expect(JSON.stringify(started)).toContain('Current repository state:');
    expect(JSON.stringify(started)).toContain('Branch: feature/session-start');
    expect(await dispatchContinuityEvent('SessionStart', {
      cwd: `${root}-elsewhere`, session_id: 'session_next',
    }, { root, stateDir, memory: 'Must not load.' })).toBeNull();

    const handoffFile = path.join(stateDir, 'latest-handoff.json');
    const handoff = JSON.parse(await readFile(handoffFile, 'utf8'));
    handoff.finalizedAt = '2000-01-01T00:00:00.000Z';
    await writeFile(handoffFile, JSON.stringify(handoff));
    expect(await readLatestHandoff({ root, stateDir })).toBeNull();
    await writeFile(handoffFile, '{not-json');
    expect(await readLatestHandoff({ root, stateDir })).toBeNull();
  });
});
