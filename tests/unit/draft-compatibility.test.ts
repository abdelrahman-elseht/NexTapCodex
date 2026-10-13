import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), delete: vi.fn(), insert: vi.fn() }));
vi.mock("@/lib/auth/owner", () => ({ requireOwner: async () => ({ supabase: {
  rpc: mocks.rpc, from: () => ({ delete: mocks.delete, insert: mocks.insert }),
} }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { saveDraftState } from "../../src/app/admin/businesses/actions";
const fd = () => { const form = new FormData(); form.set("draft", JSON.stringify({ businessId: "biz", pageId: "page", name: "QA", slug: "qa-test", template: "professional", sections: [{ section_key: "hero_1", kind: "hero", content: {}, enabled: true }] })); return form; };
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: { ok: true, sectionCount: 1 }, error: null }); });
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
it("does not issue a redundant verification read after a committed RPC", async () => {
  expect((await saveDraftState(fd())).ok).toBe(true);
  expect(mocks.delete).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled();
});
it("rejects an incomplete committed result without attempting repair", async () => {
  mocks.rpc.mockResolvedValue({ data: { ok: true, sectionCount: 0 }, error: null });
  expect((await saveDraftState(fd())).ok).toBe(false);
  expect(mocks.delete).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled();
});
it("a network failure never retries with a legacy contract", async () => {
  mocks.rpc.mockResolvedValue({ error: { code: "NETWORK", message: "network unavailable" } });
  expect((await saveDraftState(fd())).ok).toBe(false); expect(mocks.rpc).toHaveBeenCalledTimes(1);
});

it("preserves empty section text, stable item IDs and nested service actions in the actual save payload", async () => {
  const form = fd();
  const draft = JSON.parse(String(form.get("draft")));
  draft.sections.push(
    { section_key: "hours", kind: "hours", title: "", enabled: true, content: { eyebrow: "", description: "", items: [
      { id: "mon", label: "Monday", value: "09:00–17:00", provider: "custom" },
      { id: "tue", label: "Tuesday", value: "11:00–19:00", provider: "custom" },
    ] } },
    { section_key: "services", kind: "services", title: "", enabled: true, content: { items: [{ id: "service", label: "", subtitle: "", actions: [{ id: "book", label: "Book", url: "https://example.test/book" }] }] } },
  );
  form.set("draft", JSON.stringify(draft));
  mocks.rpc.mockResolvedValue({ data: { ok: true, sectionCount: 3 }, error: null });
  expect((await saveDraftState(form)).ok).toBe(true);
  const rows = mocks.rpc.mock.calls[0][1].section_rows;
  expect(rows[1].title).toBe("");
  expect(rows[1].content).toMatchObject({ eyebrow: "", description: "", items: [{ id: "mon", value: "09:00–17:00" }, { id: "tue", value: "11:00–19:00" }] });
  expect(rows[1].content.items[0].provider).toBeUndefined();
  expect(rows[2].content.items[0]).toMatchObject({ id: "service", label: "", subtitle: "", actions: [{ id: "book", url: "https://example.test/book" }] });
});
