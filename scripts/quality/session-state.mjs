import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const STATE_DIR = path.join(REPO_ROOT, '.codex', 'state');
const MAX_EVENT_BYTES = 32 * 1024;
const MAX_FIELD_LENGTH = 1200;
const MAX_LIST_ITEMS = 12;
const MAX_MEMORY_BYTES = 2 * 1024;
const MAX_MEMORY_LINES = 20;
const MAX_CHECKPOINT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const SECRET_PATTERN = /(token|secret|password|api[_-]?key|authorization|cookie)\s*[:=]/i;

export function worktreeId(root = REPO_ROOT) {
  return createHash('sha256').update(path.resolve(root)).digest('hex').slice(0, 16);
}

export function parseEvent(raw) {
  if (Buffer.byteLength(raw) > MAX_EVENT_BYTES) throw new Error('Hook event exceeded the input limit.');
  const event = JSON.parse(raw || '{}');
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('Hook event must be a JSON object.');
  return event;
}

function cleanText(value, field) {
  if (typeof value !== 'string') throw new Error(`${field} must be text.`);
  const text = value.trim();
  if (text.length > MAX_FIELD_LENGTH) throw new Error(`${field} exceeds ${MAX_FIELD_LENGTH} characters.`);
  if (SECRET_PATTERN.test(text)) throw new Error(`${field} looks like it contains a credential.`);
  return text;
}

function cleanList(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) throw new Error(`${field} must contain at most ${MAX_LIST_ITEMS} items.`);
  return value.map((item, index) => cleanText(item, `${field}[${index}]`)).filter(Boolean);
}

function cleanPathList(value, field) {
  const items = cleanList(value, field);
  for (const item of items) {
    if (path.posix.isAbsolute(item) || path.win32.isAbsolute(item) || item.split(/[\\/]/).includes('..')) {
      throw new Error(`${field} must use repository-relative paths without traversal.`);
    }
  }
  return items;
}

function isFreshTimestamp(value, now = Date.now()) {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now + MAX_FUTURE_SKEW_MS && now - timestamp <= MAX_CHECKPOINT_AGE_MS;
}

export function validateCheckpoint(input, root = REPO_ROOT) {
  const allowed = new Set([
    'sessionId', 'worktreeId', 'task', 'branch', 'gitSummary', 'currentState', 'completed', 'decisions',
    'nextSteps', 'blockers', 'changedPaths', 'checkResults', 'fileRefs', 'updatedAt',
  ]);
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new Error(`Unsupported checkpoint field: ${key}`);
  if (typeof input.sessionId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(input.sessionId)) throw new Error('sessionId is invalid.');
  if (input.worktreeId !== worktreeId(root)) throw new Error('Checkpoint belongs to a different worktree.');
  const task = cleanText(input.task, 'task');
  if (!task) throw new Error('task is required.');
  const branch = input.branch === undefined ? '' : cleanText(input.branch, 'branch');
  const gitSummary = input.gitSummary === undefined ? '' : cleanText(input.gitSummary, 'gitSummary');
  const currentState = input.currentState === undefined ? '' : cleanText(input.currentState, 'currentState');
  const checkpoint = {
    version: 1,
    sessionId: input.sessionId,
    worktreeId: input.worktreeId,
    task,
    branch,
    gitSummary,
    currentState,
    completed: cleanList(input.completed, 'completed'),
    decisions: cleanList(input.decisions, 'decisions'),
    nextSteps: cleanList(input.nextSteps, 'nextSteps'),
    blockers: cleanList(input.blockers, 'blockers'),
    changedPaths: cleanPathList(input.changedPaths, 'changedPaths'),
    checkResults: cleanList(input.checkResults, 'checkResults'),
    fileRefs: cleanPathList(input.fileRefs, 'fileRefs'),
    updatedAt: new Date().toISOString(),
  };
  if (Buffer.byteLength(JSON.stringify(checkpoint)) > MAX_EVENT_BYTES) throw new Error('Checkpoint exceeded the size limit.');
  return checkpoint;
}

export async function atomicWrite(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  await rename(temp, file);
}

async function atomicWriteText(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, value, { mode: 0o600, flag: 'wx' });
  await rename(temp, file);
}

function shortMemoryValue(value, max = 240) {
  return String(value ?? '').replaceAll(/\s+/g, ' ').slice(0, max);
}

export function renderContinuationMemory(checkpoint) {
  const lines = [
    '# Agent Memory',
    '',
    'Latest unfinished-task continuation. Resume at session start or after compaction; verify against current source and user instructions. Do not reread broad file lists.',
    '',
    `Task: ${shortMemoryValue(checkpoint.task, 400)}`,
    `Checkpoint time: ${checkpoint.updatedAt}`,
  ];
  const add = (label, values) => {
    if (!values?.length) return;
    const value = values.slice(0, 4).map((item) => shortMemoryValue(item, 180)).join('; ');
    lines.push(`${label}: ${value}`);
  };
  if (checkpoint.currentState) lines.push(`Current state: ${shortMemoryValue(checkpoint.currentState, 400)}`);
  add('Last completed', checkpoint.completed);
  add('Next action', checkpoint.nextSteps);
  add('Blockers', checkpoint.blockers);
  add('Key paths', checkpoint.fileRefs?.slice(0, 3));
  add('Checks', checkpoint.checkResults);
  add('Decisions', checkpoint.decisions);

  let output = '';
  for (const line of lines.slice(0, MAX_MEMORY_LINES)) {
    const next = `${output}${output ? '\n' : ''}${line}`;
    if (Buffer.byteLength(next, 'utf8') > MAX_MEMORY_BYTES) break;
    output = next;
  }
  return `${output}\n`;
}

function checkpointPath(sessionId, stateDir) {
  return path.join(stateDir, `checkpoint-${sessionId}.json`);
}

export async function prepareCheckpoint(input, { stateDir = STATE_DIR, root = REPO_ROOT } = {}) {
  const checkpoint = validateCheckpoint(input, root);
  await atomicWrite(checkpointPath(checkpoint.sessionId, stateDir), checkpoint);
  await atomicWriteText(path.join(root, 'AGENT_MEMORY.md'), renderContinuationMemory(checkpoint));
  return checkpoint;
}

export async function readCheckpoint(sessionId, { stateDir = STATE_DIR, root = REPO_ROOT } = {}) {
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) return null;
  try {
    const stored = JSON.parse(await readFile(checkpointPath(sessionId, stateDir), 'utf8'));
    if (stored.version !== 1 || stored.worktreeId !== worktreeId(root) || stored.sessionId !== sessionId || !isFreshTimestamp(stored.updatedAt)) return null;
    delete stored.version;
    const checkpoint = validateCheckpoint(stored, root);
    return { ...checkpoint, updatedAt: stored.updatedAt };
  } catch {
    return null;
  }
}

export async function finalizeHandoff(sessionId, { stateDir = STATE_DIR, root = REPO_ROOT } = {}) {
  const checkpoint = await readCheckpoint(sessionId, { stateDir, root });
  if (!checkpoint) return null;
  const handoff = { ...checkpoint, finalizedAt: new Date().toISOString() };
  await atomicWrite(path.join(stateDir, 'latest-handoff.json'), handoff);
  return handoff;
}

export async function readLatestHandoff({ stateDir = STATE_DIR, root = REPO_ROOT } = {}) {
  try {
    const stored = JSON.parse(await readFile(path.join(stateDir, 'latest-handoff.json'), 'utf8'));
    if (stored.version !== 1 || stored.worktreeId !== worktreeId(root) || !isFreshTimestamp(stored.updatedAt) || !isFreshTimestamp(stored.finalizedAt)) return null;
    const finalizedAt = stored.finalizedAt;
    delete stored.version;
    delete stored.finalizedAt;
    const handoff = validateCheckpoint(stored, root);
    return { ...handoff, updatedAt: stored.updatedAt, finalizedAt };
  } catch {
    return null;
  }
}

export function formatContext(memory, handoff, sessionId = '', repositoryState = '') {
  const sections = [];
  if (sessionId && /^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) sections.push(`Current Codex session ID: ${sessionId}. Use it when preparing a task checkpoint.`);
  if (memory) sections.push(`AGENT_MEMORY.md (latest task continuation; resume if unfinished):\n${memory}`);
  if (repositoryState) sections.push(`Current repository state:\n${repositoryState}`);
  if (handoff) {
    const list = (title, items) => items.length ? `${title}:\n${items.map((item) => `- ${item}`).join('\n')}` : '';
    sections.push([
      `Latest local continuation for this worktree:\nTask: ${handoff.task}`,
      handoff.branch ? `Branch: ${handoff.branch}` : '',
      handoff.gitSummary ? `Git state: ${handoff.gitSummary}` : '',
      handoff.currentState ? `Current state:\n${handoff.currentState}` : '',
      list('Completed', handoff.completed), list('Decisions', handoff.decisions),
      list('Next steps', handoff.nextSteps), list('Blockers', handoff.blockers),
      list('Changed paths', handoff.changedPaths), list('Checks', handoff.checkResults),
      list('File references', handoff.fileRefs),
    ].filter(Boolean).join('\n'));
  }
  return sections.join('\n\n');
}
