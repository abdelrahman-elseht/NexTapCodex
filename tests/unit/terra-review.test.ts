import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { reviewTerraCandidate } from '../../scripts/quality/terra-review.mjs';

describe('Terra advisory review', () => {
  it('uses bounded ephemeral packet input and reports successful review', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'terra-test-'));
    const runner = vi.fn(async (prompt, options) => {
      expect(prompt).toContain('KNOWN_ISSUES entry');
      expect(options.timeoutMs).toBeGreaterThan(0);
      const files = await readdir(options.cwd);
      expect(files).toEqual(['review-packet.txt']);
      expect(path.dirname(options.cwd)).toBe(tempRoot);
      expect((await stat(options.cwd)).mode & 0o777).toBe(0o700);
      return { code: 0, output: 'PASS', stderr: '', timedOut: false, overflow: false };
    });
    try {
      await expect(reviewTerraCandidate('bounded synthetic review packet', { tempRoot, runner })).resolves.toMatchObject({ status: 'passed', text: 'PASS' });
      expect(runner).toHaveBeenCalledOnce();
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('reports missing model/provider and timeout as unavailable, without treating them as passes', async () => {
    const unavailable = await reviewTerraCandidate('packet', { runner: vi.fn(async () => ({ code: 1, output: '', stderr: 'no auth', timedOut: false, overflow: false })) });
    const timedOut = await reviewTerraCandidate('packet', { runner: vi.fn(async () => ({ code: null, output: '', timedOut: true, overflow: false })) });
    expect(unavailable).toMatchObject({ status: 'unavailable' });
    expect(timedOut).toMatchObject({ status: 'unavailable', reason: expect.stringContaining('time limit') });
  });

  it('treats anything beyond the exact PASS response as findings', async () => {
    const runner = vi.fn(async () => ({ code: 0, output: 'PASS\nNo concerns.', stderr: '', timedOut: false, overflow: false }));
    await expect(reviewTerraCandidate('packet', { runner })).resolves.toMatchObject({ status: 'findings', text: 'PASS\nNo concerns.' });
  });

  it('rejects oversized packets and never includes them in unavailable output', async () => {
    const packet = 'private'.repeat(8000);
    const runner = vi.fn();
    await expect(reviewTerraCandidate(packet, { runner })).resolves.toMatchObject({ status: 'unavailable' });
    expect(runner).not.toHaveBeenCalled();
  });
});
