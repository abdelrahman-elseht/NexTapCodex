#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, readFile, readdir, readlink, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluateCandidate, hasPersonalContactValue, patchFromEvent, redact, runFastChecks } from './post-tool-check.mjs';
import { atomicWrite, parseEvent, REPO_ROOT, worktreeId } from './session-state.mjs';

const MAX_REVIEW_EVENTS = 200;
const MAX_SESSION_PATCH_BYTES = 64 * 1024;
const MAX_OUTPUT_BYTES = 4000;
const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;
const TOOL_ID = /^[A-Za-z0-9_-]{1,128}$/;
const AUTO_COMMIT_ADD_TIMEOUT_MS = 1000;
const AUTO_COMMIT_TIMEOUT_MS = 2000;
const GIT_READ_TIMEOUT_MS = 5000;

/** @typedef {(packet: string, options: {root: string, fingerprint: string}) => Promise<{status: 'passed'|'findings'|'unavailable', text?: string, reason?: string}>} CandidateReviewer */
/** @typedef {{root?: string, stateDir?: string, reviewer?: CandidateReviewer, fastChecks?: (root: string, paths: string[]) => Promise<string[]>}} StopReviewOptions */

function isRepositoryCwd(cwd, root) {
  if (typeof cwd !== 'string') return false;
  const relative = path.relative(path.resolve(root), path.resolve(cwd));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function ledgerDirectory(sessionId, stateDir) {
  return path.join(stateDir, 'review-ledger', sessionId);
}

function ledgerIncompletePath(sessionId, stateDir) {
  return path.join(ledgerDirectory(sessionId, stateDir), 'incomplete.json');
}

function baselinePath(sessionId, stateDir) {
  return path.join(stateDir, 'auto-commit-baselines', `${sessionId}.json`);
}

function gitText(root, args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    timeout: GIT_READ_TIMEOUT_MS,
    maxBuffer: 128 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

async function worktreePathState(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const filename = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, filename);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;

  try {
    const before = await lstat(filename);
    let value;
    if (before.isSymbolicLink()) {
      value = `symlink:${await readlink(filename)}`;
    } else if (before.isFile()) {
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(filename)) hash.update(chunk);
      value = `file:${hash.digest('hex')}`;
    } else {
      return null;
    }

    const after = await lstat(filename);
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) return null;
    return value;
  } catch (error) {
    if (error?.code === 'ENOENT') return 'missing';
    return null;
  }
}

async function worktreePathStates(root, paths) {
  const states = {};
  for (const relativePath of [...new Set(paths)].sort()) {
    states[relativePath] = await worktreePathState(root, relativePath);
  }
  return states;
}

function gitBaseline(root) {
  try {
    const status = gitText(root, ['status', '--porcelain=v1', '-z', '--branch', '--untracked-files=all']).split('\0').filter(Boolean);
    const branchLine = status.shift();
    if (!branchLine?.startsWith('## ')) return null;
    const changedPaths = [];
    const pathStatuses = {};
    let ambiguous = false;
    for (const entry of status) {
      const state = entry.slice(0, 2);
      const filename = entry.slice(3);
      changedPaths.push(filename);
      pathStatuses[filename] = state;
      if (state.includes('R') || state.includes('C')) ambiguous = true;
    }
    return {
      branch: branchLine.slice(3).split('...')[0].trim(),
      head: gitText(root, ['rev-parse', 'HEAD']).trim(),
      clean: changedPaths.length === 0 && !ambiguous,
      changedPaths: changedPaths.sort(),
      pathStatuses,
      ambiguous,
    };
  } catch {
    return null;
  }
}

export async function captureSessionBaseline(event, { root = REPO_ROOT, stateDir = path.join(root, '.codex', 'state') } = {}) {
  if (!isRepositoryCwd(event?.cwd, root) || !SESSION_ID.test(event?.session_id ?? '')) return false;
  const filename = baselinePath(event.session_id, stateDir);
  try {
    const current = JSON.parse(await readFile(filename, 'utf8'));
    if (current.version === 2 && current.sessionId === event.session_id && current.worktreeId === worktreeId(root)) return true;
  } catch { /* Capture the first valid baseline for this session. */ }
  const git = gitBaseline(root);
  if (!git || git.ambiguous) return false;
  const pathStates = await worktreePathStates(root, git.changedPaths);
  await atomicWrite(filename, {
    version: 2,
    sessionId: event.session_id,
    worktreeId: worktreeId(root),
    branch: git.branch,
    head: git.head,
    cleanAtStart: git.clean,
    pathStatuses: git.pathStatuses,
    pathStates,
    pathStatesComplete: Object.values(pathStates).every((state) => typeof state === 'string'),
  });
  return true;
}

async function readSessionBaseline(sessionId, root, stateDir) {
  try {
    const stored = JSON.parse(await readFile(baselinePath(sessionId, stateDir), 'utf8'));
    if (stored.version !== 2 || stored.sessionId !== sessionId || stored.worktreeId !== worktreeId(root)) return null;
    if (typeof stored.branch !== 'string' || typeof stored.head !== 'string' || typeof stored.cleanAtStart !== 'boolean') return null;
    if (!stored.pathStatuses || typeof stored.pathStatuses !== 'object' || Array.isArray(stored.pathStatuses) ||
      !stored.pathStates || typeof stored.pathStates !== 'object' || Array.isArray(stored.pathStates) ||
      typeof stored.pathStatesComplete !== 'boolean') return null;
    return stored;
  } catch {
    return null;
  }
}

function autoCommitSkipped(reason) {
  return `Auto-commit skipped: ${reason}.`;
}

export async function autoCommitSessionChanges(candidate, event, evaluation, {
  root = REPO_ROOT,
  stateDir = path.join(root, '.codex', 'state'),
} = {}) {
  if (evaluation.failures?.length) return autoCommitSkipped('deterministic review checks failed');
  if (evaluation.checksPassed !== true) return autoCommitSkipped('one or more required deterministic checks did not pass');
  if (!candidate.exactPatch || candidate.notes.length || candidate.containsContact) {
    return autoCommitSkipped('session edits are not fully attributable and eligible');
  }
  if (evaluation.reviewReason && !/Terra advisory(?:: unchanged candidate already reviewed clean\.| \(passed\):)/.test(evaluation.terraResult ?? '')) {
    return autoCommitSkipped('required Terra review did not pass');
  }

  const baseline = await readSessionBaseline(event.session_id, root, stateDir);
  if (!baseline) return autoCommitSkipped('no valid SessionStart baseline is available');
  if (!baseline.cleanAtStart) return autoCommitSkipped('the worktree already had changes at SessionStart');

  const current = gitBaseline(root);
  if (!current || current.branch !== baseline.branch || current.head !== baseline.head) {
    return autoCommitSkipped('the branch or HEAD changed during the session');
  }
  if (current.ambiguous) return autoCommitSkipped('Git reports an ambiguous rename or copy');
  const changed = current.changedPaths;
  if (!changed.length) return autoCommitSkipped('there are no session changes to commit');
  if (JSON.stringify(changed) !== JSON.stringify(candidate.paths)) {
    return autoCommitSkipped('the worktree contains changes outside the exact session edit set');
  }

  try {
    execFileSync('git', ['-C', root, 'add', '--', ...candidate.paths], {
      encoding: 'utf8', timeout: AUTO_COMMIT_ADD_TIMEOUT_MS, maxBuffer: 16 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    execFileSync('git', ['-C', root, 'commit', '-m', 'codex: validated session changes'], {
      encoding: 'utf8', timeout: AUTO_COMMIT_TIMEOUT_MS, maxBuffer: 16 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const hash = gitText(root, ['rev-parse', '--short', 'HEAD']).trim();
    return `Auto-commit created: ${hash} (codex: validated session changes).`;
  } catch (error) {
    const detail = String(error?.stderr ?? error?.message ?? 'git commit failed').trim().slice(0, 240);
    return `Auto-commit failed: ${detail || 'git commit failed'}.`;
  }
}

function eventKey(event) {
  if (typeof event.tool_use_id === 'string' && TOOL_ID.test(event.tool_use_id)) return event.tool_use_id;
  return createHash('sha256').update(JSON.stringify([event.tool_name, event.tool_input])).digest('hex');
}

async function markLedgerIncomplete(sessionId, root, stateDir, reason) {
  if (!SESSION_ID.test(sessionId ?? '')) return;
  await atomicWrite(ledgerIncompletePath(sessionId, stateDir), {
    version: 1,
    sessionId,
    worktreeId: worktreeId(root),
    reason,
  });
}

async function readLedgerIncomplete(sessionId, root, stateDir) {
  try {
    const value = JSON.parse(await readFile(ledgerIncompletePath(sessionId, stateDir), 'utf8'));
    if (value.version !== 1 || value.sessionId !== sessionId || value.worktreeId !== worktreeId(root) || typeof value.reason !== 'string') return null;
    return value.reason;
  } catch {
    return null;
  }
}

function editRecord(event, candidate, root, key, observedStates) {
  const excluded = candidate.hasExcludedPath === true;
  const patchBytes = typeof candidate.patch === 'string' ? Buffer.byteLength(candidate.patch) : 0;
  const exactPatch = candidate.exactPatch === true && !excluded && !candidate.unavailable && patchBytes <= MAX_SESSION_PATCH_BYTES;
  const containsContact = exactPatch && hasPersonalContactValue(candidate.patch);
  const pathStatesComplete = Object.values(observedStates).every((state) => typeof state === 'string');
  const record = {
    version: 1,
    sessionId: event.session_id,
    worktreeId: worktreeId(root),
    key,
    toolName: event.tool_name,
    paths: candidate.paths,
    exactPatch,
    patch: exactPatch ? redact(candidate.patch) : '',
    observedStates,
    pathStatesComplete,
    containsContact,
    note: excluded ? 'A sensitive or out-of-repository path was included; exact patch content was not retained.'
      : candidate.unavailable ? candidate.unavailable
        : patchBytes > MAX_SESSION_PATCH_BYTES ? 'Patch exceeded the session review ledger limit.' : '',
  };
  return record;
}

export async function recordSessionEdit(event, { root = REPO_ROOT, stateDir = path.join(root, '.codex', 'state') } = {}) {
  if (!isRepositoryCwd(event?.cwd, root) || !SESSION_ID.test(event?.session_id ?? '')) return false;
  if (!['apply_patch', 'Edit', 'Write'].includes(event.tool_name)) return false;
  const candidate = patchFromEvent(event, root);
  if (!candidate?.paths?.length) return false;
  try {
    const directory = ledgerDirectory(event.session_id, stateDir);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if (await readLedgerIncomplete(event.session_id, root, stateDir)) return false;
    const key = eventKey(event);
    const entries = (await readdir(directory)).filter((file) => file.endsWith('.json') && file !== 'incomplete.json');
    if (!entries.includes(`${key}.json`) && entries.length >= MAX_REVIEW_EVENTS) {
      await markLedgerIncomplete(event.session_id, root, stateDir, 'edit event capacity was exceeded');
      return false;
    }
    const observedStates = await worktreePathStates(root, candidate.paths);
    const record = editRecord(event, candidate, root, key, observedStates);
    await atomicWrite(path.join(directory, `${key}.json`), record);
    if (!record.pathStatesComplete) await markLedgerIncomplete(event.session_id, root, stateDir, 'one or more edited paths could not be fingerprinted');
    return record.pathStatesComplete;
  } catch {
    await markLedgerIncomplete(event.session_id, root, stateDir, 'an edit event could not be recorded').catch(() => {});
    return false;
  }
}

async function readLedgerRecords(sessionId, root, stateDir) {
  const directory = ledgerDirectory(sessionId, stateDir);
  let entries;
  try {
    entries = (await readdir(directory)).filter((file) => file.endsWith('.json') && file !== 'incomplete.json').sort();
    if (entries.length > MAX_REVIEW_EVENTS) {
      await markLedgerIncomplete(sessionId, root, stateDir, 'edit event capacity was exceeded');
      entries = entries.slice(0, MAX_REVIEW_EVENTS);
    }
  }
  catch { return null; }

  const records = [];
  for (const file of entries) {
    try {
      const record = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
      if (record.version !== 1 || record.sessionId !== sessionId || record.worktreeId !== worktreeId(root) || !Array.isArray(record.paths)) {
        await markLedgerIncomplete(sessionId, root, stateDir, 'an edit event record was malformed or mismatched');
        continue;
      }
      const paths = record.paths.filter((item) => typeof item === 'string' && item && !item.split('/').includes('..'));
      if (!paths.length) {
        await markLedgerIncomplete(sessionId, root, stateDir, 'an edit event record had no safe paths');
        continue;
      }
      records.push({ ...record, paths });
    } catch {
      await markLedgerIncomplete(sessionId, root, stateDir, 'an edit event record could not be parsed');
    }
  }
  return records;
}

function combineLedgerRecords(records, incompleteReason) {
  if (!records?.length && !incompleteReason) return null;
  const paths = [...new Set(records.flatMap((record) => record.paths))].sort();
  const exactPatch = records.every((record) => record.exactPatch === true && typeof record.patch === 'string');
  const patch = exactPatch ? records.map((record) => record.patch).join('\n') : '';
  const tooLarge = Buffer.byteLength(patch) > MAX_SESSION_PATCH_BYTES;
  const observedStates = {};
  for (const record of records) {
    for (const [relativePath, state] of Object.entries(record.observedStates ?? {})) {
      if (typeof state === 'string') {
        observedStates[relativePath] ??= [];
        observedStates[relativePath].push(state);
      }
    }
  }
  return {
    paths,
    patch: tooLarge ? '' : patch,
    exactPatch: exactPatch && !tooLarge,
    containsContact: records.some((record) => record.containsContact === true),
    observedStates,
    pathStatesComplete: records.every((record) => record.pathStatesComplete === true),
    incompleteReason,
    notes: [...new Set([...records.map((record) => record.note), incompleteReason].filter(Boolean))],
    eventCount: records.length,
  };
}

export async function readSessionCandidate(sessionId, { root = REPO_ROOT, stateDir = path.join(root, '.codex', 'state') } = {}) {
  if (!SESSION_ID.test(sessionId ?? '')) return null;
  const records = await readLedgerRecords(sessionId, root, stateDir);
  const incompleteReason = await readLedgerIncomplete(sessionId, root, stateDir);
  return combineLedgerRecords(records ?? [], incompleteReason);
}

export async function clearSessionCandidate(sessionId, { root = REPO_ROOT, stateDir = path.join(root, '.codex', 'state') } = {}) {
  if (!SESSION_ID.test(sessionId ?? '')) return;
  await rm(ledgerDirectory(sessionId, stateDir), { recursive: true, force: true });
  await rm(baselinePath(sessionId, stateDir), { force: true });
}

function stopMessage(candidate, evaluation, retry) {
  const lines = [
    `Final session review (${candidate.eventCount} attributed edit event(s); ${candidate.paths.length} path(s)).`,
    ...candidate.notes,
    evaluation.message,
  ];
  if (retry) lines.push('Session continuation: all applicable Stop checks are evaluated again until they pass.');
  if (evaluation.terraRequired && evaluation.terraResult?.startsWith('Terra advisory unavailable')) {
    lines.push('Terra fallback: delegate this advisory review to an agent configured with gpt-6.1-terra at low effort. If that model is unavailable there too, report the provider limitation; auto-commit remains disabled.');
  }
  if (!candidate.exactPatch && !candidate.notes.length) lines.push('Terra review skipped because one or more edit events did not provide an exact patch.');
  return lines.join('\n').slice(0, MAX_OUTPUT_BYTES);
}

function stopDecision(evaluation, systemMessage) {
  const blockers = [...evaluation.failures];
  const terraPassed = /Terra advisory(?:: unchanged candidate already reviewed clean\.| \(passed\):)/.test(evaluation.terraResult ?? '');
  if (evaluation.terraRequired && !terraPassed) {
    blockers.push(evaluation.terraResult?.startsWith('Terra advisory (findings)')
      ? 'Terra review returned findings'
      : 'required Terra review did not pass');
  }
  if (blockers.length) {
    return {
      decision: 'block',
      reason: `Stop checks have not passed: ${blockers.join('; ').slice(0, 1000)}. Resolve these results before ending this session or moving to unrelated work; the hook will check again on continuation.`,
      systemMessage,
    };
  }
  return { systemMessage };
}

function blockedStop(reason) {
  const safeReason = String(reason).replace(/[\r\n]/g, ' ').slice(0, 900);
  return {
    decision: 'block',
    reason: `Stop review is incomplete: ${safeReason}. Resolve the attribution issue before ending this session; the hook will check again on continuation.`,
    systemMessage: 'The final worktree could not be fully matched to captured edit events, so review and auto-commit were withheld.',
  };
}

async function reconcileSessionChanges(event, candidate, { root, stateDir }) {
  const baseline = await readSessionBaseline(event.session_id, root, stateDir);
  const current = gitBaseline(root);
  if (!current) return { ok: false, reason: 'Git worktree state could not be read' };
  if (current.ambiguous) return { ok: false, reason: 'Git reports a rename or copy whose paths cannot be attributed safely' };
  if (!baseline) {
    return current.changedPaths.length || candidate
      ? { ok: false, reason: 'No valid SessionStart baseline is available for this session' }
      : { ok: true, changedPaths: [] };
  }
  if (!baseline.pathStatesComplete) return { ok: false, reason: 'SessionStart could not fingerprint every pre-existing changed path' };
  if (candidate?.incompleteReason) return { ok: false, reason: `edit ledger is incomplete: ${candidate.incompleteReason}` };
  if (candidate && !candidate.pathStatesComplete) return { ok: false, reason: 'edit ledger is missing post-edit path fingerprints' };

  const pathsToInspect = [...new Set([
    ...current.changedPaths,
    ...Object.keys(baseline.pathStatuses),
    ...(candidate?.paths ?? []),
  ])];
  const currentStates = await worktreePathStates(root, pathsToInspect);
  const changedPaths = current.changedPaths.filter((relativePath) => {
    const sameStatus = baseline.pathStatuses[relativePath] === current.pathStatuses[relativePath];
    const sameState = baseline.pathStates[relativePath] === currentStates[relativePath];
    return !sameStatus || !sameState;
  });

  if (pathsToInspect.some((relativePath) => currentStates[relativePath] === null)) {
    return { ok: false, reason: 'one or more changed paths could not be fingerprinted' };
  }

  const candidatePaths = new Set(candidate?.paths ?? []);
  const unattributed = changedPaths.filter((relativePath) => !candidatePaths.has(relativePath));
  if (unattributed.length) {
    return { ok: false, reason: `worktree changes were not captured by the edit ledger: ${unattributed.slice(0, 12).join(', ')}` };
  }

  const drifted = changedPaths.filter((relativePath) =>
    !(candidate?.observedStates?.[relativePath] ?? []).includes(currentStates[relativePath]),
  );
  if (drifted.length) {
    return { ok: false, reason: `file contents changed after their last recorded edit: ${drifted.slice(0, 12).join(', ')}` };
  }

  return { ok: true, changedPaths };
}

/** @param {any} event @param {StopReviewOptions} [options] */
export async function handleStopEvent(event, {
  root = REPO_ROOT,
  stateDir = path.join(root, '.codex', 'state'),
  reviewer,
  fastChecks = runFastChecks,
} = {}) {
  if (!isRepositoryCwd(event?.cwd, root) || !SESSION_ID.test(event?.session_id ?? '')) return null;
  const candidate = await readSessionCandidate(event.session_id, { root, stateDir });
  const reconciliation = await reconcileSessionChanges(event, candidate, { root, stateDir });
  if (!reconciliation.ok) return blockedStop(reconciliation.reason);
  if (!candidate && !reconciliation.changedPaths.length) return null;
  if (!candidate) return blockedStop('worktree changes exist without an edit-ledger candidate');

  const retry = event.stop_hook_active === true;
  const evaluation = await evaluateCandidate(candidate, {
    root,
    terra: candidate.exactPatch,
    reviewer,
    fastChecks,
    strictStoryMapping: false,
    guidelineReview: true,
  });
  if (!evaluation) return null;
  const decision = stopDecision(evaluation, stopMessage(candidate, evaluation, retry));
  const commitMessage = await autoCommitSessionChanges(candidate, event, evaluation, { root, stateDir });
  decision.systemMessage = [decision.systemMessage, commitMessage].filter(Boolean).join('\n').slice(0, MAX_OUTPUT_BYTES);
  return decision;
}

async function run() {
  const mode = process.argv[2];
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const event = parseEvent(Buffer.concat(chunks).toString('utf8'));
  if (mode === 'record') {
    await recordSessionEdit(event);
    return;
  }
  process.stderr.write('Usage: session-review.mjs record\n');
  process.exitCode = 2;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  run().catch((error) => {
    process.stderr.write(`Session review ledger skipped: ${String(error?.message ?? error).slice(0, 300)}\n`);
    process.exitCode = 0;
  });
}
