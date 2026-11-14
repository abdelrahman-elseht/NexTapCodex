import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const FILE_BUDGETS = { warning: 250, hardCap: 350 };

// Calibrated against the existing source inventory on 2026-11-12. Existing
// oversized files are growth-only until they are reduced below the thresholds.
export const GRANDFATHERED_LINES = {
  "src/app/admin/cards/page.tsx": 307,
};

const EXTENSIONS = new Set([".ts", ".tsx"]);
const GENERATED_SUFFIXES = [".d.ts", ".generated.ts", ".generated.tsx"];

function sourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(filename);
    const basename = entry.name;
    return entry.isFile() && EXTENSIONS.has(path.extname(basename)) && !GENERATED_SUFFIXES.some((suffix) => basename.endsWith(suffix)) ? [filename] : [];
  });
}

function lineCount(source) {
  const normalized = source.replace(/\r\n?/g, "\n");
  if (!normalized) return 0;
  return normalized.endsWith("\n") ? normalized.slice(0, -1).split("\n").length : normalized.split("\n").length;
}

/** Check handwritten src TS/TSX files; grandfathered files are growth-only. */
export function checkFileBudget(root = process.cwd(), options = {}) {
  const warning = options.warning ?? FILE_BUDGETS.warning;
  const hardCap = options.hardCap ?? FILE_BUDGETS.hardCap;
  const baseline = options.baseline ?? GRANDFATHERED_LINES;
  const warnings = [];
  const errors = [];
  const files = sourceFiles(path.resolve(root, "src"));
  for (const absolutePath of files) {
    const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
    const lines = lineCount(fs.readFileSync(absolutePath, "utf8"));
    const grandfathered = baseline[relativePath];
    if (grandfathered !== undefined) {
      if (lines > grandfathered) {
        const message = `${relativePath}: grew from its grandfathered ${grandfathered}-line baseline to ${lines} lines.`;
        if (lines > hardCap) errors.push(`${message} Hard cap is ${hardCap}.`);
        else warnings.push(message);
      }
      continue;
    }
    if (lines > hardCap) errors.push(`${relativePath}: ${lines} lines exceeds the ${hardCap}-line hard cap.`);
    else if (lines > warning) warnings.push(`${relativePath}: ${lines} lines exceeds the ${warning}-line warning threshold.`);
  }
  return { ok: errors.length === 0, errors, warnings, filesChecked: files.length };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const result = checkFileBudget(root);
  for (const warning of result.warnings) console.warn(`WARN: ${warning}`);
  if (result.ok) console.log(`File budget checked ${result.filesChecked} source files.`);
  else {
    console.error(result.errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
