import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { autoCommitSessionChanges, captureSessionBaseline, handleStopEvent, readSessionCandidate, recordSessionEdit } from '../../scripts/quality/session-review.mjs';

let stateDir: string | undefined;
let fixtureDir: string | undefined;

afterEach(async () => {
  if (stateDir) await rm(stateDir, { recursive: true, force: true });
  if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true });
  stateDir = undefined;
  fixtureDir = undefined;
});

async function cleanGitFixture() {
  fixtureDir = await mkdtemp(path.join(os.tmpdir(), 'nextap-auto-commit-'));
  const root = path.join(fixtureDir, 'repo');
  stateDir = path.join(fixtureDir, 'state');
  await mkdir(path.join(root, 'src', 'app'), { recursive: true });
  await mkdir(path.join(root, 'docs', 'specs'), { recursive: true });
  execFileSync('git', ['init', '--quiet', '-b', 'main', root]);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Codex Test']);
  execFileSync('git', ['-C', root, 'config', 'user.email', 'codex-test@example.invalid']);
  await writeFile(path.join(root, 'src', 'app', 'page.tsx'), 'export default function Page() { return null; }\n');
  await writeFile(path.join(root, 'docs', 'STORY_ROUTING.json'), JSON.stringify({
    version: 2,
    tracks: ['legacy-baseline', 'cloudflare-target', 'quality-only'],
    rules: [],
  }));
  await writeFile(path.join(root, 'AGENTS.md'), '# Fixture agent rules\n');
  await writeFile(path.join(root, 'docs', 'COMPONENTS.md'), '# Fixture component catalog\n');
  await writeFile(path.join(root, 'docs', 'KNOWN_ISSUES.md'), '# Fixture issue log\n');
  await writeFile(path.join(root, 'docs', 'TESTING.md'), '# Fixture testing guide\n');
  await mkdir(path.join(root, 'docs', 'known-issues'), { recursive: true });
  await writeFile(path.join(root, 'docs', 'known-issues', 'tooling-and-hooks.md'), '# Fixture tooling issues\n');
  await writeFile(path.join(root, 'docs', 'known-issues', 'test-runner.md'), '# Fixture test runner issues\n');
  await mkdir(path.join(root, 'docs', 'functions-components'), { recursive: true });
  await writeFile(path.join(root, 'docs', 'functions-components', 'README.md'), '# Fixture shared interface catalog\n');
  await writeFile(path.join(root, 'docs', 'specs', 'USER_ADMIN_STORIES.md'), '# Fixture story catalog\n');
  execFileSync('git', ['-C', root, 'add', '--', 'src/app/page.tsx', 'AGENTS.md', 'docs']);
  execFileSync('git', ['-C', root, 'commit', '--quiet', '-m', 'initial']);
  return root;
}

async function terraReviewFixture() {
  fixtureDir = await mkdtemp(path.join(os.tmpdir(), 'nextap-terra-fixture-'));
  const root = path.join(fixtureDir, 'repo');
  stateDir = await mkdtemp(path.join(os.tmpdir(), 'nextap-terra-state-'));
  await mkdir(path.join(root, 'docs', 'specs'), { recursive: true });
  await writeFile(path.join(root, 'CODEBOOK.md'), '# Test Codebook\n');
  await writeFile(path.join(root, 'docs', 'ARCHITECTURE.md'), [
    '---', 'Path globs: ["workers/**", "infra/cloudflare/**"]', '---', '# Test Architecture',
  ].join('\n'));
  await writeFile(path.join(root, 'docs', 'specs', 'NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md'), [
    '---', 'Path globs: ["workers/**", "infra/cloudflare/**"]', '---', '# Test Migration Contract',
  ].join('\n'));
  await writeFile(path.join(root, 'docs', 'README.md'), [
    '[Architecture](ARCHITECTURE.md)',
    '[Migration PRD](specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md)',
  ].join('\n'));
  await writeFile(path.join(root, 'docs', 'STORY_ROUTING.json'), JSON.stringify({
    version: 2,
    tracks: ['legacy-baseline', 'cloudflare-target', 'quality-only'],
    rules: [{
      id: 'cloudflare-public-delivery',
      track: 'cloudflare-target',
      paths: ['workers/**', 'infra/cloudflare/**'],
      stories: ['MIG-01'],
    }],
  }));
  await writeFile(path.join(root, 'docs', 'specs', 'USER_ADMIN_STORIES.md'), '# Fixture story catalog\n');
  execFileSync('git', ['init', '--quiet', '-b', 'main', root]);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Codex Test']);
  execFileSync('git', ['-C', root, 'config', 'user.email', 'codex-test@example.invalid']);
  execFileSync('git', ['-C', root, 'add', '--', 'CODEBOOK.md', 'docs']);
  execFileSync('git', ['-C', root, 'commit', '--quiet', '-m', 'initial']);
  return root;
}

function commitCandidate() {
  return { paths: ['src/app/page.tsx'], exactPatch: true, patch: 'exact safe patch', notes: [], containsContact: false };
}

function passingEvaluation(overrides = {}) {
  return { failures: [], checksPassed: true, checkMessages: ['eslint: passed'], reviewReason: '', terraResult: '', ...overrides };
}

describe('session candidate review', () => {
  it('records only attributable edit events and keeps patches redacted', async () => {
    stateDir = await mkdtemp(path.join(os.tmpdir(), 'nextap-review-ledger-'));
    const root = process.cwd();
    await recordSessionEdit({
      cwd: root,
      session_id: 'review_session',
      tool_use_id: 'tool_1',
      tool_name: 'apply_patch',
      tool_input: {
        command: '*** Begin Patch\n*** Update File: workers/public/profile.ts\n+const token = "private-token-value";\n*** End Patch',
      },
    }, { root, stateDir });

    const candidate = await readSessionCandidate('review_session', { root, stateDir });
    expect(candidate?.paths).toEqual(['workers/public/profile.ts']);
    expect(candidate?.exactPatch).toBe(true);
    expect(candidate?.patch).not.toContain('private-token-value');
  });

  it('blocks once for deterministic failures and does not loop after Stop already continued', async () => {
    const root = await cleanGitFixture();
    const event = { cwd: root, session_id: 'stop_session' };
    await captureSessionBaseline(event, { root, stateDir });
    await recordSessionEdit({
      cwd: root,
      session_id: 'stop_session',
      tool_use_id: 'tool_2',
      tool_name: 'Edit',
      tool_input: { file_path: 'src/app/page.tsx' },
    }, { root, stateDir });
    const fastChecks = vi.fn()
      .mockResolvedValueOnce(['architecture: failed (forbidden import)'])
      .mockResolvedValueOnce(['architecture: failed (forbidden import)'])
      .mockResolvedValueOnce(['eslint: passed']);

    const first = await handleStopEvent(event, { root, stateDir, fastChecks });
    expect(first).toMatchObject({ decision: 'block', reason: expect.stringContaining('architecture: failed') });

    const retry = await handleStopEvent({ ...event, stop_hook_active: true }, { root, stateDir, fastChecks });
    expect(retry).toMatchObject({ decision: 'block', reason: expect.stringContaining('architecture: failed') });

    const passed = await handleStopEvent({ ...event, stop_hook_active: true }, { root, stateDir, fastChecks });
    expect(passed?.decision).toBeUndefined();
    expect(passed?.systemMessage).toContain('eslint: passed');
  });

  it('blocks Stop when a Bash-only worktree change has no edit-ledger entry', async () => {
    const root = await cleanGitFixture();
    const event = { cwd: root, session_id: 'untracked_bash_edit' };
    await captureSessionBaseline(event, { root, stateDir });
    await writeFile(path.join(root, 'README.md'), 'Bash-only change\n');

    const result = await handleStopEvent(event, { root, stateDir, fastChecks: async () => [] });

    expect(result?.decision).toBe('block');
    expect(result?.reason).toContain('README.md');
    expect(result?.reason).toContain('not captured by the edit ledger');
  });

  it('blocks Stop when a recorded file changes again after its edit event', async () => {
    const root = await cleanGitFixture();
    const event = { cwd: root, session_id: 'same_path_drift' };
    await captureSessionBaseline(event, { root, stateDir });
    const pagePath = path.join(root, 'src', 'app', 'page.tsx');
    await writeFile(pagePath, 'export default function Page() { return <main>A</main>; }\n');
    await recordSessionEdit({
      ...event,
      tool_use_id: 'recorded_edit',
      tool_name: 'apply_patch',
      tool_input: { command: '*** Begin Patch\n*** Update File: src/app/page.tsx\n-A\n+B\n*** End Patch' },
    }, { root, stateDir });
    await writeFile(pagePath, 'export default function Page() { return <main>Later Bash change</main>; }\n');

    const result = await handleStopEvent(event, { root, stateDir, fastChecks: async () => ['eslint: passed'] });

    expect(result?.decision).toBe('block');
    expect(result?.reason).toContain('changed after their last recorded edit');
  });

  it('blocks Stop when no valid session baseline exists for dirty worktree state', async () => {
    const root = await cleanGitFixture();
    const event = { cwd: root, session_id: 'missing_baseline' };
    await writeFile(path.join(root, 'src', 'app', 'page.tsx'), 'export default function Page() { return <main />; }\n');

    const result = await handleStopEvent(event, { root, stateDir, fastChecks: async () => ['eslint: passed'] });

    expect(result?.decision).toBe('block');
    expect(result?.reason).toContain('No valid SessionStart baseline');
  });

  it('blocks Stop when edit-ledger event capacity is exceeded', async () => {
    const root = await cleanGitFixture();
    const event = { cwd: root, session_id: 'ledger_overflow' };
    await captureSessionBaseline(event, { root, stateDir });
    const writeEvent = (index: number) => recordSessionEdit({
      ...event,
      tool_use_id: `overflow_${index}`,
      tool_name: 'Write',
      tool_input: { file_path: 'src/app/page.tsx' },
    }, { root, stateDir });
    for (let index = 0; index < 200; index += 1) expect(await writeEvent(index)).toBe(true);
    expect(await writeEvent(200)).toBe(false);

    const result = await handleStopEvent(event, { root, stateDir, fastChecks: async () => ['eslint: passed'] });

    expect(result?.decision).toBe('block');
    expect(result?.reason).toContain('edit ledger is incomplete');
  });

  it('blocks Stop when an edit-ledger record is malformed', async () => {
    const root = await cleanGitFixture();
    const event = { cwd: root, session_id: 'malformed_ledger' };
    await captureSessionBaseline(event, { root, stateDir });
    const ledgerDir = path.join(stateDir!, 'review-ledger', event.session_id);
    await mkdir(ledgerDir, { recursive: true });
    await writeFile(path.join(ledgerDir, 'broken.json'), '{not valid json');

    const result = await handleStopEvent(event, { root, stateDir, fastChecks: async () => [] });

    expect(result?.decision).toBe('block');
    expect(result?.reason).toContain('edit ledger is incomplete');
  });

  it('keeps a high-risk session blocked until the eligible Terra review passes', async () => {
    const root = await terraReviewFixture();
    const event = { cwd: root, session_id: 'terra_session' };
    await captureSessionBaseline(event, { root, stateDir });
    await recordSessionEdit({
      cwd: root,
      session_id: 'terra_session',
      tool_use_id: 'tool_3',
      tool_name: 'apply_patch',
      tool_input: {
        command: '*** Begin Patch\n*** Update File: workers/public/publication.ts\n+export const terraReviewFixture = "findings then pass";\n*** End Patch',
      },
    }, { root, stateDir });
    await recordSessionEdit({
      cwd: root,
      session_id: 'terra_session',
      tool_use_id: 'tool_4',
      tool_name: 'apply_patch',
      tool_input: {
        command: '*** Begin Patch\n*** Update File: infra/cloudflare/wrangler.toml\n+compatibility_flag = true\n*** End Patch',
      },
    }, { root, stateDir });
    const reviewer = vi.fn()
      .mockResolvedValueOnce({ status: 'findings' as const, text: 'Check publication immutability.' })
      .mockResolvedValueOnce({ status: 'passed' as const, text: 'PASS' });

    const first = await handleStopEvent(event, {
      root,
      stateDir,
      fastChecks: async () => [],
      reviewer,
    });

    expect(first?.decision).toBe('block');
    expect(reviewer.mock.calls[0][0]).toContain('CODEBOOK.md');
    expect(reviewer.mock.calls[0][0]).toContain('docs/ARCHITECTURE.md');
    expect(first?.systemMessage).toContain('Terra advisory (findings)');

    const passed = await handleStopEvent({ ...event, stop_hook_active: true }, {
      root,
      stateDir,
      fastChecks: async () => [],
      reviewer,
    });
    expect(passed?.decision).toBeUndefined();
    expect(passed?.systemMessage).toContain('Terra advisory (passed)');
  });

  it('asks the current agent to delegate Terra when its provider is unavailable and skips auto-commit', async () => {
    const root = await terraReviewFixture();
    const event = { cwd: root, session_id: 'terra_fallback_session' };
    await captureSessionBaseline(event, { root, stateDir });
    await recordSessionEdit({
      cwd: root,
      session_id: 'terra_fallback_session',
      tool_use_id: 'tool_6',
      tool_name: 'apply_patch',
      tool_input: {
        command: '*** Begin Patch\n*** Update File: workers/public/publication.ts\n+export const terraProviderOffline = "delegate fallback";\n*** End Patch',
      },
    }, { root, stateDir });
    const reviewer = vi.fn()
      .mockResolvedValueOnce({ status: 'unavailable' as const, reason: 'provider is unavailable' })
      .mockResolvedValueOnce({ status: 'passed' as const, text: 'PASS' });

    const result = await handleStopEvent(event, {
      root,
      stateDir,
      fastChecks: async () => ['eslint: passed'],
      reviewer,
    });

    expect(result?.decision).toBe('block');
    expect(result?.reason).toContain('required Terra review did not pass');
    expect(result?.systemMessage).toContain('delegate this advisory review');
    expect(result?.systemMessage).toContain('gpt-6.1-terra at low effort');
    expect(result?.systemMessage).toContain('Auto-commit skipped: required Terra review did not pass.');

    const passed = await handleStopEvent({ ...event, stop_hook_active: true }, {
      root,
      stateDir,
      fastChecks: async () => ['eslint: passed'],
      reviewer,
    });
    expect(passed?.decision).toBeUndefined();
    expect(passed?.systemMessage).toContain('Terra advisory (passed)');
  });

  it('reviews an isolated source edit against shared-interface and issue-documentation rules', async () => {
    const root = await cleanGitFixture();
    const event = { cwd: root, session_id: 'low_risk_session' };
    await captureSessionBaseline(event, { root, stateDir });
    await recordSessionEdit({
      cwd: root,
      session_id: 'low_risk_session',
      tool_use_id: 'tool_5',
      tool_name: 'apply_patch',
      tool_input: {
        command: '*** Begin Patch\n*** Update File: workers/public/profile.ts\n+export const label = "profile";\n*** End Patch',
      },
    }, { root, stateDir });
    const reviewer = vi.fn(async (packet: string) => {
      expect(packet).toContain('docs/COMPONENTS.md');
      expect(packet).toContain('docs/functions-components/README.md');
      expect(packet).toContain('docs/KNOWN_ISSUES.md');
      expect(packet).toContain('docs/known-issues/tooling-and-hooks.md');
      expect(packet).toContain('docs/known-issues/test-runner.md');
      expect(packet).toContain('docs/TESTING.md');
      expect(packet).toContain('AGENTS.md');
      return { status: 'passed' as const, text: 'PASS' };
    });

    const result = await handleStopEvent(event, {
      root,
      stateDir,
      fastChecks: async () => [],
      reviewer,
    });

    expect(reviewer).toHaveBeenCalledOnce();
    expect(result?.systemMessage).toContain('Terra advisory (passed)');
  });

  it('commits session-attributed changes after checks pass from a clean start', async () => {
    const root = await cleanGitFixture();
    const event = { cwd: root, session_id: 'auto_commit_pass' };
    await captureSessionBaseline(event, { root, stateDir });
    await writeFile(path.join(root, 'src', 'app', 'page.tsx'), 'export default function Page() { return <main />; }\n');

    const result = await autoCommitSessionChanges(commitCandidate(), event, passingEvaluation(), { root, stateDir });

    expect(result).toContain('Auto-commit created:');
    expect(execFileSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' })).toBe('');
    expect(execFileSync('git', ['-C', root, 'log', '-1', '--pretty=%s'], { encoding: 'utf8' }).trim()).toBe('codex: validated session changes');
  });

  it.each([
    { label: 'deterministic checks fail', evaluation: passingEvaluation({ checksPassed: false, failures: ['eslint: failed'] }), reason: 'deterministic review checks failed' },
    { label: 'required Terra review reports findings', evaluation: passingEvaluation({ reviewReason: 'high-risk path', terraResult: 'Terra advisory (findings): review needed' }), reason: 'required Terra review did not pass' },
  ])('does not commit when $label', async ({ evaluation, reason }) => {
    const root = await cleanGitFixture();
    const event = { cwd: root, session_id: 'auto_commit_review_failed' };
    await captureSessionBaseline(event, { root, stateDir });
    await writeFile(path.join(root, 'src', 'app', 'page.tsx'), 'export default function Page() { return <main />; }\n');
    const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

    const result = await autoCommitSessionChanges(commitCandidate(), event, evaluation, { root, stateDir });

    expect(result).toContain(reason);
    expect(execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()).toBe(head);
  });

  it('does not commit a session that started with a dirty worktree', async () => {
    const root = await cleanGitFixture();
    await writeFile(path.join(root, 'README.md'), 'pre-existing user change\n');
    const event = { cwd: root, session_id: 'auto_commit_dirty_start' };
    await captureSessionBaseline(event, { root, stateDir });
    await writeFile(path.join(root, 'src', 'app', 'page.tsx'), 'export default function Page() { return <main />; }\n');

    const result = await autoCommitSessionChanges(commitCandidate(), event, passingEvaluation(), { root, stateDir });

    expect(result).toContain('worktree already had changes at SessionStart');
    expect(execFileSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' })).not.toBe('');
  });

  it('does not commit unrelated files changed after a clean session start', async () => {
    const root = await cleanGitFixture();
    const event = { cwd: root, session_id: 'auto_commit_unrelated' };
    await captureSessionBaseline(event, { root, stateDir });
    await writeFile(path.join(root, 'src', 'app', 'page.tsx'), 'export default function Page() { return <main />; }\n');
    await writeFile(path.join(root, 'README.md'), 'unattributed worktree change\n');

    const result = await autoCommitSessionChanges(commitCandidate(), event, passingEvaluation(), { root, stateDir });

    expect(result).toContain('worktree contains changes outside the exact session edit set');
    expect(execFileSync('git', ['-C', root, 'log', '-1', '--pretty=%s'], { encoding: 'utf8' }).trim()).toBe('initial');
  });
});
