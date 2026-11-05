import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

describe("import boundary policy", () => {
  const eslint = new ESLint({ cwd: process.cwd() });
  const scenarios = [
    {
      name: "public components may use public-safe domain rules",
      file: "src/components/__boundary_probe__.tsx",
      source: 'import { safeUrl } from "@/lib/business/content"; export { safeUrl };',
      violates: false,
    },
    {
      name: "components cannot import owner authorization",
      file: "src/components/__boundary_probe__.tsx",
      source: 'import { requireOwner } from "@/lib/auth/owner"; export { requireOwner };',
      violates: true,
    },
    {
      name: "domain modules cannot import route code",
      file: "src/lib/business/__boundary_probe__.ts",
      source: 'import Page from "@/app/admin/cards/page"; export { Page };',
      violates: true,
    },
  ];

  it.each(scenarios)("$name", async ({ file, source, violates }) => {
    const [result] = await eslint.lintText(source, { filePath: path.resolve(file) });
    expect(result.messages.some((message) => message.ruleId === "boundaries/dependencies")).toBe(violates);
  });
});
