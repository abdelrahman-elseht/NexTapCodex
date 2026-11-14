import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { evaluateCandidate, handlePostToolEvent, hasPersonalContactValue, isAllowedForModelReview, lintChangedFiles, normalizeRepoPath, patchPaths, redact, runFastChecks } from '../../scripts/quality/post-tool-check.mjs';

describe('PostTool migration check', () => {
  const skipFastChecks = async () => [];

  it('ignores non-edit tools and rejects sensitive or out-of-repo paths', async () => {
    expect(await handlePostToolEvent({ tool_name: 'Bash', tool_input: { command: 'git status' } }, { terra: false })).toBeNull();
    expect(normalizeRepoPath('.env.local')).toBeNull();
    expect(normalizeRepoPath('../secrets.txt')).toBeNull();
    expect(normalizeRepoPath('/tmp/private.ts')).toBeNull();
    expect(normalizeRepoPath('.next/cache/file.js')).toBeNull();
    expect(normalizeRepoPath(`${process.cwd()}/workers/public/profile.ts`)).toBe('workers/public/profile.ts');
    expect(normalizeRepoPath('/tmp/nextap-outside/workers/public/profile.ts')).toBeNull();
    expect(normalizeRepoPath('C:\\work\\repo\\workers\\public\\profile.ts')).toBeNull();
  });

  it('extracts only patch file headers and redacts credential-like assignments', () => {
    const patch = [
      '*** Begin Patch',
      '*** Update File: src/app/b/[slug]/page.tsx',
      '+const token = "secret-value";',
      '*** Update File: .env.local',
      '*** End Patch',
    ].join('\n');
    expect(patchPaths(patch)).toEqual(['src/app/b/[slug]/page.tsx']);
    expect(redact('api_key="private" token: abc')).toContain('[REDACTED]');
    expect(redact('password = "a private password with spaces"')).not.toContain('a private password with spaces');
    expect(redact('email a@example.test; phone +20 100 123 4567')).not.toContain('a@example.test');
    expect(redact('email a@example.test; phone +20 100 123 4567')).not.toContain('+20 100 123 4567');
    expect(hasPersonalContactValue('email a@example.test')).toBe(true);
    expect(hasPersonalContactValue('phone +20 100 123 4567')).toBe(true);
    expect(hasPersonalContactValue('ordinary technical identifier 1234567')).toBe(false);
  });

  it('restricts general model review to approved paths; Stop applies a separate source-only allowlist', () => {
    expect(isAllowedForModelReview('workers/public/profile.ts')).toBe(true);
    expect(isAllowedForModelReview('infra/cloudflare/wrangler.toml')).toBe(true);
    expect(isAllowedForModelReview('docs/specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md')).toBe(true);
    expect(isAllowedForModelReview('src/lib/business/publication.ts')).toBe(false);
    expect(isAllowedForModelReview('src/lib/auth/session.ts')).toBe(false);
    expect(isAllowedForModelReview('supabase/migrations/0001.sql')).toBe(false);
    expect(isAllowedForModelReview('tests/e2e/public-journey.e2e.ts')).toBe(false);
  });

  it('keeps deterministic selection for legacy paths but never sends them to Terra', async () => {
    const reviewer = vi.fn();
    const result = await handlePostToolEvent({
      tool_name: 'apply_patch',
      tool_input: { command: '*** Begin Patch\n*** Update File: src/lib/business/publication.ts\n+const token = "synthetic";\n*** End Patch' },
    }, { root: process.cwd(), terra: true, reviewer, fastChecks: skipFastChecks });
    expect(result).toContain('Cloudflare-target check');
    expect(result).toContain('Terra advisory skipped');
    expect(reviewer).not.toHaveBeenCalled();
  });

  it('sends an allowlisted target patch to the injected advisory reviewer', async () => {
    const reviewer = vi.fn(async (packet: string) => ({ status: 'findings', text: `Review complete for ${packet.length} characters.` }));
    const result = await handlePostToolEvent({
      tool_name: 'apply_patch',
      tool_input: { command: '*** Begin Patch\n*** Update File: workers/public/authorization.ts\n+const token = "synthetic";\n*** End Patch' },
    }, { root: process.cwd(), terra: true, reviewer });
    expect(reviewer).toHaveBeenCalledOnce();
    expect(reviewer.mock.calls[0][0]).toContain('Exact session patches');
    expect(reviewer.mock.calls[0][0]).toContain('CODEBOOK.md');
    expect(reviewer.mock.calls[0][0]).toContain('docs/ARCHITECTURE.md');
    expect(reviewer.mock.calls[0][0]).toContain('docs/known-issues/tooling-and-hooks.md');
    expect(result).toContain('Terra advisory (findings)');
  });

  it('fails closed when an allowlisted patch contains email or Egyptian phone-like values', async () => {
    for (const value of ['owner@example.test', '+20 100 123 4567', '010 1234 5678']) {
      const reviewer = vi.fn();
      const result = await handlePostToolEvent({
        tool_name: 'apply_patch',
        tool_input: { command: `*** Begin Patch\n*** Update File: workers/public/profile.ts\n+const contact = "${value}";\n*** End Patch` },
      }, { root: process.cwd(), terra: true, reviewer });
      expect(result).toContain('contains email or phone-like personal contact data');
      expect(result).not.toContain(value);
      expect(reviewer).not.toHaveBeenCalled();
    }
  });

  it('returns selected Cloudflare stories without invoking Terra when disabled', async () => {
    const result = await handlePostToolEvent({
      tool_name: 'apply_patch',
      tool_input: { command: '*** Begin Patch\n*** Update File: src/app/b/[slug]/page.tsx\n+const x = 1;\n*** End Patch' },
    }, { terra: false, root: process.cwd(), fastChecks: skipFastChecks });
    expect(result).toContain('Cloudflare-target check');
    expect(result).toContain('Stories:');
  });

  it.each([
    { messages: ['eslint: passed'], expected: true },
    { messages: ['eslint: unavailable (timed out)'], expected: false },
    { messages: ['docs-index: skipped (no inputs)'], expected: false },
  ])('marks deterministic review results as commit eligible only when checks pass', async ({ messages, expected }) => {
    const evaluation = await evaluateCandidate({
      paths: ['src/app/page.tsx'], patch: '', exactPatch: false, containsContact: false, notes: [],
    }, {
      root: process.cwd(),
      terra: false,
      strictStoryMapping: false,
      fastChecks: async () => messages,
    });

    expect(evaluation?.checksPassed).toBe(expected);
  });

  it('routes absolute in-repo Write paths deterministically and skips Terra without an exact patch', async () => {
    const result = await handlePostToolEvent({
      tool_name: 'Write',
      tool_input: { file_path: `${process.cwd()}/workers/public/profile.ts` },
    }, { root: process.cwd(), fastChecks: skipFastChecks });
    expect(result).toContain('Cloudflare-target check for: workers/public/profile.ts');
    expect(result).not.toContain('Terra advisory');
  });

  it('runs architecture and file-budget checks when requested for structural edits', async () => {
    const calls: string[] = [];
    const messages = await runFastChecks(process.cwd(), ['src/app/page.tsx'], {
      runArchitecture: true,
      runFileBudget: true,
      lint: async (_root: string, paths: string[]) => {
        calls.push(`lint:${paths.join(',')}`);
        return 'eslint: passed (1 changed file, 0 warnings)';
      },
      architecture: () => {
        calls.push('architecture');
        return { ok: true, errors: [] };
      },
      fileBudget: () => {
        calls.push('file-budget');
        return { ok: true, errors: [], warnings: [] };
      },
    });

    expect(calls).toEqual(['lint:src/app/page.tsx', 'architecture', 'file-budget']);
    expect(messages).toEqual([
      'eslint: passed (1 changed file, 0 warnings)',
      'architecture: passed',
      'file-budget: passed',
    ]);
  });

  it('keeps ordinary source edits to changed-file lint', async () => {
    const calls: string[] = [];
    await runFastChecks(process.cwd(), ['src/app/page.tsx'], {
      lint: async () => { calls.push('lint'); return 'eslint: passed'; },
      architecture: () => { calls.push('architecture'); return { ok: true, errors: [] }; },
      fileBudget: () => { calls.push('file-budget'); return { ok: true, errors: [], warnings: [] }; },
    });
    expect(calls).toEqual(['lint']);
  });

  it('runs focused lint without source-wide checks for non-src code edits', async () => {
    const calls: string[] = [];
    const messages = await runFastChecks(process.cwd(), ['scripts/quality/codex-hooks.mjs'], {
      lint: async (_root: string, paths: string[]) => {
        calls.push(`lint:${paths.join(',')}`);
        return 'eslint: passed (1 changed file, 0 warnings)';
      },
      architecture: () => {
        calls.push('architecture');
        return { ok: true, errors: [] };
      },
      fileBudget: () => {
        calls.push('file-budget');
        return { ok: true, errors: [], warnings: [] };
      },
    });

    expect(calls).toEqual(['lint:scripts/quality/codex-hooks.mjs']);
    expect(messages).toEqual(['eslint: passed (1 changed file, 0 warnings)']);
  });

  it('reports a bounded ESLint timeout without blocking the caller', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nextap-post-tool-lint-'));
    try {
      await mkdir(path.join(root, 'src'), { recursive: true });
      await writeFile(path.join(root, 'src/file.ts'), 'export const value = 1;\n');
      const eslint = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
      await mkdir(path.dirname(eslint), { recursive: true });
      await writeFile(eslint, 'setTimeout(() => {}, 60000);\n');

      const result = await lintChangedFiles(root, ['src/file.ts'], { timeoutMs: 5 });

      expect(result).toContain('eslint: unavailable (timed out after 1 seconds)');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('reuses successful deterministic results only while checked inputs are unchanged', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nextap-check-cache-'));
    try {
      await mkdir(path.join(root, 'src'), { recursive: true });
      await writeFile(path.join(root, 'src/example.ts'), 'export const current = true;\n');
      const eslint = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
      await mkdir(path.dirname(eslint), { recursive: true });
      await writeFile(eslint, 'process.exit(0);\n');

      const first = await runFastChecks(root, ['src/example.ts']);
      const reused = await runFastChecks(root, ['src/example.ts']);
      expect(first.some((message) => message.startsWith('eslint: passed'))).toBe(true);
      expect(reused[0]).toContain('reused successful results');

      await writeFile(path.join(root, 'src/example.ts'), 'export const current = false;\n');
      const changed = await runFastChecks(root, ['src/example.ts']);
      expect(changed[0]).not.toContain('reused successful results');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects absolute Edit paths outside the repository', async () => {
    const result = await handlePostToolEvent({
      tool_name: 'Edit',
      tool_input: { file_path: '/tmp/nextap-outside/workers/public/profile.ts' },
    }, { root: process.cwd() });
    expect(result).toContain('edit tool did not provide one safe repository-relative file path');
  });

  it('skips overlarge attributable patches', async () => {
    const result = await handlePostToolEvent({
      tool_name: 'apply_patch',
      tool_input: { command: `*** Begin Patch\n*** Update File: src/app/page.tsx\n${'x'.repeat(25 * 1024)}\n*** End Patch` },
    }, { terra: false });
    expect(result).toContain('exceeded the review input limit');
  });
});
