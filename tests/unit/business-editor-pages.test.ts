import { expect, it, vi } from "vitest";
import { loadBusinessEditorPages } from "../../src/lib/business/business-editor-pages";
import { emptyContact } from "../../src/lib/business/contact";

const page = {
  id: "page-1",
  slug: "cafe",
  template: "professional",
  page_type: "main",
  branch_name: null,
  is_active: true,
  published_snapshot_id: null,
};

it.each(["contact_config", "draft_revision"] as const)("loads pages when the optional %s column is absent", async missing => {
  const load = vi.fn(async (columns: string) => columns.includes(missing)
    ? { data: null, error: { code: "42703", message: `column business_pages.${missing} does not exist` } }
    : { data: [{ ...page, ...(columns.includes("contact_config") ? { contact_config: { ...emptyContact(), enabled: true } } : {}), ...(columns.includes("draft_revision") ? { draft_revision: 4 } : {}) }], error: null });

  const result = await loadBusinessEditorPages(load);

  expect(result.error).toBeNull();
  expect(result.data?.[0]).toMatchObject({ [missing]: missing === "contact_config" ? {} : 0, [missing === "contact_config" ? "draft_revision" : "contact_config"]: missing === "contact_config" ? 4 : { enabled: true }, slug: "cafe" });
  expect(load).toHaveBeenCalledTimes(2);
  expect(load.mock.calls[1][0]).not.toContain(missing);
});

it("drops both missing Contacts columns one at a time and defaults both values", async () => {
  const load = vi.fn(async (columns: string) => {
    const missing = ["contact_config", "draft_revision"].find(column => columns.includes(column));
    return missing
      ? { data: null, error: { code: "42703", message: `column business_pages.${missing} does not exist` } }
      : { data: [page], error: null };
  });
  const result = await loadBusinessEditorPages(load);
  expect(result.data?.[0]).toMatchObject({ contact_config: {}, draft_revision: 0 });
  expect(load).toHaveBeenCalledTimes(3);
});

it("preserves both editor values when the Contacts schema is present", async () => {
  const load = vi.fn(async () => ({ data: [{ ...page, contact_config: { ...emptyContact(), enabled: true }, draft_revision: 4 }], error: null }));
  const result = await loadBusinessEditorPages(load);
  expect(result.data?.[0]).toMatchObject({ contact_config: { enabled: true }, draft_revision: 4 });
  expect(load).toHaveBeenCalledOnce();
});

it.each([
  { code: "42501", message: "permission denied for table business_pages" },
  { code: "NETWORK", message: "network unavailable" },
  { code: "42703", message: "column business_pages.required_column does not exist" },
])("does not hide unrelated page query failures: $code", async error => {
  const load = vi.fn(async () => ({ data: null, error }));
  const result = await loadBusinessEditorPages(load);
  expect(result.error).toEqual(error);
  expect(load).toHaveBeenCalledOnce();
});
