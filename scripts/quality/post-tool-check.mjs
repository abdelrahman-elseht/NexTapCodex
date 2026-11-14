import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateDocsIndex } from './docs-index.mjs';
import { collectStoryCoverage } from './story-coverage.mjs';
import { selectStories } from './story-select.mjs';
import { reviewTerraCandidate } from './terra-review.mjs';
import { checkArchitecture } from './architecture-check.mjs';
import { checkFileBudget } from './file-budget.mjs';
import { REPO_ROOT, parseEvent } from './session-state.mjs';

const MAX_PATCH_BYTES = 24 * 1024;
const MAX_REVIEW_CONTEXT_BYTES = 52 * 1024;
const LINT_TIMEOUT_MS = 60_000;
const MAX_LINT_OUTPUT_BYTES = 2400;
const MAX_DETERMINISTIC_CACHE_ENTRIES = 80;
const IGNORED_PARTS = new Set(['.git', '.next', '.turbo', 'node_modules', 'artifacts', 'coverage', '.codex/state']);
const SENSITIVE_PATH = /(?:^|\/)(?:\.env(?:\..*)?|credentials?(?:\.|$)|secrets?(?:\.|$)|.*\.pem|.*\.key)$/i;
const MODEL_REVIEW_EXACT = new Set([
  'AGENTS.md',
  'CODEBOOK.md',
  'docs/COMPONENTS.md',
  'docs/KNOWN_ISSUES.md',
  'docs/known-issues/tooling-and-hooks.md',
  'docs/known-issues/test-runner.md',
  'docs/known-issues/cloudflare-setup.md',
  'docs/known-issues/media.md',
  'docs/known-issues/payments.md',
  'docs/TESTING.md',
  'docs/functions-components/README.md',
  'docs/functions-components/ui.md',
  'docs/functions-components/business.md',
  'docs/functions-components/admin-auth.md',
  'docs/functions-components/media.md',
  'docs/functions-components/cards.md',
  'docs/functions-components/security-observability.md',
  'docs/ARCHITECTURE.md',
  'docs/TECH_STACK.md',
  'docs/DATA_MODEL.md',
  'docs/STORY_ROUTING.json',
  'docs/specs/NEXTAP_LANDING_DELIVERY_AND_SUPABASE_EXIT_PRD.md',
  'docs/specs/USER_ADMIN_STORIES.md',
  '.codex/hooks.json',
]);
const MODEL_REVIEW_PREFIXES = ['workers/', 'infra/cloudflare/', 'src/worker/', 'src/lib/cloudflare/', 'scripts/quality/', 'cloudflare/'];
const MODEL_REVIEW_CODE = /^(?:src|workers|scripts|infra\/cloudflare)\/.*\.[cm]?[jt]sx?$|^tests\/(?:unit|integration)\/.*\.[cm]?[jt]sx?$/i;
const MODEL_REVIEW_DEPLOYMENT = /^(?:wrangler(?:\.[a-z0-9_-]+)?\.toml|\.github\/workflows\/cloudflare-[^/]+\.ya?ml)$/i;
const SEMANTIC_RISK_PATH = /(?:auth|owner|permission|security|publication|publish|slug|card[-_/]token|token|media|cache|database|schema|migration|wrangler|cloudflare[-_]deploy|deploy|secret)/i;
const CODEBOOK_PATH = /(?:business|profile|page|slug|publication|card[-_/]token|has[_-]menu)/i;
const SECRET_VALUE = /((?:api[_-]?key|token|secret|password|authorization|cookie|supabase_service_role)["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi;
const TOKEN_VALUE = /\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g;
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_VALUE = /(?:\+?\d[\d\s().-]{6,}\d)/g;

function hasPhoneLikeValue(value) {
  return [...value.matchAll(PHONE_VALUE)].some((match) => (match[0].match(/\d/g) ?? []).length >= 8);
}

function hasPersonalContactValue(value) {
  EMAIL_VALUE.lastIndex = 0;
  const hasEmail = EMAIL_VALUE.test(value);
  EMAIL_VALUE.lastIndex = 0;
  return hasEmail || hasPhoneLikeValue(value);
}

function normalizeRepoPath(value, root = REPO_ROOT) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '');
  const isPosixAbsolute = path.posix.isAbsolute(normalized);
  if (path.win32.isAbsolute(value) && !isPosixAbsolute) return null;
  if (!isPosixAbsolute && normalized.split('/').includes('..')) return null;
  const repoRoot = path.resolve(root);
  const resolved = path.resolve(isPosixAbsolute ? normalized : path.join(repoRoot, normalized));
  const relative = path.relative(repoRoot, resolved).split(path.sep).join('/');
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) return null;
  if (relative.split('/').some((part) => IGNORED_PARTS.has(part))) return null;
  if (SENSITIVE_PATH.test(relative)) return null;
  return relative;
}

function patchPaths(patch, root = REPO_ROOT) {
  const found = new Set();
  for (const line of patch.split(/\r?\n/)) {
    const match = line.match(/^\*\*\* (?:Update|Add|Delete) File: (.+)$/);
    if (!match) continue;
    const normalized = normalizeRepoPath(match[1].trim(), root);
    if (normalized) found.add(normalized);
  }
  return [...found].sort();
}

function hasExcludedPatchPath(patch, root = REPO_ROOT) {
  return patch.split(/\r?\n/).some((line) => {
    const match = line.match(/^\*\*\* (?:Update|Add|Delete) File: (.+)$/);
    return match ? normalizeRepoPath(match[1].trim(), root) === null : false;
  });
}

function redact(value) {
  return value.replace(SECRET_VALUE, '$1[REDACTED]')
    .replace(TOKEN_VALUE, '[REDACTED_TOKEN]')
    .replace(EMAIL_VALUE, '[REDACTED_EMAIL]')
    .replace(PHONE_VALUE, (match) => (match.match(/\d/g) ?? []).length >= 8 ? '[REDACTED_PHONE]' : match);
}

function isAllowedForModelReview(file) {
  return MODEL_REVIEW_EXACT.has(file) ||
    MODEL_REVIEW_PREFIXES.some((prefix) => file.startsWith(prefix)) ||
    MODEL_REVIEW_DEPLOYMENT.test(file);
}

function codeOwner(file) {
  const parts = file.split('/');
  if (parts[0] === 'src' && parts[1] === 'app') {
    if (!parts[2] || /\.[cm]?[jt]sx?$/i.test(parts[2])) return 'src/app:root';
    const area = parts[2] === 'admin' && parts[3] && !/\.[cm]?[jt]sx?$/i.test(parts[3]) ? `${parts[2]}/${parts[3]}` : parts[2];
    return `src/app:${area}`;
  }
  if (parts[0] === 'src' && ['lib', 'components'].includes(parts[1]) && parts[2]) return `src/${parts[1]}:${parts[2]}`;
  if (['workers', 'infra', 'cloudflare'].includes(parts[0]) && parts[1]) return `${parts[0]}:${parts[1]}`;
  return null;
}

export function terraReviewReason(paths) {
  if (paths.some((file) => SEMANTIC_RISK_PATH.test(file))) return 'high-risk path';
  const owners = new Set(paths.map(codeOwner).filter(Boolean));
  if (owners.size > 1) return 'cross-module change';
  return '';
}

export function patchFromEvent(event, root = REPO_ROOT) {
  if (!['apply_patch', 'Edit', 'Write'].includes(event.tool_name)) return null;
  if (event.tool_name === 'apply_patch' && typeof event.tool_input?.command === 'string') {
    const patch = event.tool_input.command;
    if (Buffer.byteLength(patch) > MAX_PATCH_BYTES) {
      return { unavailable: 'edit patch exceeded the review input limit', paths: patchPaths(patch, root), exactPatch: false, hasExcludedPath: hasExcludedPatchPath(patch, root) };
    }
    return { patch, paths: patchPaths(patch, root), exactPatch: true, hasExcludedPath: hasExcludedPatchPath(patch, root) };
  }
  const filePath = event.tool_input?.file_path ?? event.tool_input?.path ?? event.tool_input?.target_file;
  const normalized = normalizeRepoPath(filePath, root);
  return normalized ? { patch: null, paths: [normalized], exactPatch: false } : { unavailable: 'edit tool did not provide one safe repository-relative file path' };
}

function cachePath(root) {
  return path.join(root, '.codex', 'state', 'terra-review-cache.json');
}

async function readPassingCache(file) {
  try {
    const value = JSON.parse(await readFile(file, 'utf8'));
    return new Set(Array.isArray(value.passed) ? value.passed.filter((entry) => typeof entry === 'string') : []);
  } catch {
    return new Set();
  }
}

async function savePassingCache(file, passed) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify({ version: 1, passed: [...passed].slice(-100) }, null, 2)}\n`, { mode: 0o600 });
}

async function selectedContext(root, selection, changedPaths = selection.matched.map((entry) => entry.path)) {
  const lines = [
    'Target track: cloudflare-target',
    `Selected stories: ${selection.storyIds.join(', ') || '(none mapped)'}`,
    `Relevant tests: ${selection.testFiles.slice(0, 30).join(', ') || '(none mapped)'}`,
  ];
  const files = await registeredDocumentsForPaths(root, changedPaths);
  const sourceChange = changedPaths.some((file) => MODEL_REVIEW_CODE.test(file));
  if (sourceChange) {
    files.unshift(
      'AGENTS.md',
      'docs/COMPONENTS.md',
      'docs/functions-components/README.md',
      'docs/KNOWN_ISSUES.md',
      'docs/known-issues/tooling-and-hooks.md',
      'docs/known-issues/test-runner.md',
      'docs/known-issues/cloudflare-setup.md',
      'docs/known-issues/media.md',
      'docs/known-issues/payments.md',
      'docs/TESTING.md',
    );
    if (changedPaths.some((file) => /^(?:src\/components|src\/app)\//.test(file))) files.push('docs/functions-components/ui.md');
    if (changedPaths.some((file) => /^(?:src\/lib\/business|workers\/public)\//.test(file))) files.push('docs/functions-components/business.md');
    if (changedPaths.some((file) => /(?:auth|admin|security|permission)/i.test(file))) files.push('docs/functions-components/admin-auth.md', 'docs/functions-components/security-observability.md');
    if (changedPaths.some((file) => /(?:media|image|upload|storage)/i.test(file))) files.push('docs/functions-components/media.md');
    if (changedPaths.some((file) => /(?:card|token|nfc|qr)/i.test(file))) files.push('docs/functions-components/cards.md');
  }
  const uniqueFiles = [...new Set(files)];
  if (changedPaths.some((file) => CODEBOOK_PATH.test(file)) && !files.includes('CODEBOOK.md')) files.unshift('CODEBOOK.md');
  if (changedPaths.some((file) => CODEBOOK_PATH.test(file)) && !uniqueFiles.includes('CODEBOOK.md')) uniqueFiles.unshift('CODEBOOK.md');
  for (const file of uniqueFiles) {
    try {
      const source = redact(await readFile(path.join(root, file), 'utf8'));
      lines.push(`\n--- ${file} ---\n${source.slice(0, 3000)}`);
    } catch {
      // Missing guidance is reported through the bounded selection, not treated as a hook failure.
    }
  }
  return lines.join('\n').slice(0, sourceChange ? 24 * 1024 : MAX_REVIEW_CONTEXT_BYTES);
}

function simpleGlobMatches(pattern, value) {
  if (pattern.endsWith('/**')) return value.startsWith(pattern.slice(0, -2));
  if (!pattern.includes('*')) return value === pattern;
  const expression = new RegExp(`^${pattern.split('*').map((part) => part.replace(/[\\^$+?.()|{}\[\]]/g, '\\$&')).join('[^/]*')}$`);
  return expression.test(value);
}

async function registeredDocumentsForPaths(root, paths) {
  const indexPath = path.join(root, 'docs/README.md');
  let index = '';
  try { index = await readFile(indexPath, 'utf8'); } catch { return []; }
  const links = [...index.matchAll(/\[[^\]]+\]\(([^)]+\.md)(?:#[^)]*)?\)/g)].map((match) => match[1]);
  const selected = new Set();
  for (const link of links) {
    const absolute = path.resolve(path.dirname(indexPath), link);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (relative.startsWith('../') || path.isAbsolute(relative)) continue;
    let source;
    try { source = await readFile(absolute, 'utf8'); } catch { continue; }
    const header = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
    const globsLine = header?.match(/^Path globs:\s*(.*)$/m)?.[1];
    if (!globsLine) continue;
    let globs = [];
    if (globsLine.startsWith('[')) {
      try { globs = JSON.parse(globsLine); } catch { globs = []; }
    } else globs = globsLine.split(',').map((glob) => glob.trim());
    if (paths.some((changedPath) => globs.some((glob) => simpleGlobMatches(glob, changedPath)))) selected.add(relative);
  }
  return [...selected].slice(0, 12);
}

function storySelection(root, paths) {
  const result = selectStories(root, paths, { track: 'cloudflare-target' });
  if (result.unknown?.length) return { error: `Unmapped changed paths: ${result.unknown.join(', ')}` };
  return result;
}

function candidateStorySelection(root, paths, strict) {
  const selected = storySelection(root, paths);
  if (!selected.error || strict) return selected;
  return { matched: [], storyIds: [], testFiles: [], error: selected.error };
}

const LINTABLE_SOURCE = /\.(?:[cm]?[jt]sx?)$/i;
const BUDGET_SOURCE = /^src\/.*\.tsx?$/i;

function lintChangedFiles(root, files, { timeoutMs = LINT_TIMEOUT_MS } = {}) {
  const existingFiles = files.filter((file) => existsSync(path.join(root, file)));
  if (!existingFiles.length) return Promise.resolve('eslint: skipped (no changed source files remain on disk)');

  return new Promise((resolve) => {
    const executable = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
    const child = spawn(process.execPath, [executable, ...existingFiles], {
      cwd: root,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let timedOut = false;
    let killTimer;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), 500);
      killTimer.unref?.();
    }, timeoutMs);
    const collect = (chunk) => {
      if (Buffer.byteLength(output) < MAX_LINT_OUTPUT_BYTES) {
        output += chunk.toString('utf8').slice(0, MAX_LINT_OUTPUT_BYTES - Buffer.byteLength(output));
      }
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);
    child.on('error', (error) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      resolve(`eslint: unavailable (${String(error.message).slice(0, 200)})`);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      if (timedOut) {
        resolve(`eslint: unavailable (timed out after ${Math.ceil(timeoutMs / 1000)} seconds)`);
      } else if (code === 0) {
        resolve(`eslint: passed (${existingFiles.length} changed file(s))${output.trim() ? `\n${output.trim()}` : ''}`);
      } else {
        resolve(`eslint: failed (exit ${code ?? 'unknown'})${output.trim() ? `\n${output.trim()}` : ''}`);
      }
    });
  });
}

function filesUnder(directory, extensionPattern) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(filename, extensionPattern);
    return entry.isFile() && extensionPattern.test(entry.name) ? [filename] : [];
  });
}

function deterministicCheckInputs(root, paths, checks = {}) {
  const files = new Set(paths.map((file) => path.join(root, file)));
  for (const file of ['scripts/quality/post-tool-check.mjs', 'package.json']) files.add(path.join(root, file));
  if (paths.some((file) => LINTABLE_SOURCE.test(file))) {
    for (const file of ['eslint.config.mjs', 'package-lock.json', 'node_modules/eslint/bin/eslint.js']) files.add(path.join(root, file));
  }
  if (checks.runArchitecture || checks.runFileBudget) {
    for (const file of filesUnder(path.join(root, 'src'), /\.[cm]?[jt]sx?$/i)) files.add(file);
    if (checks.runArchitecture) {
      for (const file of ['scripts/quality/architecture-check.mjs', 'docs/ARCHITECTURE.md']) files.add(path.join(root, file));
    }
    if (checks.runFileBudget) files.add(path.join(root, 'scripts/quality/file-budget.mjs'));
  }
  if (paths.some((file) => file === 'docs/README.md' || (file.startsWith('docs/') && file.endsWith('.md')))) {
    for (const file of filesUnder(path.join(root, 'docs'), /\.md$/i)) files.add(file);
    files.add(path.join(root, 'scripts/quality/docs-index.mjs'));
  }
  if (paths.some((file) => file.startsWith('tests/e2e/') || file === 'docs/specs/USER_ADMIN_STORIES.md' || file === 'docs/STORY_ROUTING.json')) {
    for (const file of filesUnder(path.join(root, 'tests/e2e'), /\.e2e\.ts$/i)) files.add(file);
    for (const file of ['docs/specs/USER_ADMIN_STORIES.md', 'docs/STORY_ROUTING.json', 'scripts/quality/story-coverage.mjs']) files.add(path.join(root, file));
  }
  return [...files].sort();
}

function deterministicFingerprint(root, paths, checks = {}) {
  const hash = createHash('sha256');
  hash.update(`architecture:${checks.runArchitecture === true};fileBudget:${checks.runFileBudget === true}\0`);
  for (const filename of deterministicCheckInputs(root, paths, checks)) {
    hash.update(path.relative(root, filename).split(path.sep).join('/')).update('\0');
    try { hash.update(readFileSync(filename)); }
    catch { hash.update('[missing]'); }
    hash.update('\0');
  }
  return hash.digest('hex');
}

function deterministicCachePath(root) {
  return path.join(root, '.codex', 'state', 'deterministic-check-cache.json');
}

async function cachedChecks(cacheFile, fingerprint) {
  try {
    const cache = JSON.parse(await readFile(cacheFile, 'utf8'));
    const messages = cache.version === 1 ? cache.entries?.[fingerprint] : null;
    return Array.isArray(messages) ? messages : null;
  } catch { return null; }
}

async function saveCachedChecks(cacheFile, fingerprint, messages) {
  let entries = {};
  try {
    const cache = JSON.parse(await readFile(cacheFile, 'utf8'));
    if (cache.version === 1 && cache.entries && typeof cache.entries === 'object') entries = cache.entries;
  } catch { /* Start a new bounded cache when local state is absent or malformed. */ }
  entries[fingerprint] = messages;
  const bounded = Object.fromEntries(Object.entries(entries).slice(-MAX_DETERMINISTIC_CACHE_ENTRIES));
  await mkdir(path.dirname(cacheFile), { recursive: true });
  await writeFile(cacheFile, `${JSON.stringify({ version: 1, entries: bounded }, null, 2)}\n`, { mode: 0o600 });
}

export async function runFastChecks(root, paths, checks = {}) {
  const { runArchitecture = false, runFileBudget = false, ...checkOverrides } = checks;
  const cacheable = Object.keys(checkOverrides).length === 0;
  const fingerprint = cacheable ? deterministicFingerprint(root, paths, { runArchitecture, runFileBudget }) : '';
  if (cacheable) {
    const cached = await cachedChecks(deterministicCachePath(root), fingerprint);
    if (cached) return ['checks: reused successful results for unchanged inputs', ...cached];
  }
  const messages = await runFastChecksUncached(root, paths, { ...checkOverrides, runArchitecture, runFileBudget });
  const successful = messages.length > 0 && messages.every((message) => !/: (?:failed|unavailable)\b|: skipped\b/.test(message));
  if (cacheable && successful) await saveCachedChecks(deterministicCachePath(root), fingerprint, messages);
  return messages;
}

async function runFastChecksUncached(root, paths, checks = {}) {
  const messages = [];
  const sourceFiles = paths.filter((file) => LINTABLE_SOURCE.test(file));
  if (sourceFiles.length) {
    try {
      messages.push(await (checks.lint ?? lintChangedFiles)(root, sourceFiles));
    } catch (error) {
      messages.push(`eslint: unavailable (${String(error?.message ?? error).slice(0, 300)})`);
    }
  }

  if (checks.runArchitecture) {
    try {
      const architecture = (checks.architecture ?? checkArchitecture)(root);
      messages.push(architecture.ok
        ? 'architecture: passed'
        : `architecture: failed (${architecture.errors.slice(0, 4).join(' | ')})`);
    } catch (error) {
      messages.push(`architecture: unavailable (${String(error?.message ?? error).slice(0, 250)})`);
    }

  }

  if (checks.runFileBudget) {
    try {
      const budget = (checks.fileBudget ?? checkFileBudget)(root);
      const budgetNotes = [...budget.errors, ...budget.warnings].slice(0, 4).join(' | ');
      messages.push(budget.ok
        ? `file-budget: passed${budgetNotes ? ` (${budgetNotes})` : ''}`
        : `file-budget: failed (${budgetNotes})`);
    } catch (error) {
      messages.push(`file-budget: unavailable (${String(error?.message ?? error).slice(0, 250)})`);
    }
  }

  if (paths.some((file) => file === 'docs/README.md' || (file.startsWith('docs/') && file.endsWith('.md')))) {
    const result = validateDocsIndex(root);
    messages.push(result.ok
      ? 'docs-index: passed'
      : `docs-index: failed (${result.errors.slice(0, 4).join(' | ')})`);
  }
  if (paths.some((file) => file.startsWith('tests/e2e/') || file === 'docs/specs/USER_ADMIN_STORIES.md' || file === 'docs/STORY_ROUTING.json')) {
    const result = collectStoryCoverage(root);
    messages.push(result.ok
      ? `story-metadata: passed (${result.tests.length} registrations, ${result.stories.size} stories)`
      : `story-metadata: failed (${result.errors.slice(0, 4).join(' | ')})`);
  }
  return messages;
}

export async function evaluateCandidate(candidate, {
  root = REPO_ROOT,
  terra = false,
  reviewer = reviewTerraCandidate,
  fastChecks = runFastChecks,
  strictStoryMapping = true,
  guidelineReview = false,
} = {}) {
  if (!candidate) return null;
  if (candidate.unavailable) return { message: `Cloudflare migration check skipped: ${candidate.unavailable}.`, failures: [] };
  if (!candidate.paths.length) return { message: 'Cloudflare migration check skipped: no attributable repository file paths were present in the completed patch.', failures: [] };

  const selection = candidateStorySelection(root, candidate.paths, strictStoryMapping);
  if (selection.error && strictStoryMapping) return {
    message: `${selection.error}. Add an explicit route rule before relying on adaptive E2E selection.`,
    failures: [],
  };

  const addedSourceModule = candidate.patch?.split(/\r?\n/).some((line) => {
    const match = line.match(/^\*\*\* Add File: (.+)$/);
    return match && BUDGET_SOURCE.test(match[1]);
  }) ?? false;
  const changedImports = candidate.patch?.split(/\r?\n/).some((line) =>
    /^[+-]\s*(?:import\b|export\b.*\bfrom\b|const\s+\w+\s*=\s*require\()/.test(line),
  ) ?? false;
  const structuralChecks = {
    runArchitecture: addedSourceModule || changedImports,
    runFileBudget: addedSourceModule,
  };
  const messages = await fastChecks(root, candidate.paths, structuralChecks);

  const summary = [
    `Cloudflare-target check for: ${candidate.paths.join(', ')}`,
    `Stories: ${selection.storyIds.join(', ') || 'none mapped; deterministic quality checks only'}`,
    `Tests: ${selection.testFiles.slice(0, 20).join(', ') || 'none mapped'}`,
    ...messages,
  ];
  if (selection.error) summary.push(`${selection.error}. No adaptive E2E selector was inferred.`);

  const reviewReason = terraReviewReason(candidate.paths) ||
    (guidelineReview && candidate.paths.some((file) => MODEL_REVIEW_CODE.test(file)) ? 'project guideline review' : '');
  const terraResult = await terraAdvisory(candidate, { root, terra, reviewer, guidelineReview }, selection, reviewReason);
  if (reviewReason && terraResult) summary.push(`Terra trigger: ${reviewReason}.`);
  if (terraResult) summary.push(terraResult);
  const failures = messages.filter((message) => /: (?:failed|unavailable)\b/.test(message));
  const checksPassed = messages.length > 0 && messages.every((message) => !/: (?:failed|unavailable|skipped)\b/.test(message));
  const reviewPathsAllowed = candidate.paths.every((file) => isAllowedForModelReview(file) ||
    (guidelineReview && MODEL_REVIEW_CODE.test(file)));
  const terraRequired = Boolean(terra && candidate.exactPatch && reviewReason && !candidate.containsContact &&
    !hasPersonalContactValue(candidate.patch) && reviewPathsAllowed);
  return { message: summary.join('\n'), failures, terraResult, terraRequired, selection, checksPassed, reviewReason, checkMessages: messages };
}

async function terraAdvisory(candidate, { root, terra, reviewer, guidelineReview }, selection, reviewReason) {
  if (!terra) return '';
  const excluded = candidate.hasExcludedPath || candidate.paths.some((file) =>
    !isAllowedForModelReview(file) && !(guidelineReview && MODEL_REVIEW_CODE.test(file)));
  if (!candidate.exactPatch || excluded) {
    if (!candidate.exactPatch) return 'Terra advisory skipped: this edit tool did not provide an exact patch payload.';
    return excluded ? 'Terra advisory skipped: every changed path must be explicitly allowlisted for Cloudflare target review.' : '';
  }
  if (candidate.containsContact || hasPersonalContactValue(candidate.patch)) {
    return 'Terra advisory skipped: patch contains email or phone-like personal contact data.';
  }
  if (!reviewReason) return '';
  return runCachedTerraReview(candidate, root, selection, reviewer);
}

async function runCachedTerraReview(candidate, root, selection, reviewer) {
  const patch = redact(candidate.patch);
  const context = await selectedContext(root, selection, candidate.paths);
  const fingerprint = createHash('sha256').update(`${patch}\n${context}`).digest('hex');
  const cacheFile = cachePath(root);
  const passed = await readPassingCache(cacheFile);
  if (passed.has(fingerprint)) return 'Terra advisory: unchanged candidate already reviewed clean.';

  const packet = `${context}\n\n--- Exact session patches (redacted) ---\n${patch}`;
  const review = await reviewer(packet, { root, fingerprint });
  if (review.status === 'passed') {
    passed.add(fingerprint);
    await savePassingCache(cacheFile, passed);
  }
  return review.status === 'unavailable'
    ? `Terra advisory unavailable: ${review.reason}`
    : `Terra advisory (${review.status}): ${review.text}`;
}

export async function handlePostToolEvent(event, options = {}) {
  const candidate = patchFromEvent(event, options.root ?? REPO_ROOT);
  const evaluation = await evaluateCandidate(candidate, options);
  return evaluation?.message ?? null;
}

function main() {
  const chunks = [];
  process.stdin.on('data', (chunk) => chunks.push(chunk));
  process.stdin.on('end', async () => {
    try {
      const event = parseEvent(Buffer.concat(chunks).toString('utf8'));
      const result = await handlePostToolEvent(event);
      if (result) process.stdout.write(`${result.slice(0, 7000)}\n`);
    } catch (error) {
      process.stdout.write(`Cloudflare migration hook skipped: ${String(error?.message ?? error).slice(0, 500)}\n`);
    }
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();

export { hasPersonalContactValue, isAllowedForModelReview, lintChangedFiles, normalizeRepoPath, patchPaths, redact, registeredDocumentsForPaths };
