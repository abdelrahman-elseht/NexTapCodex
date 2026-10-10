import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ claims: vi.fn(), owner: vi.fn(), save: vi.fn(), publish: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getClaims: mocks.claims },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.owner }) }) }),
}) }));
vi.mock("@/app/admin/businesses/actions", () => ({ saveDraftState: mocks.save, publishDraftState: mocks.publish }));
import { POST } from "../../src/app/api/admin/businesses/draft/route";
const request = (mode = "save", origin = "http://localhost:3137") => new Request("http://localhost:3137/api/admin/businesses/draft", {
  method: "POST", headers: { origin }, body: new URLSearchParams({ mode, draft: "{}" }),
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.claims.mockResolvedValue({ data: { claims: { sub: "owner" } }, error: null });
  mocks.owner.mockResolvedValue({ data: { user_id: "owner" }, error: null });
  mocks.save.mockResolvedValue({ ok: true }); mocks.publish.mockResolvedValue({ ok: true, version: 1 });
});
it("rejects cross-origin saves before authentication", async () => {
  expect((await POST(request("save", "https://other.example"))).status).toBe(403);
  expect(mocks.claims).not.toHaveBeenCalled();
});
it("rejects anonymous saves", async () => {
  mocks.claims.mockResolvedValue({ data: null, error: null });
  expect((await POST(request())).status).toBe(401);
  expect(mocks.save).not.toHaveBeenCalled();
});
it("rejects non-owner saves", async () => {
  mocks.owner.mockResolvedValue({ data: null, error: null });
  expect((await POST(request())).status).toBe(403);
  expect(mocks.save).not.toHaveBeenCalled();
});
it("rejects unknown modes without mutation", async () => {
  expect((await POST(request("unknown"))).status).toBe(400);
  expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.publish).not.toHaveBeenCalled();
});
it.each(["save", "publish"])("returns a private JSON result for %s", async mode => {
  const response = await POST(request(mode));
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
  expect((await response.json()).ok).toBe(true);
  expect(mode === "save" ? mocks.save : mocks.publish).toHaveBeenCalledOnce();
  expect(mode === "save" ? mocks.publish : mocks.save).not.toHaveBeenCalled();
});
it("returns validation failures without claiming success", async () => {
  mocks.save.mockResolvedValue({ ok: false, error: "Invalid draft" });
  const response = await POST(request());
  expect(response.status).toBe(400); expect(await response.json()).toEqual({ ok: false, error: "Invalid draft" });
});
