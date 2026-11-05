import { describe, expect, it } from "vitest";
import { evaluateFileBudgets, fileKind } from "../../scripts/ci/check-file-budgets.mjs";

describe("file budget policy", () => {
  it("classifies source by route, component, domain and test ownership", () => {
    expect(fileKind("src/app/b/[slug]/page.tsx")).toBe("route");
    expect(fileKind("src/app/admin/businesses/actions.ts")).toBe("route");
    expect(fileKind("src/app/b/[slug]/_components/card.tsx")).toBe("component");
    expect(fileKind("src/lib/business/providers.ts")).toBe("domain");
    expect(fileKind("tests/unit/providers.test.ts")).toBe("test");
    expect(fileKind("docs/ARCHITECTURE.md")).toBeNull();
  });

  it("warns only for valid scoped exceptions and rejects changed overages", () => {
    const result = evaluateFileBudgets({
      files: [
        { path: "src/app/admin/cards/page.tsx", lines: 307 },
        { path: "src/lib/business/new-domain.ts", lines: 301 },
      ],
      baselineCounts: new Map([["src/app/admin/cards/page.tsx", 307]]),
      exceptions: [{ file: "src/app/admin/cards/page.tsx", owner: "architecture", reason: "bounded extraction pending", expiresOn: "2027-01-01" }],
      today: "2026-11-05",
    });
    expect(result.errors).toEqual(["src/lib/business/new-domain.ts: 301/300 lines (new file)"]);
    expect(result.warnings).toHaveLength(1);
  });

  it("rejects a stale exception and reports it", () => {
    const result = evaluateFileBudgets({
      files: [{ path: "src/components/ui/example.tsx", lines: 251 }],
      baselineCounts: new Map(),
      exceptions: [{ file: "src/components/ui/example.tsx", owner: "ui", reason: "temporary", expiresOn: "2026-01-01" }],
      today: "2026-11-05",
    });
    expect(result.errors).toEqual(["src/components/ui/example.tsx: 251/250 lines (new file)"]);
    expect(result.warnings).toEqual(["STALE_EXCEPTION src/components/ui/example.tsx: expired 2026-01-01"]);
  });
});
