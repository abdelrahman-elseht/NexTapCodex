import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchApp } from "../../tests/e2e/_helpers/http";

afterEach(() => vi.unstubAllGlobals());

describe("local E2E HTTP helper", () => {
  it("rejects hosted targets before making a request", () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);

    expect(() => fetchApp(new URL("https://staging.nextap.services/health"))).toThrow(
      "E2E HTTP requests must target the local app.",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("keeps local requests manual and sends no deployment bypass header", async () => {
    const request = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", request);

    await fetchApp(new URL("http://127.0.0.1:3000/health"));

    const [, init] = request.mock.calls[0] as [URL, RequestInit];
    expect(init.redirect).toBe("manual");
    expect(new Headers(init.headers).has("x-vercel-protection-bypass")).toBe(false);
  });
});
