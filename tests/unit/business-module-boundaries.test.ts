import { readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
if (!configPath) throw new Error("tsconfig.json was not found.");
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
const compilerOptions = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;

function importGraph(entry: string) {
  const queue = [resolve(root, entry)];
  const visited = new Set<string>();
  const external = new Set<string>();
  const sourceRoot = resolve(root, "src") + sep;

  while (queue.length) {
    const file = queue.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);

    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const specifiers: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const clause = node.importClause;
        const bindings = clause?.namedBindings;
        const hasRuntimeImport = !clause?.isTypeOnly && (
          Boolean(clause?.name) ||
          !bindings ||
          ts.isNamespaceImport(bindings) ||
          (ts.isNamedImports(bindings) && bindings.elements.some(element => !element.isTypeOnly))
        );
        if (hasRuntimeImport) specifiers.push(node.moduleSpecifier.text);
      } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        specifiers.push(node.moduleSpecifier.text);
      } else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        specifiers.push(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);

    for (const specifier of specifiers) {
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) {
        external.add(specifier);
        continue;
      }
      const resolved = ts.resolveModuleName(specifier, file, compilerOptions, ts.sys).resolvedModule?.resolvedFileName;
      if (!resolved) throw new Error(`Could not resolve ${specifier} from ${relative(root, file)}.`);
      const normalized = resolve(resolved);
      if (normalized.toLowerCase().startsWith(sourceRoot.toLowerCase())) queue.push(normalized);
      else external.add(specifier);
    }
  }

  return {
    files: [...visited].map(file => relative(root, file).split(sep).join("/")).sort(),
    external: [...external].sort(),
  };
}

describe("business workflow module dependencies", () => {
  it("keeps the save-draft Application workflow inside business rules", () => {
    const graph = importGraph("src/lib/business/draft-workflow.ts");

    expect(graph.files.filter(file => !file.startsWith("src/lib/business/"))).toEqual([]);
    expect(graph.external).toEqual([]);
    expect(graph.files).not.toContain("src/lib/supabase/contact-draft-persistence.ts");

    const source = ts.createSourceFile(
      "draft-workflow.ts",
      readFileSync(resolve(root, "src/lib/business/draft-workflow.ts"), "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const draftImport = source.statements.find(
      (statement): statement is ts.ImportDeclaration =>
        ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === "./draft",
    );
    expect(draftImport?.importClause?.isTypeOnly).toBe(true);
  });

  it("keeps the versioned contact Contract provider-independent", () => {
    const graph = importGraph("src/lib/contracts/contact-projection-v1.ts");

    expect(graph.files).toEqual(["src/lib/contracts/contact-projection-v1.ts"]);
    expect(graph.external).toEqual(["zod"]);
  });

  it("keeps the Supabase adapter out of Presentation modules", () => {
    const graph = importGraph("src/lib/supabase/contact-draft-persistence.ts");

    expect(graph.files.some(file => file.startsWith("src/app/") || file.startsWith("src/components/"))).toBe(false);
    expect(graph.files).toContain("src/lib/supabase/contact-draft-persistence.ts");
    expect(graph.files).toContain("src/lib/media/resolve-contact-photo.ts");
  });

  it("records Admin workflow composition and the current Public provider dependency", () => {
    const admin = importGraph("src/app/admin/businesses/draft-actions.ts");
    expect(admin.files).toContain("src/lib/business/draft-workflow.ts");
    expect(admin.files).toContain("src/lib/supabase/contact-draft-persistence.ts");
    expect(admin.files).toContain("src/lib/auth/owner.ts");
    expect(admin.files).toContain("src/lib/supabase/server.ts");
    expect(admin.external).toContain("@supabase/ssr");
    expect(admin.external).not.toContain("@supabase/supabase-js");

    const publicPortfolio = importGraph("src/app/b/[slug]/page.tsx");
    expect(publicPortfolio.files).toContain("src/lib/business/public-publication.ts");
    expect(publicPortfolio.files).toContain("src/lib/supabase/public.ts");
    expect(publicPortfolio.external).toContain("@supabase/supabase-js");
  });
});
