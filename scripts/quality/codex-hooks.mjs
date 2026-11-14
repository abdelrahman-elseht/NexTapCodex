#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { formatContext, finalizeHandoff, parseEvent, readCheckpoint, readLatestHandoff, REPO_ROOT } from './session-state.mjs';
import { handlePostToolEvent } from './post-tool-check.mjs';
import { captureSessionBaseline, clearSessionCandidate, handleStopEvent } from './session-review.mjs';
import { pathToFileURL } from 'node:url';

const eventName = process.argv[2];
const knownEvents = new Set(['SessionStart', 'PreCompact', 'PostCompact', 'SessionEnd', 'PostToolUse', 'Stop']);
const MAX_MEMORY_BYTES = 2 * 1024;

function validSessionId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function summarizeGitStatus(output) {
  const [header, ...entries] = String(output).split(/\r?\n/);
  if (!header?.startsWith('## ')) return '';
  const branch = header.slice(3).split('...')[0].trim().slice(0, 120) || 'detached HEAD';
  const changed = entries.filter(Boolean);
  const tracked = changed.filter((entry) => !entry.startsWith('??'));
  const staged = tracked.filter((entry) => entry[0] && entry[0] !== ' ').length;
  const unstaged = tracked.filter((entry) => entry[1] && entry[1] !== ' ').length;
  const untracked = changed.length - tracked.length;
  const summary = changed.length
    ? `Working tree: ${changed.length} changed file(s) (${staged} staged, ${unstaged} unstaged, ${untracked} untracked).`
    : 'Working tree: clean.';
  return `Branch: ${branch}\n${summary}`;
}

function readRepositoryState(root) {
  try {
    const output = execFileSync('git', ['-C', root, 'status', '--porcelain=v1', '--branch'], {
      encoding: 'utf8',
      timeout: 2000,
      maxBuffer: 4096,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return summarizeGitStatus(output);
  } catch {
    return '';
  }
}

function isRepoCwd(value, root = REPO_ROOT) {
  if (typeof value !== 'string') return false;
  const relative = path.relative(root, path.resolve(value));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function readMemory(root = REPO_ROOT) {
  try {
    const contents = await readFile(path.join(root, 'AGENT_MEMORY.md'), 'utf8');
    return Buffer.from(contents, 'utf8').subarray(0, MAX_MEMORY_BYTES).toString('utf8');
  } catch {
    return '';
  }
}

/** @typedef {{root?: string, stateDir?: string, memory?: string, repositoryState?: string}} DispatchOptions */
/** @param {string} name @param {any} event @param {DispatchOptions} [options] */
export async function dispatchContinuityEvent(name, event, options = {}) {
  const { root = REPO_ROOT, stateDir, memory, repositoryState } = options;
  if (!knownEvents.has(name)) throw new Error(`Unsupported hook event: ${name || '(missing)'}`);
  const sessionId = validSessionId(event.session_id) ? event.session_id : '';

  if (name === 'SessionStart') {
    if (!isRepoCwd(event.cwd, root)) return null;
    await captureSessionBaseline(event, { root, stateDir });
    const handoff = await readLatestHandoff({ stateDir, root });
    const context = formatContext(memory ?? await readMemory(root), handoff, sessionId, repositoryState ?? readRepositoryState(root));
    return context ? { hookSpecificOutput: { hookEventName: name, additionalContext: context } } : null;
  } else if (name === 'PostCompact') {
    if (!isRepoCwd(event.cwd, root) || !sessionId) return null;
    const checkpoint = await readCheckpoint(sessionId, { stateDir, root });
    const context = checkpoint ? formatContext(await readMemory(root), checkpoint, sessionId) : '';
    return context ? { hookSpecificOutput: { hookEventName: name, additionalContext: context } } : {
      warning: 'No fresh checkpoint is available for this session after compaction.',
    };
  } else if (name === 'PreCompact') {
    if (isRepoCwd(event.cwd, root) && sessionId && !(await readCheckpoint(sessionId, { stateDir, root }))) {
      return { warning: 'No fresh task checkpoint is prepared; compaction will not capture a session summary.' };
    }
    return null;
  } else if (name === 'SessionEnd') {
    if (!isRepoCwd(event.cwd, root) || !sessionId) return null;
    const handoff = await finalizeHandoff(sessionId, { stateDir, root });
    await clearSessionCandidate(sessionId, { stateDir, root });
    return handoff ? null : { warning: 'No fresh checkpoint was available; no session handoff was created.' };
  } else if (name === 'PostToolUse' && isRepoCwd(event.cwd, root)) {
    const result = await handlePostToolEvent(event, { root });
    if (result) {
      return {
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: result,
        },
      };
    }
  } else if (name === 'Stop') {
    return handleStopEvent(event, { ...options, root, stateDir });
  }
  return null;
}

async function run() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const event = parseEvent(Buffer.concat(chunks).toString('utf8'));
  const result = await dispatchContinuityEvent(eventName, event);
  if (eventName === 'Stop' && result) process.stdout.write(`${JSON.stringify(result)}\n`);
  else if (result?.warning) process.stderr.write(`${result.warning}\n`);
  else if (result) process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  run().catch((error) => {
    if (eventName === 'Stop') {
      process.stdout.write(`${JSON.stringify({
        decision: 'block',
        reason: 'Stop review could not complete because its session state was unavailable. Retry after resolving the hook error.',
        systemMessage: 'Review and auto-commit were withheld because the Stop hook did not finish.',
      })}\n`);
      return;
    }
    process.stderr.write(`Codex project hook skipped: ${error.message}\n`);
    process.exitCode = 0;
  });
}
