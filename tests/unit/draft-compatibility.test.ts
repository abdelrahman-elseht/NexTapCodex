import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), delete: vi.fn(), insert: vi.fn() }));
vi.mock("@/lib/auth/owner", () => ({ requireOwner: async () => ({ supabase: {
  rpc: mocks.rpc, from: () => ({ delete: mocks.delete, insert: mocks.insert }),
} }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { parseDraft, saveDraftState } from "../../src/app/admin/businesses/actions";
const fd = () => { const form = new FormData(); form.set("draft", JSON.stringify({ businessId: "biz", pageId: "page", name: "QA", expectedPageRevision: 0, expectedBusinessRevision: 0, slug: "qa-test", template: "professional", sections: [{ section_key: "hero_1", kind: "hero", content: {}, enabled: true }] })); return form; };
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: { ok: true, pageRevision: 1, businessRevision: 1 }, error: null }); });
it("preserves unique editor section keys and supports the provider RPC", async () => {
  expect((await saveDraftState(fd())).ok).toBe(true);
  expect(mocks.rpc.mock.calls[0][1].draft.sections[0].key).toBe("hero_1");
  expect(mocks.rpc.mock.calls[0][1]).toHaveProperty("expected_page_revision", 0);
});
it("does not fall back to a legacy writer when contact RPC is missing", async () => {
  mocks.rpc.mockResolvedValueOnce({ error: { code: "PGRST202", message: "save_contact_draft does not exist" } });
  expect((await saveDraftState(fd())).ok).toBe(false);
  expect(mocks.rpc).toHaveBeenCalledOnce();
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

it("bounds sections, nested items, provider profiles, and decoded text before persistence", async () => {
  const form = fd();
  const draft = JSON.parse(String(form.get("draft")));
  draft.sections = Array.from({ length: 41 }, (_, index) => ({ section_key: `section_${index}`, kind: index === 0 ? "hero" : "about", content: {}, enabled: true }));
  form.set("draft", JSON.stringify(draft));
  await expect(parseDraft(form)).rejects.toThrow("Too many sections");

  draft.sections = [{ section_key: "hero", kind: "hero", content: { items: Array.from({ length: 401 }, () => ({ label: "x" })) }, enabled: true }];
  form.set("draft", JSON.stringify(draft));
  await expect(parseDraft(form)).rejects.toThrow("permitted limit");

  draft.sections = [{ section_key: "hero", kind: "hero", content: {}, enabled: true }];
  draft.providerProfiles = Object.fromEntries(Array.from({ length: 41 }, (_, index) => [`provider-${index}`, { value: "x" }]));
  form.set("draft", JSON.stringify(draft));
  await expect(parseDraft(form)).rejects.toThrow("permitted limit");
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
  mocks.rpc.mockResolvedValue({ data: { ok: true, pageRevision: 1, businessRevision: 1 }, error: null });
  expect((await saveDraftState(form)).ok).toBe(true);
  const rows = mocks.rpc.mock.calls[0][1].draft.sections;
  expect(rows[1].title).toBe("");
  expect(rows[1].content).toMatchObject({ eyebrow: "", description: "", items: [{ id: "mon", value: "09:00–17:00" }, { id: "tue", value: "11:00–19:00" }] });
  expect(rows[1].content.items[0].provider).toBeUndefined();
  expect(rows[2].content.items[0]).toMatchObject({ id: "service", label: "", subtitle: "", actions: [{ id: "book", url: "https://example.test/book" }] });
});
