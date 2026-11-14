import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { routePaths, selectStories } from "../../scripts/quality/story-select.mjs";

const roots: string[] = [];

function selectionFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nextap-story-select-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "docs/specs"), { recursive: true });
  fs.mkdirSync(path.join(root, "tests/e2e"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs/STORY_ROUTING.json"), JSON.stringify({ version: 2, rules: [
    { id: "public", track: "legacy-baseline", paths: ["src/app/b/**"], stories: ["PUB-01", "PUB-02"] },
    { id: "cloudflare", track: "cloudflare-target", paths: ["workers/public/**"], stories: ["MIG-01"] },
    { id: "quality-docs", track: "quality-only", paths: ["docs/**", ".codex/**", "AGENTS.md", "CODEBOOK.md", ".github/workflows/**"], stories: [] },
    { id: "quality-tests", track: "quality-only", paths: ["tests/**"], stories: [] },
  ], tracks: ["legacy-baseline", "cloudflare-target", "quality-only"] }));
  fs.writeFileSync(path.join(root, "docs/specs/USER_ADMIN_STORIES.md"), [
    "### PUB-01 - Published page", "**Stage / coverage / risk / environment / fixture:** current / partial / high / local / synthetic.",
    "### PUB-02 - Visitor action", "**Stage / coverage / risk / environment / fixture:** current / partial / critical / local / synthetic.",
    "### MIG-01 - Cloudflare delivery", "**Stage / coverage / risk / environment / fixture:** planned / not-covered / critical / local / Worker fixture.",
  ].join("\n"));
  fs.writeFileSync(path.join(root, "tests/e2e/public.e2e.ts"), [
    'test("published profile renders", { tags: ["story:PUB-01", "domain:public", "risk:high", "env:local", "mutation:read"] }, async () => {});',
    'test("visitor can call", { tags: ["story:PUB-02", "domain:public", "risk:critical", "env:local", "mutation:read"] }, async () => {});',
    'test("unrelated owner mutation", { tags: ["story:ADM-BIZ-03", "domain:admin-business", "risk:high", "env:local", "mutation:write"] }, async () => {});',
  ].join("\n"));
  fs.writeFileSync(path.join(root, "tests/e2e/staging.e2e.ts"),
    'test("staging-only profile", { tags: ["story:PUB-01", "domain:public", "risk:high", "env:staging", "mutation:read"] }, async () => {});');
  fs.writeFileSync(path.join(root, "tests/e2e/migration.e2e.ts"),
    'test("cloudflare publication serves a published profile", { tags: ["story:MIG-01", "domain:migration", "risk:critical", "env:local", "mutation:read"] }, async () => {});');
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("adaptive story routing", () => {
  it("routes known changed paths and leaves quality-only changes without stories", () => {
    const result = routePaths(["src/app/login/actions.ts", "package.json"]);
    expect(result.unknown).toEqual([]);
    expect(result.matched[0].rules.map((rule: { id: string }) => rule.id)).toContain("legacy-auth");
    expect(result.matched[1].rules.map((rule: { id: string }) => rule.id)).toContain("test-maintenance");
  });

  it("rejects an unregistered path instead of selecting the full suite", () => {
    const result = routePaths(["src/new-unclassified-domain/file.ts"]);
    expect(result.unknown).toEqual(["src/new-unclassified-domain/file.ts"]);
  });

  it("accepts Windows-style paths from changed-file tooling", () => {
    const result = routePaths(["src\\app\\b\\[slug]\\page.tsx"]);
    expect(result.unknown).toEqual([]);
    expect(result.matched[0].rules.map((rule: { id: string }) => rule.id)).toContain("legacy-public-profile");
  });

  it("returns exact test registrations and executable list/run commands, not whole-file unions", () => {
    const root = selectionFixture();
    const result = selectStories(root, ["src/app/b/[slug]/page.tsx"]);
    expect(result.tests.map((test) => test.title)).toEqual(["published profile renders", "visitor can call", "staging-only profile"]);
    expect(result.commands).toHaveLength(3);
    expect(result.commands[0].list).toContain("e2e' 'list' 'tests/e2e/public.e2e.ts'");
    expect(result.commands[0].list).toContain("--grep' '/published profile renders$/");
    expect(result.commands[0].run).toContain("e2e' 'run' 'tests/e2e/public.e2e.ts'");
    expect(result.commands.filter((command) => command.file === "tests/e2e/public.e2e.ts")).toHaveLength(2);
  });

  it("does not select statically skipped registrations as runnable evidence", () => {
    const root = selectionFixture();
    const file = path.join(root, "tests/e2e/public.e2e.ts");
    fs.appendFileSync(file, '\ntest.skip("disabled public flow", { tags: ["story:PUB-01", "domain:public", "risk:high", "env:local", "mutation:read"] }, async () => {});');
    const result = selectStories(root, ["src/app/b/[slug]/page.tsx"]);

    expect(result.tests.some((test) => test.title === "disabled public flow")).toBe(false);
    expect(result.routedStoryIds).toContain("PUB-01");
  });

  it("intersects risk, environment, and mutation filters and reports no-match explicitly", () => {
    const root = selectionFixture();
    const result = selectStories(root, ["src/app/b/[slug]/page.tsx"], { risk: "high", env: "local", mutation: "read" });
    expect(result.tests.map((test) => test.title)).toEqual(["published profile renders"]);
    expect(result.commands[0].run).toContain("--tag-mode' 'all'");
    expect(result.commands[0].run).toContain("'risk:high'");
    expect(result.commands[0].run).toContain("'env:local'");
    expect(result.commands[0].run).toContain("'mutation:read'");
    const noMatch = selectStories(root, ["src/app/b/[slug]/page.tsx"], { env: "staging", mutation: "write" });
    expect(noMatch.commands).toEqual([]);
    expect(noMatch.routedStoryIds).toEqual(["PUB-01", "PUB-02"]);
  });

  it("keeps quality-only changes at zero E2E and preserves unknown-path blocking", () => {
    const root = selectionFixture();
    const quality = selectStories(root, ["tests/unit/story-select.test.ts"]);
    expect(quality.storyIds).toEqual([]);
    expect(quality.commands).toEqual([]);
    expect(selectStories(root, ["src/new-domain/unmapped.ts"]).unknown).toEqual(["src/new-domain/unmapped.ts"]);
  });

  it("accepts documentation and hook paths as neutral quality-only under the Cloudflare target track", () => {
    const root = selectionFixture();
    for (const changedPath of ["docs/TESTING.md", ".codex/hooks.json"]) {
      const result = selectStories(root, [changedPath], { track: "cloudflare-target" });
      expect(result.unknown).toEqual([]);
      expect(result.routedStoryIds).toEqual([]);
      expect(result.commands).toEqual([]);
    }
  });

  it("routes Cloudflare files only to target-track stories and identifies missing target evidence", () => {
    const root = selectionFixture();
    const result = selectStories(root, ["workers/public/profile.ts"], { track: "cloudflare-target" });
    expect(result.routedStoryIds).toEqual(["MIG-01"]);
    expect(result.storyIds).toEqual(["MIG-01"]);
    expect(result.tests.map((test) => test.title)).toEqual(["cloudflare publication serves a published profile"]);
    expect(result.commands).toHaveLength(1);
  });

  it("routes a changed E2E file to its tagged story instead of treating it as quality-only", () => {
    const root = selectionFixture();
    const result = selectStories(root, ["tests/e2e/migration.e2e.ts"], { track: "cloudflare-target" });
    expect(result.routedStoryIds).toEqual(["MIG-01"]);
    expect(result.storyIds).toEqual(["MIG-01"]);
    expect(result.changedE2eWithoutStory).toEqual([]);
  });
});
