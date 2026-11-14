import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateDocsIndex } from "../../scripts/quality/docs-index.mjs";

const roots: string[] = [];
const guides = ["ARCHITECTURE", "TESTING", "COMPONENTS", "DATA_MODEL"];

function metadata(overrides: Record<string, string> = {}) {
  const fields = {
    Status: "current",
    Owner: "Engineering",
    Supersedes: "none",
    "Path globs": '["src/**", "docs/**"]',
    "Topic tags": "architecture, testing",
    ...overrides,
  };
  return `---\n${Object.entries(fields).map(([key, value]) => `${key}: ${value}`).join("\n")}\n---\n\n# Guide\n`;
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nextap-docs-index-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "docs/specs"), { recursive: true });
  for (const guide of guides) fs.writeFileSync(path.join(root, `docs/${guide}.md`), metadata());
  fs.writeFileSync(path.join(root, "docs/specs/phase.md"), metadata({ Status: "proposed" }));
  fs.writeFileSync(path.join(root, "docs/README.md"), [
    "# Docs",
    ...guides.map((name) => `- [${name}](${name}.md)`),
    "- [Phase](specs/phase.md)",
    "```md",
    "[not a real link](missing.md)",
    "```",
  ].join("\n"));
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("documentation index validation", () => {
  it("accepts registered authoritative docs with valid metadata and ignores fenced examples", () => {
    const result = validateDocsIndex(fixture());
    expect(result).toEqual({ ok: true, errors: [] });
  });

  it("requires metadata and index registration for each authoritative document", () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, "docs/TESTING.md"), "# Missing metadata\n");
    fs.writeFileSync(path.join(root, "docs/README.md"), "# Docs\n");

    const result = validateDocsIndex(root);
    expect(result.errors).toContain("docs/TESTING.md: authoritative document is missing YAML front matter.");
    expect(result.errors).toContain("docs/TESTING.md: authoritative document is not registered in docs/README.md.");
  });

  it("rejects invalid field values, upward globs, and missing supersession targets", () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, "docs/DATA_MODEL.md"), metadata({
      Status: "todo",
      Owner: "<owner>",
      Supersedes: "docs/specs/missing.md",
      "Path globs": "../outside/**",
      "Topic tags": "good, not a tag",
    }));

    const result = validateDocsIndex(root);
    expect(result.errors).toContain("docs/DATA_MODEL.md: missing or placeholder Owner metadata.");
    expect(result.errors).toContain("docs/DATA_MODEL.md: Status must identify current, proposed, historical, or approved-scope state.");
    expect(result.errors).toContain("docs/DATA_MODEL.md: Supersedes target does not exist: docs/specs/missing.md.");
    expect(result.errors).toContain("docs/DATA_MODEL.md: Path globs must be repo-relative and cannot traverse upward.");
    expect(result.errors).toContain("docs/DATA_MODEL.md: Topic tags must be comma-separated simple words or hyphenated tags.");
  });

  it("reports broken local links in the index but permits external links and anchors", () => {
    const root = fixture();
    fs.appendFileSync(path.join(root, "docs/README.md"), "\n[Missing](not-here.md) [External](https://example.com) [Anchor](#top)\n");

    const result = validateDocsIndex(root);
    expect(result.errors).toContain("docs/README.md: local link target does not exist: not-here.md.");
    expect(result.errors.some((error) => error.includes("https://example.com"))).toBe(false);
    expect(result.errors.some((error) => error.includes("#top"))).toBe(false);
  });
});
