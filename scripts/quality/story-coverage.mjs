#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath, pathToFileURL } from "node:url";

const STORY_TAG = /^story:([A-Z]+(?:-[A-Z]+)*-\d+)$/;
const REQUIRED_TAGS = [
  /^domain:[a-z0-9-]+$/,
  /^risk:(critical|high|normal)$/,
  /^env:(local|staging)$/,
  /^mutation:(read|write)$/,
];
const COVERAGE_STATES = new Set(["covered", "partial", "blocked", "not-covered"]);

function collectFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(file);
    return entry.isFile() && entry.name.endsWith(".e2e.ts") ? [file] : [];
  });
}

function literalText(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null;
}

function isTestRegistration(expression) {
  if (ts.isIdentifier(expression)) return expression.text === "test";
  return ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) && expression.expression.text === "test" &&
    ["skip", "only", "setup"].includes(expression.name.text);
}

function registrationTags(source, file) {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const registrations = [];
  const errors = [];

  function visit(node) {
    if (ts.isCallExpression(node) && isTestRegistration(node.expression)) {
      const title = literalText(node.arguments[0]);
      const callback = node.arguments[node.arguments.length - 1];
      if (title !== null && callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
        const option = node.arguments[1] && ts.isObjectLiteralExpression(node.arguments[1])
          ? node.arguments[1]
          : null;
        const tagsProperty = option?.properties.find((property) =>
          ts.isPropertyAssignment(property) &&
          ((ts.isIdentifier(property.name) && property.name.text === "tags") ||
           (ts.isStringLiteral(property.name) && property.name.text === "tags")));
        const tags = tagsProperty && ts.isPropertyAssignment(tagsProperty) && ts.isArrayLiteralExpression(tagsProperty.initializer)
          ? tagsProperty.initializer.elements.map(literalText).filter(Boolean)
          : [];
        const skipped = ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "skip";
        registrations.push({ file, title, tags, skipped, line: parsed.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
        if (!tags.length) errors.push(`${file}:${registrations.at(-1).line}: test has no tags.`);
        for (const tag of tags) {
          if (tag.startsWith("story:") && !STORY_TAG.test(tag)) errors.push(`${file}:${registrations.at(-1).line}: invalid story tag ${tag}.`);
          if (!tag.startsWith("story:") && !REQUIRED_TAGS.some((pattern) => pattern.test(tag))) {
            errors.push(`${file}:${registrations.at(-1).line}: invalid E2E selection tag ${tag}.`);
          }
        }
        for (const pattern of REQUIRED_TAGS) {
          const prefix = pattern.source.slice(1, pattern.source.indexOf(":"));
          if (!tags.some((tag) => tag.startsWith(`${prefix}:`))) {
            errors.push(`${file}:${registrations.at(-1).line}: missing ${prefix}: tag.`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return { registrations, errors };
}

function readStories(markdown) {
  const lines = markdown.split(/\r?\n/);
  const stories = new Map();
  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].match(/^###\s+([A-Z]+(?:-[A-Z]+)*-\d+)\s+[—-]/);
    if (!heading) continue;
    const id = heading[1];
    const block = [];
    for (let cursor = index + 1; cursor < lines.length && !/^#{1,3}\s/.test(lines[cursor]); cursor += 1) block.push(lines[cursor]);
    const statusLine = block.find((line) => /\*\*Stage\s*\/\s*coverage\s*\/\s*risk\s*\/\s*environment\s*\/\s*fixture:\*\*/i.test(line));
    let stage = null;
    let coverage = null;
    if (statusLine) {
      const value = statusLine.match(/:\*\*\s*(.*)$/)?.[1]?.trim() ?? "";
      const tokens = value.split("/").map((token) => token.trim());
      stage = tokens[0] ?? null;
      coverage = tokens[1] ?? null;
    }
    stories.set(id, { id, stage, coverage, hasStatus: Boolean(statusLine) });
  }
  return stories;
}

export function collectStoryCoverage(root = process.cwd()) {
  const storyPath = path.resolve(root, "docs/specs/USER_ADMIN_STORIES.md");
  const testRoot = path.resolve(root, "tests/e2e");
  const stories = readStories(fs.readFileSync(storyPath, "utf8"));
  const tests = [];
  const errors = [];

  for (const file of collectFiles(testRoot)) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    const parsed = registrationTags(fs.readFileSync(file, "utf8"), relative);
    tests.push(...parsed.registrations);
    errors.push(...parsed.errors);
  }

  const mapped = new Map([...stories.keys()].map((id) => [id, []]));
  const skipped = new Map([...stories.keys()].map((id) => [id, []]));
  for (const test of tests) {
    for (const tag of test.tags) {
      const match = tag.match(STORY_TAG);
      if (!match) continue;
      if (!stories.has(match[1])) errors.push(`${test.file}:${test.line}: references unknown story ${match[1]}.`);
      else if (test.skipped) skipped.get(match[1]).push(test);
      else mapped.get(match[1]).push(test);
    }
  }

  for (const story of stories.values()) {
    if (!story.hasStatus || !story.stage || !COVERAGE_STATES.has(story.coverage)) {
      errors.push(`${story.id}: missing or invalid Stage/Coverage metadata.`);
    }
    if (story.coverage === "covered" && mapped.get(story.id).length === 0) {
      const skippedCount = skipped.get(story.id).length;
      errors.push(skippedCount
        ? `${story.id}: marked covered but only has ${skippedCount} statically skipped E2E registration(s).`
        : `${story.id}: marked covered but no runnable E2E test carries its story tag.`);
    }
  }

  const gaps = [...stories.values()].filter((story) => mapped.get(story.id).length === 0);
  const blocked = [...stories.values()].filter((story) => story.coverage === "blocked");
  return { ok: errors.length === 0, errors, stories, tests, mapped, skipped, gaps, blocked };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const report = collectStoryCoverage(root);
  for (const [id, storyTests] of report.mapped) {
    const story = report.stories.get(id);
    const skippedTests = report.skipped.get(id) ?? [];
    if (story?.coverage === "blocked") {
      process.stdout.write(`BLOCKED ${id} (${storyTests.length} runnable, ${skippedTests.length} statically skipped; prerequisite evidence required)\n`);
    } else if (storyTests.length) {
      process.stdout.write(`MAPPED ${id} (${storyTests.length} runnable test(s))\n`);
    } else if (skippedTests.length) {
      process.stdout.write(`GAP ${id} (only ${skippedTests.length} statically skipped test(s))\n`);
    } else {
      process.stdout.write(`GAP ${id} (no runnable tagged test)\n`);
    }
  }
  for (const error of report.errors) process.stderr.write(`ERROR ${error}\n`);
  process.stdout.write(`Story coverage metadata: ${report.ok ? "valid" : "invalid"}; ${report.tests.length} test registrations, ${report.stories.size} stories.\n`);
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
