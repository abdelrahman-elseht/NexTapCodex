import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkArchitecture } from "../../scripts/quality/architecture-check.mjs";

const roots: string[] = [];

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nextap-architecture-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "src/lib"), { recursive: true });
  fs.mkdirSync(path.join(root, "src/app/example/_components"), { recursive: true });
  fs.mkdirSync(path.join(root, "src/components/ui"), { recursive: true });
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("architecture boundaries", () => {
  it("accepts domain modules and route-local UI using allowed dependencies", () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, "src/lib/value.ts"), "export const value = 1;\n");
    fs.writeFileSync(path.join(root, "src/app/example/_components/view.tsx"), 'import { value } from "@/lib/value"; export const View = () => <p>{value}</p>;\n');
    expect(checkArchitecture(root)).toEqual({ ok: true, errors: [] });
  });

  it("rejects library-to-UI and reusable-component-to-route dependencies", () => {
    const root = fixture();
    fs.writeFileSync(path.join(root, "src/lib/value.ts"), 'import { Widget } from "@/components/ui/widget"; export { Widget };\n');
    fs.writeFileSync(path.join(root, "src/app/example/page.tsx"), "export const page = true;\n");
    fs.writeFileSync(path.join(root, "src/components/ui/widget.tsx"), 'import { page } from "@/app/example/page"; export { page };\n');
    const result = checkArchitecture(root);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.join("\n")).toContain("rule lib-no-route-or-ui-dependencies");
    expect(result.errors.join("\n")).toContain("rule components-no-route-dependencies");
  });

  it("rejects server dependencies imported by a client module", () => {
    const root = fixture();
    fs.mkdirSync(path.join(root, "src/lib/auth"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/lib/auth/owner.ts"), "export const owner = true;\n");
    fs.writeFileSync(path.join(root, "src/components/ui/client.tsx"), '"use client";\nimport { owner } from "@/lib/auth/owner"; export { owner };\n');
    expect(checkArchitecture(root).errors[0]).toContain("Client modules cannot import server-only");
  });
});
