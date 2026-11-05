import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const PACKET_PATH = ".agent-continuity/phase-1.json";
const MAX_PACKET_BYTES = 12_000;
const MAX_CONTEXT_CHARS = 5_000;
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret|credential)\b\s*[:=]\s*["']?[A-Za-z0-9/+=_.-]{16,}/i,
  /\b(?:sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16})\b/,
];

function isTextList(value, limit = 30) {
  return Array.isArray(value) && value.length <= limit && value.every((entry) =>
    typeof entry === "string" && entry.length > 0 && entry.length <= 500);
}

function isIsoDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function containsSecret(packet) {
  const serialized = JSON.stringify(packet);
  return SECRET_PATTERNS.some((pattern) => pattern.test(serialized));
}

export function validatePacketContract(packet) {
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) return "invalid";
  const fields = ["schemaVersion", "objective", "ownerDecisions", "constraints", "worktree", "baseSha", "reviewedFiles", "changedFiles", "checks", "unresolved", "nextAction", "updatedAt", "expiresAt", "lastHook"];
  if (Object.keys(packet).some((field) => !fields.includes(field))) return "invalid";
  if (packet.schemaVersion !== 1 || typeof packet.objective !== "string" || packet.objective.length > 1_000 || !packet.objective.trim()) return "invalid";
  if (!isTextList(packet.ownerDecisions) || !isTextList(packet.constraints) || !isTextList(packet.reviewedFiles, 100) || !isTextList(packet.changedFiles, 100) || !isTextList(packet.unresolved)) return "invalid";
  if (!Array.isArray(packet.checks) || packet.checks.length > 30 || !packet.checks.every((check) =>
    check && typeof check === "object" && Object.keys(check).every((key) => ["name", "status", "details"].includes(key)) &&
    typeof check.name === "string" && check.name.length <= 120 &&
    ["pass", "fail", "unverified", "not-run"].includes(check.status) &&
    (check.details === undefined || typeof check.details === "string" && check.details.length <= 500))) return "invalid";
  if (typeof packet.worktree !== "string" || packet.worktree.length > 500 || !/^[0-9a-f]{40}$/.test(packet.baseSha)) return "invalid";
  if (typeof packet.nextAction !== "string" || packet.nextAction.length > 1_000 || !packet.nextAction.trim()) return "invalid";
  if (!isIsoDate(packet.updatedAt) || !isIsoDate(packet.expiresAt)) return "invalid";
  if (packet.lastHook !== undefined && (!packet.lastHook || Object.keys(packet.lastHook).some((key) => !["platform", "event", "trigger", "at"].includes(key)) ||
    !["codex", "claude"].includes(packet.lastHook.platform) || !["PreCompact"].includes(packet.lastHook.event) ||
    !["manual", "auto"].includes(packet.lastHook.trigger) || !isIsoDate(packet.lastHook.at))) return "invalid";
  if (containsSecret(packet)) return "secret-like";
  if (Buffer.byteLength(JSON.stringify(packet), "utf8") > MAX_PACKET_BYTES) return "too-large";
  return "valid";
}

export function validatePacket(packet, now = new Date()) {
  const contract = validatePacketContract(packet);
  if (contract !== "valid") return contract;
  if (Date.parse(packet.expiresAt) <= now.getTime() || Date.parse(packet.updatedAt) > now.getTime() + 300_000) return "stale";
  return "valid";
}

export function renderContext(packet) {
  const lines = [
    `Phase 1 continuation: ${packet.objective}`,
    `Worktree: ${packet.worktree}`,
    `Base SHA: ${packet.baseSha}`,
    `Owner decisions: ${packet.ownerDecisions.join("; ") || "none recorded"}`,
    `Constraints: ${packet.constraints.join("; ") || "none recorded"}`,
    `Reviewed files: ${packet.reviewedFiles.join(", ") || "none"}`,
    `Changed files: ${packet.changedFiles.join(", ") || "none"}`,
    `Checks: ${packet.checks.map(({ name, status }) => `${name}=${status}`).join(", ") || "none"}`,
    `Unresolved: ${packet.unresolved.join("; ") || "none"}`,
    `Next action: ${packet.nextAction}`,
  ];
  const context = lines.join("\n");
  if (context.length > MAX_CONTEXT_CHARS) throw new Error("continuation context exceeds limit");
  return context;
}

async function readPacketWithValidator(root, validate) {
  const packetFile = path.join(root, PACKET_PATH);
  let packetHandle;
  let text;
  try {
    packetHandle = await fs.open(packetFile, "r");
    if ((await packetHandle.stat()).size > MAX_PACKET_BYTES) return { status: "too-large" };
    text = await packetHandle.readFile("utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return { status: "missing" };
    throw error;
  } finally {
    await packetHandle?.close();
  }
  let packet;
  try {
    packet = JSON.parse(text);
  } catch {
    return { status: "invalid" };
  }
  const status = validate(packet);
  return status === "valid" ? { status, packet } : { status };
}

export function readPacket(root, now = new Date()) {
  return readPacketWithValidator(root, (packet) => validatePacket(packet, now));
}

export function readPacketContract(root) {
  return readPacketWithValidator(root, validatePacketContract);
}

export async function writePacket(root, packet, now = new Date()) {
  const status = validatePacket(packet, now);
  if (status !== "valid") throw new Error(`continuation packet rejected: ${status}`);
  const packetFile = path.join(root, PACKET_PATH);
  await fs.mkdir(path.dirname(packetFile), { recursive: true });
  const temporaryFile = `${packetFile}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryFile, `${JSON.stringify(packet, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await fs.rename(temporaryFile, packetFile);
  } finally {
    await fs.rm(temporaryFile, { force: true });
  }
}
