import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ claims: vi.fn(), owner: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getClaims: mocks.claims }, rpc: mocks.rpc,
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.owner }) }) }),
}) }));
import { POST } from "../../src/app/api/admin/cards/assignment/route";
const card = "11111111-1111-4111-8111-111111111111";
const page = "22222222-2222-4222-8222-222222222222";
const request = (fields: Record<string,string> = {}, origin: string | null = "http://localhost:3137") => new Request("http://localhost:3137/api/admin/cards/assignment", {
  method: "POST", headers: origin ? { origin } : {},
  body: new URLSearchParams({ card_id: card, page_id: page, confirm: "on", ...fields }),
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.claims.mockResolvedValue({ data: { claims: { sub: "owner" } }, error: null });
  mocks.owner.mockResolvedValue({ data: { user_id: "owner" }, error: null });
  mocks.rpc.mockResolvedValue({ error: null });
});
it.each([null, "https://other.example"])("rejects an untrusted origin (%s) before any database access", async origin => {
  expect((await POST(request({}, origin))).status).toBe(403);
  expect(mocks.claims).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects anonymous users", async () => {
  mocks.claims.mockResolvedValue({ data: null, error: null });
  expect((await POST(request())).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects authenticated non-owners", async () => {
  mocks.owner.mockResolvedValue({ data: null, error: null });
  expect((await POST(request())).status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("assigns a card and redirects with GET semantics", async () => {
  const response = await POST(request());
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("http://localhost:3137/admin/cards?assigned=1");
  expect(mocks.rpc).toHaveBeenCalledWith("assign_card", { card_id: card, target_page_id: page, next_status: "active", change_reason: "reassignment" });
});
it("uses the requested host when middleware normalizes the internal URL", async () => {
  const req = request({}, "http://127.0.0.1:3137");
  req.headers.set("host", "127.0.0.1:3137");
  expect((await POST(req)).headers.get("location")).toBe("http://127.0.0.1:3137/admin/cards?assigned=1");
});
it("deactivates using the existing atomic RPC", async () => {
  expect((await POST(request({ mode: "disable", page_id: "" }))).status).toBe(303);
  expect(mocks.rpc).toHaveBeenCalledWith("assign_card", { card_id: card, target_page_id: null, next_status: "disabled", change_reason: "deactivation" });
});
it("does not mutate malformed or unconfirmed requests", async () => {
  const invalidRequests: Record<string, string>[] = [{ confirm: "" }, { card_id: "invalid" }, { page_id: "" }, { mode: "unknown" }];
  for (const fields of invalidRequests) {
    expect((await POST(request(fields))).headers.get("location")).toContain("error=");
  }
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("reports an RPC rejection without a false success", async () => {
  mocks.rpc.mockResolvedValue({ error: { message: "Rejected" } });
  expect((await POST(request())).headers.get("location")).toContain("error=assignment");
});
