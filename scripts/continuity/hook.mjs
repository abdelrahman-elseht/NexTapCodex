import { renderContext, readPacket, writePacket } from "./packet.mjs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

async function readInput() {
  const chunks = [];
  let byteLength = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk);
    byteLength += buffer.length;
    if (byteLength > 16_000) throw new Error("hook input too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function hookOutput(context) {
  const eventName = "SessionStart";
  const result = {
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: context,
    },
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

async function saveCheckpoint(platform, event) {
  if (event.hook_event_name !== "PreCompact" || !["manual", "auto"].includes(event.trigger)) return;
  const root = process.env.AGENT_CONTINUITY_ROOT || process.cwd();
  const current = await readPacket(root);
  if (current.status !== "valid") throw new Error(`continuation packet ${current.status}`);
  const packet = {
    ...current.packet,
    lastHook: { platform, event: "PreCompact", trigger: event.trigger, at: new Date().toISOString() },
  };
  await writePacket(root, packet);
}

async function restoreCheckpoint(event) {
  if (event.hook_event_name !== "SessionStart" || event.source !== "compact") return;
  const root = process.env.AGENT_CONTINUITY_ROOT || process.cwd();
  const current = await readPacket(root);
  if (current.status === "missing") return;
  if (current.status !== "valid") throw new Error(`continuation packet ${current.status}`);
  hookOutput(renderContext(current.packet));
}

async function main() {
  const platformIndex = process.argv.indexOf("--platform");
  const platform = process.argv[platformIndex + 1];
  if (!["codex", "claude"].includes(platform)) throw new Error("platform must be codex or claude");
  const event = await readInput();
  if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("invalid hook event");
  if (event.hook_event_name === "PreCompact") return saveCheckpoint(platform, event);
  if (event.hook_event_name === "SessionStart") return restoreCheckpoint(event);
}

main().catch((error) => fail(error.message.startsWith("continuation packet ") ? error.message : "continuity hook failed"));
