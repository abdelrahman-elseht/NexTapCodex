import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const MAX_PACKET_BYTES = 52 * 1024;
const MAX_OUTPUT_BYTES = 5000;
const TIMEOUT_MS = 18000;
const MODEL = 'gpt-6.1-terra';

function runCodex(prompt, { cwd, timeoutMs = TIMEOUT_MS, outputLimit = MAX_OUTPUT_BYTES } = {}) {
  return new Promise((resolve) => {
    const responseFile = path.join(cwd, 'terra-response.txt');
    const child = spawn('codex', [
      'exec', '--ephemeral', '--disable', 'hooks', '--sandbox', 'read-only',
      '--skip-git-repo-check', '--model', MODEL, '-c', 'model_reasoning_effort=low',
      '--output-last-message', responseFile, '-',
    ], { cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const output = [];
    let bytes = 0;
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 500).unref();
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes <= outputLimit) output.push(chunk);
      else child.kill('SIGTERM');
    });
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 1000) stderr += chunk.toString('utf8').slice(0, 1000 - stderr.length);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ code: null, output: '', error: error.message });
    });
    child.on('close', async (code) => {
      clearTimeout(timer);
      let finalOutput = '';
      try { finalOutput = await readFile(responseFile, 'utf8'); } catch { /* handled as unavailable below */ }
      resolve({ code, output: finalOutput.slice(0, outputLimit), stderr, timedOut, overflow: Buffer.byteLength(finalOutput) > outputLimit || bytes > outputLimit });
    });
    child.stdin.end(prompt);
  });
}

export async function reviewTerraCandidate(packet, { tempRoot = os.tmpdir(), timeoutMs = TIMEOUT_MS, runner = runCodex } = {}) {
  if (typeof packet !== 'string' || Buffer.byteLength(packet) > MAX_PACKET_BYTES) {
    return { status: 'unavailable', reason: 'review packet exceeded the input limit' };
  }
  let directory;
  try {
    directory = await mkdtemp(path.join(tempRoot, 'nextap-terra-review-'));
    await writeFile(path.join(directory, 'review-packet.txt'), packet, { mode: 0o600 });
    const prompt = [
      'Review only the bounded packet supplied on stdin. Do not inspect files, use network tools, or infer facts beyond it.',
      'Review the exact session patches against supplied AGENTS.md and the selected authoritative project guidance. Follow the repository instructions for architecture, migration phase, testing, UX, agent experience, and developer experience. For new or changed shared behavior, check whether an existing catalogued function/component should be reused; when a stable reusable interface is added or changed, require its catalog entry and focused verification. For a resolved reusable issue/blocker, require a KNOWN_ISSUES entry with verified symptom, cause, solution, and regression guard; uncertain causes must be labeled open. Check concrete contract conflicts, ownership/placement drift, missing focused tests, omitted required documentation, and violations of explicit repository guidance. Apply the Cloudflare PRD only when the patch concerns that migration; preserve legacy behavior where compatibility requires it.',
      'Report only actionable findings supported by a specific patch and supplied reference. If guidance conflicts or evidence is incomplete, say so without guessing. Return either exactly `PASS` or a concise list of findings with file and document/section references. Findings are advisory; never claim a test passed.',
      '', packet,
    ].join('\n');
    const result = await runner(prompt, { cwd: directory, timeoutMs, outputLimit: MAX_OUTPUT_BYTES });
    if (result.error) return { status: 'unavailable', reason: 'Codex CLI could not start' };
    if (result.timedOut) return { status: 'unavailable', reason: 'Terra review exceeded the time limit' };
    if (result.overflow) return { status: 'unavailable', reason: 'Terra output exceeded the limit' };
    if (result.code !== 0) return { status: 'unavailable', reason: 'Terra model/provider was unavailable' };
    const text = result.output.trim().slice(0, 3500);
    if (!text) return { status: 'unavailable', reason: 'Terra returned no review text' };
    const pass = text === 'PASS';
    return { status: pass ? 'passed' : 'findings', text };
  } catch {
    return { status: 'unavailable', reason: 'Terra review setup failed' };
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}

export async function codexRunner(prompt, options = {}) {
  return runCodex(prompt, options);
}

function main() {
  const packetFile = process.argv[2];
  if (!packetFile) {
    process.stdout.write('Terra review unavailable: provide a bounded packet file.\n');
    process.exitCode = 2;
    return;
  }
  readFile(packetFile, 'utf8').then(reviewTerraCandidate).then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.status === 'unavailable') process.exitCode = 1;
  }).catch(() => {
    process.stdout.write(`${JSON.stringify({ status: 'unavailable', reason: 'review packet could not be read' })}\n`);
    process.exitCode = 1;
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
