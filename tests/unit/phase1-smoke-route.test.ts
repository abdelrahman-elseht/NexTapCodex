import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import runtime, { type Env } from "../../workers/phase1-foundation/src/index";

const mediaBytes = readFileSync(new URL("../../infra/cloudflare/PHASE_1_RECOVERY_MEDIA_20261114.txt", import.meta.url));
const mediaBody = () => new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(mediaBytes); controller.close(); } });

const fixture = {
  APP_ENV: "staging",
  SMOKE_TOKEN: "ephemeral-smoke-secret",
  SMOKE_D1_FIXTURE_ID: "recovery-20261114-7f3a-business",
  SMOKE_R2_FIXTURE_KEY: "recovery-20261114-7f3a/media/synthetic.txt",
  NEXTAP_DB: { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first: vi.fn(async () => 1) })) })) },
  NEXTAP_PUBLIC_MEDIA: { head: vi.fn() },
  SMOKE_RECOVERY_MEDIA: { get: vi.fn(async () => ({ key: "recovery-20261114-7f3a/media/synthetic.txt", size: 74, etag: "synthetic", body: mediaBody(), httpEtag: "synthetic", writeHttpMetadata: vi.fn() })) },
  NEXTAP_SLUG_CACHE: {} as Env["NEXTAP_SLUG_CACHE"],
} as unknown as Env;

describe("Phase 1 reachable smoke route", () => {
  it("checks shorter and longer bearer values without changing exact-token behavior", async () => {
    vi.clearAllMocks();
    for (const authorization of ["Bearer ephemeral-smoke-secre", "Bearer ephemeral-smoke-secret-extra"]) {
      const denied = await runtime.fetch(new Request("https://worker.test/__ops/smoke", {
        headers: { authorization },
      }), fixture);
      expect(denied.status).toBe(404);
    }
    expect(fixture.NEXTAP_DB.prepare).not.toHaveBeenCalled();
    expect(fixture.SMOKE_RECOVERY_MEDIA?.get).not.toHaveBeenCalled();

    const accepted = await runtime.fetch(new Request("https://worker.test/__ops/smoke", {
      headers: { authorization: "Bearer ephemeral-smoke-secret" },
    }), fixture);
    expect(accepted.status).toBe(200);
  });

  it("requires the ephemeral bearer secret and returns only environment and health booleans", async () => {
    const denied = await runtime.fetch(new Request("https://worker.test/__ops/smoke"), fixture);
    expect(denied.status).toBe(404);

    const response = await runtime.fetch(new Request("https://worker.test/__ops/smoke", {
      headers: { authorization: "Bearer ephemeral-smoke-secret" },
    }), fixture);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ environment: "staging", healthy: true, checks: { d1: true, r2: true } });
    expect(JSON.stringify(body)).not.toContain("recovery-20261114-7f3a-business");
    expect(JSON.stringify(body)).not.toContain("recovery-20261114-7f3a/media/synthetic.txt");
    expect(fixture.NEXTAP_DB.prepare).toHaveBeenCalledWith("SELECT 1 AS ready FROM businesses WHERE id = ? LIMIT 1");
    expect(fixture.SMOKE_RECOVERY_MEDIA?.get).toHaveBeenCalledWith("recovery-20261114-7f3a/media/synthetic.txt");
    expect(fixture.NEXTAP_PUBLIC_MEDIA.head).not.toHaveBeenCalled();
  });

  it("rejects unapproved fixture IDs and keys before probing dependencies", async () => {
    vi.clearAllMocks();
    for (const changed of [
      { ...fixture, SMOKE_D1_FIXTURE_ID: "another-business" },
      { ...fixture, SMOKE_R2_FIXTURE_KEY: "another/object.txt" },
    ]) {
      const response = await runtime.fetch(new Request("https://worker.test/__ops/smoke", {
        headers: { authorization: "Bearer ephemeral-smoke-secret" },
      }), changed as unknown as Env);
      expect(response.status).toBe(404);
    }
    expect(fixture.NEXTAP_DB.prepare).not.toHaveBeenCalled();
    expect(fixture.SMOKE_RECOVERY_MEDIA?.get).not.toHaveBeenCalled();
  });

  it.each([
    ["wrong key", { key: "another/object.txt", size: 74, bytes: mediaBytes }],
    ["wrong declared size", { key: "recovery-20261114-7f3a/media/synthetic.txt", size: 73, bytes: mediaBytes }],
    ["wrong body hash", { key: "recovery-20261114-7f3a/media/synthetic.txt", size: 74, bytes: Buffer.from("x".repeat(74)) }],
  ])("reports R2 unhealthy for %s", async (_reason, object) => {
    const changed = {
      ...fixture,
      SMOKE_RECOVERY_MEDIA: { get: vi.fn(async () => ({ key: object.key, size: object.size, etag: "synthetic", body: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(object.bytes); controller.close(); } }), httpEtag: "synthetic", writeHttpMetadata: vi.fn() })) },
    } as unknown as Env;
    const response = await runtime.fetch(new Request("https://worker.test/__ops/smoke", {
      headers: { authorization: "Bearer ephemeral-smoke-secret" },
    }), changed);
    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"environment":"staging","healthy":false,"checks":{"d1":true,"r2":false}}');
  });

  it("does not expose other routes or non-GET smoke methods", async () => {
    expect((await runtime.fetch(new Request("https://worker.test/b/example"), fixture)).status).toBe(404);
    expect((await runtime.fetch(new Request("https://worker.test/__ops/smoke?debug=1", {
      headers: { authorization: "Bearer ephemeral-smoke-secret" },
    }), fixture)).status).toBe(404);
    const response = await runtime.fetch(new Request("https://worker.test/__ops/smoke", {
      method: "POST",
      headers: { authorization: "Bearer ephemeral-smoke-secret" },
    }), fixture);
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });

  it("reports dependency failures as health booleans without leaking errors", async () => {
    const broken = {
      ...fixture,
      NEXTAP_DB: { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first: vi.fn(async () => { throw new Error("private d1 detail"); }) })) })) },
      SMOKE_RECOVERY_MEDIA: { get: vi.fn(async () => null) },
    } as unknown as Env;
    const response = await runtime.fetch(new Request("https://worker.test/__ops/smoke", {
      headers: { authorization: "Bearer ephemeral-smoke-secret" },
    }), broken);
    const output = await response.text();
    expect(response.status).toBe(503);
    expect(output).toBe('{"environment":"staging","healthy":false,"checks":{"d1":false,"r2":false}}');
    expect(output).not.toContain("private d1 detail");
  });
});
