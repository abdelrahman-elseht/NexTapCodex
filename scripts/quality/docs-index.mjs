import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REQUIRED_GUIDES = [
  "docs/ARCHITECTURE.md",
  "docs/TESTING.md",
  "docs/COMPONENTS.md",
  "docs/DATA_MODEL.md",
];
const AUTHORITATIVE_DIRS = ["docs/specs", "docs/adr"];
const REQUIRED_FIELDS = ["Status", "Owner", "Supersedes", "Path globs", "Topic tags"];
const PLACEHOLDER = /^(?:todo|tbd|pending|unknown|fill[ -]?in|<.*>)$/i;

function markdownWithoutFences(source) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const output = [];
  let fence = null;
  for (const line of lines) {
    const match = line.match(/^\s*(```+|~~~+)/);
    if (match) {
      if (!fence) fence = match[1][0];
      else if (match[1][0] === fence) fence = null;
      output.push("");
    } else output.push(fence ? "" : line);
  }
  return output.join("\n");
}

function markdownLinks(source) {
  const text = markdownWithoutFences(source);
  const links = [];
  const expression = /!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+[^)]*)?\)/g;
  for (const match of text.matchAll(expression)) links.push(match[1] ?? match[2]);
  return links;
}

function parseList(value) {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const body = trimmed.startsWith("[") && trimmed.endsWith("]")
    ? trimmed.slice(1, -1)
    : trimmed;
  return body.split(",").map((item) => item.trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2")).filter(Boolean);
}

function parseFrontMatter(source) {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("---\n")) return { fields: {}, body: normalized, present: false };
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) return { fields: {}, body: normalized, present: true, malformed: true };
  const fields = {};
  for (const line of normalized.slice(4, end).split("\n")) {
    const match = line.match(/^([A-Za-z][A-Za-z -]*):\s*(.*?)\s*$/);
    if (match) fields[match[1].toLowerCase()] = match[2];
  }
  return { fields, body: normalized.slice(end + 5), present: true };
}

function localTarget(sourcePath, rawHref) {
  const href = rawHref.trim();
  if (!href || href.startsWith("#") || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return null;
  let pathname;
  try { pathname = decodeURIComponent(href.split(/[?#]/, 1)[0]); }
  catch { return path.resolve(path.dirname(sourcePath), href.split(/[?#]/, 1)[0]); }
  if (!pathname) return null;
  return path.normalize(path.resolve(path.dirname(sourcePath), pathname));
}

function indexTargets(source, indexPath) {
  return new Set(markdownLinks(source).map((href) => localTarget(indexPath, href)).filter(Boolean));
}

function collectMarkdownFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectMarkdownFiles(entryPath);
    return entry.isFile() && entry.name.toLowerCase().endsWith(".md") ? [entryPath] : [];
  });
}

function addMetadataErrors(errors, relativePath, source, root) {
  const parsed = parseFrontMatter(source);
  if (!parsed.present) {
    errors.push(`${relativePath}: authoritative document is missing YAML front matter.`);
    return;
  }
  if (parsed.malformed) {
    errors.push(`${relativePath}: YAML front matter is not closed by a second --- line.`);
    return;
  }
  const fields = parsed.fields;
  for (const field of REQUIRED_FIELDS) {
    const value = fields[field.toLowerCase()];
    if (!value || PLACEHOLDER.test(value)) errors.push(`${relativePath}: missing or placeholder ${field} metadata.`);
  }
  const status = fields.status?.trim();
  if (status && !/^(current|proposed|historical|approved-scope)\b.*$/i.test(status)) {
    errors.push(`${relativePath}: Status must identify current, proposed, historical, or approved-scope state.`);
  }
  const supersedes = fields.supersedes?.trim();
  if (supersedes && !/^none$/i.test(supersedes)) {
    for (const target of parseList(supersedes)) {
      const resolved = path.resolve(root, target);
      if (!fs.existsSync(resolved)) errors.push(`${relativePath}: Supersedes target does not exist: ${target}.`);
    }
  }
  const globs = parseList(fields["path globs"] ?? "");
  if (globs.some((glob) => path.isAbsolute(glob) || glob.split(/[\\/]/).includes(".."))) {
    errors.push(`${relativePath}: Path globs must be repo-relative and cannot traverse upward.`);
  }
  const tags = parseList(fields["topic tags"] ?? "");
  if (tags.some((tag) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(tag))) {
    errors.push(`${relativePath}: Topic tags must be comma-separated simple words or hyphenated tags.`);
  }
}

/** Validate authoritative-doc registration and local links in docs/README.md. */
export function validateDocsIndex(root = process.cwd()) {
  const errors = [];
  const indexPath = path.resolve(root, "docs/README.md");
  if (!fs.existsSync(indexPath)) return { ok: false, errors: ["docs/README.md: documentation index is missing."] };

  const indexSource = fs.readFileSync(indexPath, "utf8");
  const indexedTargets = indexTargets(indexSource, indexPath);
  for (const href of markdownLinks(indexSource)) {
    const target = localTarget(indexPath, href);
    if (target && !fs.existsSync(target)) errors.push(`docs/README.md: local link target does not exist: ${href}.`);
  }

  const candidates = new Set(REQUIRED_GUIDES.map((entry) => path.resolve(root, entry)));
  for (const directory of AUTHORITATIVE_DIRS) {
    for (const file of collectMarkdownFiles(path.resolve(root, directory))) candidates.add(file);
  }
  for (const absolutePath of candidates) {
    if (!fs.existsSync(absolutePath)) {
      errors.push(`${path.relative(root, absolutePath)}: required authoritative document is missing.`);
      continue;
    }
    const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
    const source = fs.readFileSync(absolutePath, "utf8");
    addMetadataErrors(errors, relativePath, source, root);
    if (!indexedTargets.has(absolutePath)) errors.push(`${relativePath}: authoritative document is not registered in docs/README.md.`);
  }
  return { ok: errors.length === 0, errors };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const result = validateDocsIndex(root);
  if (result.ok) console.log("Documentation index and authoritative registrations are valid.");
  else {
    console.error(result.errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
