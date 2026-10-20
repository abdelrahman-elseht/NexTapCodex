import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/auth/owner", () => ({ requireOwner: async () => ({ supabase: { rpc: mocks.rpc } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/observability/operations", () => ({ captureOperationError: vi.fn() }));
import { saveDraftState } from "@/app/admin/businesses/actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: { ok: true, pageRevision: 1, businessRevision: 1 } });
});

function draftForm(values: string[]) {
  const form = new FormData();
  form.set("draft", JSON.stringify({
    businessId: "business", pageId: "page", name: "Phone QA", slug: "phone-qa", template: "professional",
    expectedPageRevision: 0, expectedBusinessRevision: 0,
    sections: [
      { key: "hero", kind: "hero", enabled: true, content: {} },
      { key: "actions", kind: "quick_actions", enabled: true, content: { items: values.map((value, i) => ({ id: String(i), provider: "call", label: `Phone ${i}`, value, phoneType: "landline", enabled: true })) } },
    ],
  }));
  return form;
}

it("saves multiple raw independent phone values through the actual server action", async () => {
  const values = [" (02) 2345-6789 ", "+44 (20) 7123-4567", "123", "*123#"];
  expect((await saveDraftState(draftForm(values))).ok).toBe(true);
  const [name, args] = mocks.rpc.mock.calls[0];
  expect(name).toBe("save_contact_draft");
  expect(args.draft.sections[1].content.items.map((item: { value: string }) => item.value)).toEqual(values);
  expect(args.draft.sections[1].content.items.every((item: { phoneType: string }) => item.phoneType === "landline")).toBe(true);
  expect(args.publish).toBe(false);
});

it.each(["12+34", "123;ext=4", "123\n", "1".repeat(500) + ";ext=4"])("rejects unsafe phone input before database mutation: %s", async value => {
  expect((await saveDraftState(draftForm([value]))).ok).toBe(false);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
