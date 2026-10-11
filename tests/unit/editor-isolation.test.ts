import { expect, it } from "vitest";
import { buildProviderProfiles, resolveProviderItem } from "../../src/lib/business/providers";
import { normalizeEditorItems, resolveSectionItems } from "../../src/lib/business/editor-items";

it("custom entries never become shared business provider defaults", () => {
  const profiles = buildProviderProfiles([{ provider: "custom", value: "11:00–19:00" }]);
  expect(profiles).toEqual({});
});

it("normalizes independent hours ranges without provider or URL semantics", () => {
  const shared = { label: "Monday", value: "09:00–17:00", provider: "custom", url: "https://example.test" };
  const items = normalizeEditorItems([shared, shared], "hours", "hours-1");
  expect(items[0].id).not.toBe(items[1].id);
  expect(items[0]).not.toBe(items[1]);
  expect(items[0].provider).toBeUndefined();
  expect(items[0].url).toBe("");
  expect(normalizeEditorItems(JSON.parse(JSON.stringify(items.slice().reverse())), "hours", "new-section-id").map(item => item.id)).toEqual([items[1].id, items[0].id]);
  expect(resolveSectionItems(items,"hours", { custom: { id: "custom", value: "11:00–19:00" } })).toEqual(items);
});

it("retains nested service buttons and independent destinations across normalization", () => {
  const items = normalizeEditorItems([{ label: "Service", actions: [{ id: "one", url: "https://example.test/one" }, { id: "two", url: "https://example.test/two" }] }], "services", "services-1");
  expect(items[0].actions?.map(item => item.id)).toEqual(["one", "two"]);
  expect(normalizeEditorItems(JSON.parse(JSON.stringify(items)), "services", "services-1")).toEqual(items);
});

it("clearing a business default does not resurrect stale inherited values", () => {
  expect(resolveProviderItem({ provider: "whatsapp", value: "01012345678", url: "https://example.test/stale" }, { whatsapp: { id: "whatsapp" } })).toMatchObject({ value: "", url: "" });
});

it("legacy custom profiles cannot overwrite independent hours or service destinations", () => {
  const profiles = { custom: { id: "custom" as const, value: "11:00–19:00", url: "https://example.test/other" } };
  const monday = { provider: "custom", value: "09:00–17:00", url: "" };
  const service = { provider: "custom", value: "", url: "" };
  expect(resolveProviderItem(monday, profiles)).toEqual(monday);
  expect(resolveProviderItem(service, profiles)).toEqual(service);
});
