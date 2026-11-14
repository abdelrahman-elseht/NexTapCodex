import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkFileBudget } from "../../scripts/quality/file-budget.mjs";

const roots: string[] = [];

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nextap-file-budget-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  return root;
}

function lines(count: number) { return Array.from({ length: count }, (_, index) => `const value${index} = ${index};`).join("\n"); }

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("source file budgets", () => {
  it("warns above the advisory threshold and ignores generated declarations", () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, "src/large.ts"), lines(251));
    fs.writeFileSync(path.join(root, "src/generated.d.ts"), lines(500));
    const result = checkFileBudget(root, { baseline: {} });
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(["src/large.ts: 251 lines exceeds the 250-line warning threshold."]);
    expect(result.filesChecked).toBe(1);
  });

  it("fails new files over the hard cap", () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, "src/large.tsx"), lines(351));
    expect(checkFileBudget(root, { baseline: {} }).errors[0]).toContain("exceeds the 350-line hard cap");
  });

  it("warns only on growth for calibrated legacy files", () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, "src/legacy.ts"), lines(310));
    expect(checkFileBudget(root, { baseline: { "src/legacy.ts": 310 } }).warnings).toEqual([]);
    const result = checkFileBudget(root, { baseline: { "src/legacy.ts": 309 } });
    expect(result.warnings[0]).toContain("grew from its grandfathered 309-line baseline");
  });
});
