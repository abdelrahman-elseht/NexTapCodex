import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { collectStoryCoverage } from "../../scripts/quality/story-coverage.mjs";

const roots: string[] = [];

function fixture(testSource: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nextap-story-coverage-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "docs/specs"), { recursive: true });
  fs.mkdirSync(path.join(root, "tests/e2e"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs/specs/USER_ADMIN_STORIES.md"), [
    "### PUB-01 - Visitor opens a page",
    "**Stage / coverage / risk / environment / fixture:** current / partial / high / local / anonymous.",
    "### AUTH-02 - Failed login is safe",
    "**Stage / coverage / risk / environment / fixture:** current / not-covered / critical / staging / isolated account.",
  ].join("\n"));
  fs.writeFileSync(path.join(root, "tests/e2e/example.e2e.ts"), testSource);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("story coverage metadata", () => {
  it("maps tagged tests to documented story IDs and keeps explicit uncovered stories visible", () => {
    const root = fixture(`test("public page", { tags: ["story:PUB-01", "domain:public", "risk:high", "env:local", "mutation:read"] }, async () => {});`);
    const report = collectStoryCoverage(root);

    expect(report.ok).toBe(true);
    expect(report.mapped.get("PUB-01")).toHaveLength(1);
    expect(report.gaps.map((story) => story.id)).toEqual(["AUTH-02"]);
  });

  it("reports untagged registrations and unknown story IDs", () => {
    const root = fixture([
      `test("untagged", async () => {});`,
      `test("unknown", { tags: ["story:FAKE-01", "domain:public", "risk:normal", "env:local", "mutation:read"] }, async () => {});`,
    ].join("\n"));
    const report = collectStoryCoverage(root);

    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes("test has no tags"))).toBe(true);
    expect(report.errors.some((error) => error.includes("unknown story FAKE-01"))).toBe(true);
  });

  it("rejects missing selection dimensions and a covered story without a test", () => {
    const root = fixture(`test("partly tagged", { tags: ["story:PUB-01", "domain:public"] }, async () => {});`);
    const storiesPath = path.join(root, "docs/specs/USER_ADMIN_STORIES.md");
    fs.writeFileSync(storiesPath, fs.readFileSync(storiesPath, "utf8").replace("current / partial", "current / covered"));
    const report = collectStoryCoverage(root);

    expect(report.errors.some((error) => error.includes("missing risk:") )).toBe(true);
    expect(report.errors.some((error) => error.includes("PUB-01: marked covered but no E2E test"))).toBe(false);
    expect(report.mapped.get("PUB-01")).toHaveLength(1);
  });

  it("does not count a statically skipped registration as runnable story evidence", () => {
    const root = fixture(`test.skip("disabled public page", { tags: ["story:PUB-01", "domain:public", "risk:high", "env:local", "mutation:read"] }, async () => {});`);
    const storiesPath = path.join(root, "docs/specs/USER_ADMIN_STORIES.md");
    fs.writeFileSync(storiesPath, fs.readFileSync(storiesPath, "utf8").replace("current / partial", "current / covered"));
    const report = collectStoryCoverage(root);

    expect(report.mapped.get("PUB-01")).toHaveLength(0);
    expect(report.skipped.get("PUB-01")).toHaveLength(1);
    expect(report.errors).toContain("PUB-01: marked covered but only has 1 statically skipped E2E registration(s).");
  });

  it("keeps dynamic prerequisite status explicit in the story catalog", () => {
    const root = fixture(`test("protected mutation is guarded", { tags: ["story:AUTH-02", "domain:auth", "risk:critical", "env:staging", "mutation:write"] }, async () => { test.skip(!process.env.FIXTURE, "fixture required"); });`);
    const storiesPath = path.join(root, "docs/specs/USER_ADMIN_STORIES.md");
    fs.writeFileSync(storiesPath, fs.readFileSync(storiesPath, "utf8").replace("current / not-covered", "current / blocked"));
    const report = collectStoryCoverage(root);

    expect(report.ok).toBe(true);
    expect(report.blocked.map((story) => story.id)).toEqual(["AUTH-02"]);
    expect(report.mapped.get("AUTH-02")).toHaveLength(1);
  });
});
