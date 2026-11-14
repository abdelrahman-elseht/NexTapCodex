import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Keep these rules aligned with docs/ARCHITECTURE.md. Exceptions are exact
// source/target prefixes and should be removed when the dependency is retired.
export const ARCHITECTURE_RULES = [
  {
    id: "lib-no-route-or-ui-dependencies",
    from: "src/lib/",
    deny: ["src/app/", "src/components/"],
    message: "Domain/library modules cannot depend on routes or UI components.",
  },
  {
    id: "components-no-route-dependencies",
    from: "src/components/",
    deny: ["src/app/"],
    message: "Reusable components cannot depend on route modules.",
  },
];

export const ARCHITECTURE_EXCEPTIONS = [
  {
    from: "src/components/ui/submit-button.tsx",
    to: "src/components/admin/mutation-form.tsx",
    reason: "Shared mutation state is currently exported by the admin form module; extract it before tightening this boundary.",
  },
  {
    from: "src/components/ui/confirm-submit-button.tsx",
    to: "src/components/admin/mutation-form.tsx",
    reason: "Shared mutation state is currently exported by the admin form module; extract it before tightening this boundary.",
  },
];

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

function sourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(filename);
    return entry.isFile() && SOURCE_EXTENSIONS.includes(path.extname(entry.name)) ? [filename] : [];
  });
}

function normalize(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function resolveImport(sourcePath, specifier, root) {
  let base;
  if (specifier.startsWith("@/")) base = path.resolve(root, "src", specifier.slice(2));
  else if (specifier.startsWith("./") || specifier.startsWith("../")) base = path.resolve(path.dirname(sourcePath), specifier);
  else return null;

  const candidates = [base, ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`), ...SOURCE_EXTENSIONS.map((extension) => path.join(base, `index${extension}`))];
  const target = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  return target ? normalize(path.relative(root, target)) : null;
}

function importsIn(source) {
  const imports = [];
  const pattern = /(?:\bimport\s+(?:[^"'\n]*?\s+from\s+)?|\bexport\s+[^"'\n]*?\s+from\s+|\bimport\s*\()(["'])([^"']+)\1/g;
  for (const match of source.matchAll(pattern)) imports.push({ specifier: match[2], offset: match.index ?? 0 });
  return imports;
}

function isException(source, target, exceptions) {
  return exceptions.some((entry) => source === entry.from && target === entry.to);
}

/** Return dependency-direction and client/server boundary violations. */
export function checkArchitecture(root = process.cwd(), options = {}) {
  const rules = options.rules ?? ARCHITECTURE_RULES;
  const exceptions = options.exceptions ?? ARCHITECTURE_EXCEPTIONS;
  const errors = [];
  const files = sourceFiles(path.resolve(root, "src"));

  for (const absolutePath of files) {
    const sourcePath = normalize(path.relative(root, absolutePath));
    const source = fs.readFileSync(absolutePath, "utf8");
    const clientModule = /^\s*["']use client["'];/m.test(source);
    const imports = importsIn(source);
    for (const entry of imports) {
      const target = resolveImport(absolutePath, entry.specifier, root);
      if (!target) continue;
      const line = source.slice(0, entry.offset).split("\n").length;
      for (const rule of rules) {
        if (sourcePath.startsWith(rule.from) && rule.deny.some((prefix) => target.startsWith(prefix))) {
          if (!isException(sourcePath, target, exceptions)) errors.push(`${sourcePath}:${line}: ${rule.message} (${target}; rule ${rule.id}).`);
        }
      }
      if (clientModule && (target.startsWith("src/lib/auth/") || target.startsWith("src/lib/supabase/"))) {
        errors.push(`${sourcePath}:${line}: Client modules cannot import server-only auth, Supabase, or action modules (${target}).`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const result = checkArchitecture(root);
  if (result.ok) console.log("Architecture import boundaries are valid.");
  else {
    console.error(result.errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
