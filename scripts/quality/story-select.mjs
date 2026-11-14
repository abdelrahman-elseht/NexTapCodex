#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { collectStoryCoverage } from "./story-coverage.mjs";

function normalize(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function globRegex(pattern) {
  let source = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*" && pattern[index + 1] === "*") {
      index += 1;
      if (pattern[index + 1] === "/") {
        index += 1;
        source += "(?:.*/)?";
      } else source += ".*";
    } else if (character === "*") source += "[^/]*";
    else source += /[\\^$+?.()|{}\[\]]/.test(character) ? `\\${character}` : character;
  }
  return new RegExp(`${source}$`);
}

export function readStoryRouting(root = process.cwd()) {
  const file = path.resolve(root, "docs/STORY_ROUTING.json");
  const routing = JSON.parse(fs.readFileSync(file, "utf8"));
  if (routing.version !== 2 || !Array.isArray(routing.rules) || !Array.isArray(routing.tracks)) {
    throw new Error("Story routing manifest must use version 2 with tracks and rules.");
  }
  for (const rule of routing.rules) {
    if (!routing.tracks.includes(rule.track) || !Array.isArray(rule.paths) || !Array.isArray(rule.stories)) {
      throw new Error(`Invalid story routing rule: ${rule.id ?? "<unnamed>"}.`);
    }
  }
  return routing.rules.map((rule) => ({ ...rule, matchers: rule.paths.map(globRegex) }));
}

export function routePaths(paths, root = process.cwd()) {
  const rules = readStoryRouting(root);
  const matched = [];
  const unknown = [];
  for (const original of paths.map(normalize)) {
    const rulesForPath = rules.filter((rule) => rule.matchers.some((matcher) => matcher.test(original)));
    if (!rulesForPath.length) unknown.push(original);
    else matched.push({ path: original, rules: rulesForPath });
  }
  return { matched, unknown, rules };
}

function changedPaths(root, ref) {
  const args = ["diff", "--name-only", "--diff-filter=ACMR", `${ref}...HEAD`, "--"];
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `Could not read changed paths from ${ref}.`);
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function parseArgs(args) {
  const options = { paths: [], ref: null, filters: {} };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--paths") {
      while (args[index + 1] && !args[index + 1].startsWith("--")) options.paths.push(args[++index]);
    }
    else if (argument === "--from" && args[index + 1]) options.ref = args[++index];
    else if (argument === "--risk" && args[index + 1]) options.filters.risk = args[++index];
    else if (argument === "--env" && args[index + 1]) options.filters.env = args[++index];
    else if (argument === "--mutation" && args[index + 1]) options.filters.mutation = args[++index];
    else if (argument === "--target" && args[index + 1]) options.filters.target = args[++index];
    else if (argument === "--track" && args[index + 1]) options.filters.track = args[++index];
    else if (argument === "--help") options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.paths.length && options.ref) throw new Error("Use either --paths or --from, not both.");
  if (options.filters.risk && !["critical", "high", "normal"].includes(options.filters.risk)) throw new Error("--risk must be critical, high, or normal.");
  if (options.filters.env && !["local", "staging"].includes(options.filters.env)) throw new Error("--env must be local or staging.");
  if (options.filters.mutation && !["read", "write"].includes(options.filters.mutation)) throw new Error("--mutation must be read or write.");
  if (options.filters.target && !/^[a-z0-9][a-z0-9_-]*$/i.test(options.filters.target)) throw new Error("--target must be a simple E2E target name.");
  if (options.filters.track && !["legacy-baseline", "cloudflare-target"].includes(options.filters.track)) {
    throw new Error("--track must be legacy-baseline or cloudflare-target.");
  }
  return options;
}

function tagsFor(test) {
  return new Set(test.tags);
}

function titlePattern(title) {
  return `/${title.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$/`;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function commandFor(action, test, storyId, filters) {
  const args = ["npx", "e2e", action, test.file];
  const tags = [`story:${storyId}`];
  if (filters.risk) tags.push(`risk:${filters.risk}`);
  if (filters.env) tags.push(`env:${filters.env}`);
  if (filters.mutation) tags.push(`mutation:${filters.mutation}`);
  for (const tag of tags) args.push("--tag", tag);
  if (tags.length > 1) args.push("--tag-mode", "all");
  if (filters.target) args.push("--target", filters.target);
  args.push("--grep", titlePattern(test.title));
  return args.map(shellQuote).join(" ");
}

export function selectStories(root, paths, filters = {}) {
  const routed = routePaths(paths, root);
  const coverage = collectStoryCoverage(root);
  const normalizedPaths = paths.map(normalize);
  const routedStoryIds = new Set(routed.matched.flatMap((entry) => entry.rules
    .filter((rule) => !filters.track || rule.track === filters.track)
    .flatMap((rule) => rule.stories)));

  // Editing a tagged browser test should route its own story contracts, while
  // edits to unit tests and quality tooling remain deterministic-only.
  const changedE2eFiles = new Set(normalizedPaths.filter((file) => file.startsWith("tests/e2e/")));
  for (const test of coverage.tests) {
    if (!changedE2eFiles.has(test.file)) continue;
    for (const tag of test.tags) {
      if (!tag.startsWith("story:")) continue;
      const storyId = tag.slice("story:".length);
      const story = coverage.stories.get(storyId);
      const isTarget = story && ["planned", "migration-active"].includes(story.stage);
      const isLegacy = story?.stage === "current";
      if (!filters.track || (filters.track === "cloudflare-target" && isTarget) ||
          (filters.track === "legacy-baseline" && isLegacy)) routedStoryIds.add(storyId);
    }
  }

  const changedE2eWithoutStory = [...changedE2eFiles].filter((file) =>
    !coverage.tests.some((test) => test.file === file && test.tags.some((tag) => tag.startsWith("story:"))));
  const selectedTests = coverage.tests.filter((test) => {
    if (test.skipped) return false;
    const tags = tagsFor(test);
    const selectedStory = [...routedStoryIds].some((id) => tags.has(`story:${id}`));
    return selectedStory &&
      (!filters.risk || tags.has(`risk:${filters.risk}`)) &&
      (!filters.env || tags.has(`env:${filters.env}`)) &&
      (!filters.mutation || tags.has(`mutation:${filters.mutation}`));
  });
  const selectedStoryIds = [...new Set(selectedTests.flatMap((test) => test.tags
    .filter((tag) => tag.startsWith("story:") && routedStoryIds.has(tag.slice("story:".length)))
    .map((tag) => tag.slice("story:".length))))].sort();
  const commands = selectedTests.map((test) => {
    const storyId = selectedStoryIds.find((id) => test.tags.includes(`story:${id}`));
    return {
      file: test.file,
      title: test.title,
      storyId,
      list: commandFor("list", test, storyId, filters),
      run: commandFor("run", test, storyId, filters),
    };
  });
  return {
    ...routed,
    storyIds: selectedStoryIds,
    routedStoryIds: [...routedStoryIds].sort(),
    changedE2eWithoutStory,
    tests: selectedTests,
    testFiles: [...new Set(selectedTests.map((test) => test.file))].sort(),
    commands,
    coverage,
  };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const options = parseArgs(process.argv.slice(2));
  if (options.help || (!options.paths.length && !options.ref)) {
    process.stdout.write("Usage: npm run select:stories -- (--paths <file...> | --from <git-ref>) [--track legacy-baseline|cloudflare-target] [--risk critical|high|normal] [--env local|staging] [--mutation read|write] [--target <name>]\n");
    return;
  }
  const paths = options.ref ? changedPaths(root, options.ref) : options.paths;
  if (!paths.length) throw new Error("No changed paths were supplied or found.");
  const result = selectStories(root, paths, options.filters);
  process.stdout.write(`Changed paths (${paths.length}):\n${paths.map((value) => `- ${normalize(value)}`).join("\n")}\n`);
  if (result.unknown.length) {
    process.stderr.write(`UNMAPPED PATHS: ${result.unknown.join(", ")}\nDeclare a routing rule before selecting E2E tests.\n`);
    process.exitCode = 2;
    return;
  }
  if (options.filters.track && result.matched.some((entry) =>
    !entry.rules.some((rule) => rule.track === options.filters.track || rule.track === "quality-only")) &&
    result.routedStoryIds.length === 0) {
    process.stderr.write(`NO PATH RULE FOR TRACK ${options.filters.track.toUpperCase()}\nThe changed path belongs to another track or has no story mapping.\n`);
    process.exitCode = 3;
    return;
  }
  if (result.changedE2eWithoutStory.length) {
    process.stderr.write(`E2E FILES WITHOUT STORY TAGS: ${result.changedE2eWithoutStory.join(", ")}\nAdd valid story tags before selecting browser evidence.\n`);
    process.exitCode = 2;
    return;
  }
  process.stdout.write(`Routed stories: ${result.routedStoryIds.length ? result.routedStoryIds.join(", ") : "none"}\n`);
  process.stdout.write(`Selected stories with mapped tests: ${result.storyIds.length ? result.storyIds.join(", ") : "none"}\n`);
  if (Object.keys(options.filters).length) process.stdout.write(`Filters: ${Object.entries(options.filters).map(([key, value]) => `${key}=${value}`).join(", ")}\n`);
  if (!result.commands.length && result.routedStoryIds.length) {
    process.stderr.write("No mapped E2E registration matches these stories and filters. Treat this as a coverage gap or fixture blocker; do not substitute legacy tests for Cloudflare target evidence.\n");
    process.exitCode = 3;
    return;
  }
  process.stdout.write(`Selected test registrations: ${result.tests.length}\n`);
  for (const command of result.commands) {
    process.stdout.write(`\n${command.storyId} ${command.file}: ${command.title}\n`);
    process.stdout.write(`LIST ${command.list}\n`);
    process.stdout.write(`RUN  ${command.run}\n`);
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
