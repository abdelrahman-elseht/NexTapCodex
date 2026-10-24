import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/auth/owner", () => ({ requireOwner: async () => ({ supabase: { rpc: mocks.rpc } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/observability/operations", () => ({ captureOperationError: vi.fn() }));
import { saveDraftState } from "@/app/admin/businesses/actions";

function form(value: string) {
  const draft = { businessId: "business", pageId: "page", name: "QA", slug: "qa", template: "professional", expectedPageRevision: 0, expectedBusinessRevision: 0, sections: [
    { key: "hero", kind: "hero", enabled: true, content: {} },
    { key: "actions", kind: "quick_actions", enabled: true, content: { items: [{ id: "landline", provider: "call", label: "Reception", value, phoneType: "landline", enabled: true }] } },
  ] };
  const result = new FormData(); result.set("draft", JSON.stringify(draft)); return result;
}

beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: { ok: true, pageRevision: 1, businessRevision: 1 } }); });

it("accepts a raw landline and sends its stable item identity to the RPC", async () => {
  expect((await saveDraftState(form("(02) 2345-6789"))).ok).toBe(true);
  const payload = mocks.rpc.mock.calls[0][1].draft;
  expect(payload.sections[1].content.items[0]).toMatchObject({ id: "landline", value: "(02) 2345-6789", phoneType: "landline" });
});

it("rejects unsafe phone input before persistence", async () => {
  expect((await saveDraftState(form("123;ext=4"))).ok).toBe(false);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
