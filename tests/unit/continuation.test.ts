import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const continuityCli = path.join(root, "scripts/continuity/continuation.mjs");
const hookCli = path.join(root, "scripts/continuity/hook.mjs");
const temporaryRoots: string[] = [];
const basePacket = {
  schemaVersion: 1,
  objective: "Complete the six Phase 1 foundation packages.",
  ownerDecisions: ["Supabase owns Auth, RLS and owner writes."],
  constraints: ["No hosted changes or Production data."],
  worktree: "F:/projects/NexTap-contacts-phase1",
  baseSha: "230adeca680c0fe7e22b3ece0fd9169764b84ffe",
  reviewedFiles: ["docs/ARCHITECTURE.md", "src/lib/business/public-publication.ts"],
  changedFiles: ["docs/program/phase-1-tasks/", "stryker.config.mjs"],
  checks: [{ name: "focused publication tests", status: "pass" }],
  unresolved: ["Classify the latest mutation report."],
  nextAction: "Set the measured changed-module ratchet, then select Task 1.5.",
  updatedAt: "2026-11-05T00:00:00.000Z",
  expiresAt: "2026-12-05T00:00:00.000Z",
};

async function createRoot() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nextap-continuity-"));
  temporaryRoots.push(directory);
  return directory;
}

async function putPacket(directory: string, packet: unknown = basePacket) {
  const packetDirectory = path.join(directory, ".agent-continuity");
  await mkdir(packetDirectory, { recursive: true });
  await writeFile(path.join(packetDirectory, "phase-1.json"), `${JSON.stringify(packet)}\n`, "utf8");
}

function run(script: string, args: string[], directory: string, input?: string, now = "2026-11-10T00:00:00.000Z") {
  // Freeze the child process clock at the system boundary, without adding a production bypass.
  const clock = `const RealDate = Date; globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [${JSON.stringify(now)}])); }
    static now() { return new RealDate(${JSON.stringify(now)}).getTime(); }
  };`;
  const preload = `data:text/javascript,${encodeURIComponent(clock)}`;
  return spawnSync(process.execPath, ["--import", preload, script, ...args], {
    cwd: directory,
    encoding: "utf8",
    input,
    env: { ...process.env, AGENT_CONTINUITY_ROOT: directory },
  });
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("continuation packet commands", () => {
  it("saves and validates a bounded schema without printing its contents", async () => {
    const directory = await createRoot();
    const saved = run(continuityCli, ["save"], directory, JSON.stringify(basePacket));
    expect(saved.status).toBe(0);
    expect(saved.stdout.trim()).toBe("saved");
    expect(saved.stdout).not.toContain(basePacket.objective);
    expect(run(continuityCli, ["validate"], directory).stdout.trim()).toBe("valid");
  });

  it("rejects stale, malformed, and secret-like packets without echoing content", async () => {
    const directory = await createRoot();
    const expired = { ...basePacket, expiresAt: "2026-11-01T00:00:00.000Z" };
    const staleRun = run(continuityCli, ["save"], directory, JSON.stringify(expired));
    expect(staleRun.status).not.toBe(0);
    expect(staleRun.stderr).toContain("stale");

    const secret = { ...basePacket, nextAction: "api_key=abcd1234abcd1234abcd1234" };
    const secretRun = run(continuityCli, ["save"], directory, JSON.stringify(secret));
    expect(secretRun.status).not.toBe(0);
    expect(secretRun.stderr).toContain("secret-like");
    expect(secretRun.stderr).not.toContain("abcd1234");

    const malformedRun = run(continuityCli, ["save"], directory, "{bad json");
    expect(malformedRun.status).not.toBe(0);
    expect(malformedRun.stderr).not.toContain("bad json");

    const oversizedRun = run(continuityCli, ["save"], directory, JSON.stringify({ ...basePacket, objective: "x".repeat(12_001) }));
    expect(oversizedRun.status).not.toBe(0);
    expect(oversizedRun.stderr).not.toContain("x".repeat(100));
  });

  it("validates the committed historical contract after expiry while session validation rejects it", async () => {
    const directory = await createRoot();
    const committedPacket = JSON.parse(await readFile(path.join(root, ".agent-continuity/phase-1.json"), "utf8"));
    await putPacket(directory, committedPacket);
    const afterExpiry = new Date(Date.parse(committedPacket.expiresAt) + 1_000).toISOString();
    const contract = run(continuityCli, ["validate-contract"], directory, undefined, afterExpiry);
    expect(contract.status).toBe(0);
    expect(contract.stdout.trim()).toBe("valid");
    const session = run(continuityCli, ["validate"], directory, undefined, afterExpiry);
    expect(session.status).not.toBe(0);
    expect(session.stdout.trim()).toBe("stale");
  });

  it.each([
    ["malformed date", { ...basePacket, expiresAt: "not-a-date" }, "invalid"],
    ["secret-like content", { ...basePacket, nextAction: "api_key=abcd1234abcd1234abcd1234" }, "secret-like"],
    ["oversized file", { ...basePacket, objective: "x".repeat(12_001) }, "too-large"],
  ])("rejects %s in the historical contract", async (_scenario, packet, expected) => {
    const directory = await createRoot();
    await putPacket(directory, packet);
    const result = run(continuityCli, ["validate-contract"], directory);
    expect(result.status).not.toBe(0);
    expect(result.stdout.trim()).toBe(expected);
  });

  it("restores only for the explicit compact source", async () => {
    const directory = await createRoot();
    await putPacket(directory);
    const restored = run(continuityCli, ["restore", "compact"], directory);
    expect(restored.status).toBe(0);
    expect(restored.stdout).toContain(basePacket.nextAction);
    expect(run(continuityCli, ["restore", "startup"], directory).status).not.toBe(0);

    const missingRoot = await createRoot();
    const missing = run(hookCli, ["--platform", "codex"], missingRoot, JSON.stringify({
      hook_event_name: "SessionStart",
      source: "compact",
    }));
    expect(missing.status).toBe(0);
    expect(missing.stdout).toBe("");
  });
});

describe("host continuation adapters", () => {
  it.each(["codex", "claude"] as const)("saves manual and automatic compaction state and restores on compact resume for %s", async (platform) => {
    const directory = await createRoot();
    await putPacket(directory);
    for (const trigger of ["manual", "auto"] as const) {
      const event = platform === "codex"
        ? {
            session_id: "thr_test",
            transcript_path: null,
            cwd: directory,
            hook_event_name: "PreCompact",
            model: "gpt-test",
            turn_id: "turn-test",
            trigger,
          }
        : {
            session_id: "claude-test",
            transcript_path: path.join(directory, "transcript.jsonl"),
            cwd: directory,
            hook_event_name: "PreCompact",
            trigger,
            custom_instructions: null,
          };
      const saved = run(hookCli, ["--platform", platform], directory, JSON.stringify(event));
      expect(saved.status).toBe(0);
      expect(saved.stdout).toBe("");
    }
    const packet = JSON.parse(await readFile(path.join(directory, ".agent-continuity/phase-1.json"), "utf8"));
    expect(packet.lastHook).toMatchObject({ platform, event: "PreCompact", trigger: "auto" });
    expect(JSON.stringify(packet)).not.toContain("transcript_path");
    expect(JSON.stringify(packet)).not.toContain("custom_instructions");

    const resumeEvent = platform === "codex"
      ? {
          session_id: "thr_test",
          transcript_path: null,
          cwd: directory,
          hook_event_name: "SessionStart",
          model: "gpt-test",
          permission_mode: "default",
          source: "compact",
        }
      : {
          session_id: "claude-test",
          transcript_path: path.join(directory, "transcript.jsonl"),
          cwd: directory,
          hook_event_name: "SessionStart",
          source: "compact",
          model: "claude-test",
        };
    const resumed = run(hookCli, ["--platform", platform], directory, JSON.stringify(resumeEvent));
    expect(resumed.status).toBe(0);
    expect(JSON.parse(resumed.stdout).hookSpecificOutput).toMatchObject({
      hookEventName: "SessionStart",
      additionalContext: expect.stringContaining(basePacket.nextAction),
    });

    const startupEvent = platform === "codex"
      ? { session_id: "thr_test", transcript_path: null, cwd: directory, hook_event_name: "SessionStart", model: "gpt-test", permission_mode: "default", source: "startup" }
      : { session_id: "claude-test", transcript_path: null, cwd: directory, hook_event_name: "SessionStart", source: "startup", model: "claude-test" };
    const ordinaryStartup = run(hookCli, ["--platform", platform], directory, JSON.stringify(startupEvent));
    expect(ordinaryStartup.status).toBe(0);
    expect(ordinaryStartup.stdout).toBe("");
  });
});
