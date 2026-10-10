import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), read: vi.fn(), delete: vi.fn(), insert: vi.fn() }));
vi.mock("@/lib/auth/owner", () => ({ requireOwner: async () => ({ supabase: {
  rpc: mocks.rpc, from: () => ({ select: () => ({ eq: () => ({ order: mocks.read }) }), delete: mocks.delete, insert: mocks.insert }),
} }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { saveDraftState } from "../app/admin/businesses/actions";
const fd = () => { const form = new FormData(); form.set("draft", JSON.stringify({ businessId: "biz", pageId: "page", name: "QA", slug: "qa-test", template: "professional", sections: [{ section_key: "hero_1", kind: "hero", content: {}, enabled: true }] })); return form; };
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null }); mocks.read.mockResolvedValue({ data: [{ section_key: "hero_1", kind: "hero", content: {}, position: 0 }], error: null }); });
it("preserves unique editor section keys and supports the provider RPC", async () => {
  expect((await saveDraftState(fd())).ok).toBe(true);
  expect(mocks.rpc.mock.calls[0][1].section_rows[0].section_key).toBe("hero_1");
  expect(mocks.rpc.mock.calls[0][1]).toHaveProperty("target_provider_profiles");
});
it("supports an explicitly missing provider argument without destructive repair", async () => {
  mocks.rpc.mockResolvedValueOnce({ error: { code: "PGRST202", message: "target_provider_profiles does not exist" } });
  expect((await saveDraftState(fd())).ok).toBe(true);
  expect(mocks.rpc.mock.calls[1][1]).not.toHaveProperty("target_provider_profiles");
});
it("failed verification never deletes or reinserts committed sections", async () => {
  mocks.read.mockResolvedValue({ data: null, error: { message: "network failure" } });
  expect((await saveDraftState(fd())).ok).toBe(false);
  expect(mocks.delete).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled();
});
it("a network failure never retries with a legacy contract", async () => {
  mocks.rpc.mockResolvedValue({ error: { code: "NETWORK", message: "network unavailable" } });
  expect((await saveDraftState(fd())).ok).toBe(false); expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
