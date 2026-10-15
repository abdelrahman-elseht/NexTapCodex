import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ claims: vi.fn(), owner: vi.fn(), rpc: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.claims }, rpc: mocks.rpc,
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.owner }) }) }) }) }));
import { POST } from "../../src/app/api/admin/cards/deletion/route";
import { GET as csv } from "../../src/app/admin/cards/export/route";
import { GET as zip } from "../../src/app/admin/cards/batches/[id]/manufacturing.zip/route";
vi.mock("@/lib/auth/owner", () => ({ requireOwner: async () => ({ supabase: { rpc: mocks.rpc } }) }));
const id = "11111111-1111-4111-8111-111111111111";
const request = (body: unknown, origin: string | null = "https://admin.example.test") => new Request("https://admin.example.test/api/admin/cards/deletion", {
  method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(body),
});
beforeEach(() => { vi.clearAllMocks(); mocks.claims.mockResolvedValue({ data: { claims: { sub: id } } }); mocks.owner.mockResolvedValue({ data: { user_id: id } }); mocks.rpc.mockResolvedValue({ data: { operationId: id }, error: null }); });
it.each([null, "https://other.test"])("denies deletion from origin %s", async origin => {
  expect((await POST(request({ mode: "preview", cardIds: [id] }, origin))).status).toBe(403); expect(mocks.rpc).not.toHaveBeenCalled();
});
it("denies expired sessions and authenticated nonowners", async () => {
  mocks.claims.mockResolvedValueOnce({ data: null }); expect((await POST(request({}))).status).toBe(401);
  mocks.owner.mockResolvedValueOnce({ data: null }); expect((await POST(request({}))).status).toBe(403); expect(mocks.rpc).not.toHaveBeenCalled();
});
it.each([{ mode: "preview", cardIds: [] }, { mode: "preview", cardIds: [id], batchId: id }, { mode: "preview", cardIds: ["bad"] }, { mode: "commit", operationId: id, acknowledged: false }])("rejects invalid/unconfirmed scope %j", async body => {
  expect((await POST(request(body))).status).toBe(422); expect(mocks.rpc).not.toHaveBeenCalled();
});
it("bounds a streamed body even without Content-Length", async () => {
  expect((await POST(request({ extra: "a".repeat(66000) }))).status).toBe(400); expect(mocks.rpc).not.toHaveBeenCalled();
});
it("deduplicates IDs and never expands a selection from filters", async () => {
  const response = await POST(request({ mode: "preview", cardIds: [id,id], search: "all" }));
  expect(response.status).toBe(200); expect(mocks.rpc).toHaveBeenCalledWith("preview_card_deletion", { card_ids: [id], batch_id: null });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it.each([["40001",409],["P0002",404],["42501",403],["XX000",500]])("classifies database %s without false success", async (code,status) => {
  mocks.rpc.mockResolvedValue({ error: { code } }); const response = await POST(request({ mode: "commit", operationId: id, acknowledged: true }));
  expect(response.status).toBe(status); expect((await response.json()).ok).toBe(false);
});
it.each(["csv", "zip"])("%s distinguishes missing, empty, and partial batches", async format => {
  const get = () => format === "csv" ? csv(new Request(`https://admin.example.test/admin/cards/export?batch=${id}`)) : zip(new Request("https://admin.example.test"), { params: Promise.resolve({ id }) });
  mocks.rpc.mockResolvedValueOnce({ data: null }); expect((await get()).status).toBe(404);
  const batch = { id, batch_code: "BATCH-002", quantity: 10 };
  mocks.rpc.mockResolvedValueOnce({ data: { batch, cards: [] } }); expect((await get()).status).toBe(409);
  mocks.rpc.mockResolvedValueOnce({ data: { batch, cards: [{ serial: "NT-20261015-000001", token: "S".repeat(32), status: "unassigned" }] } });
  const response = await get(); expect(response.status).toBe(200); expect(response.headers.get("content-disposition")).toContain("attachment");
  expect(mocks.rpc).toHaveBeenLastCalledWith("card_batch_snapshot", { target_batch: id });
});
