import { describe, expect, it } from "vitest";
import { ItemEditor } from "../../src/app/admin/businesses/_components/item-editor";
import { duplicateEditorItem, resolveSectionItems, type EditorItem } from "../../src/lib/business/editor-items";
import { compileContact, emptyContact } from "../../src/lib/business/contact";
import { serializeVCard } from "../../src/lib/business/vcard";
import { PublicSnapshot } from "../../src/components/business/public-snapshot";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProviderProfile } from "../../src/lib/business/providers";

function nodes(value: any): any[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...nodes(value.props?.children)];
}

describe("direct edits of repeated providers", () => {
  it("duplicates resolved values with independent IDs including nested actions", () => {
    const original: EditorItem = { id: "a", label: "WhatsApp", provider: "whatsapp", value: "01012345678", url: "", actions: [{ id: "nested", label: "Instagram", value: "@synthetic", url: "" }] };
    const copy = duplicateEditorItem(original);
    expect(copy.id).not.toBe(original.id);
    expect(copy.profileOverride).toBe(true);
    expect(copy.actions![0].id).not.toBe(original.actions![0].id);
    copy.actions![0].value = "changed";
    expect(original.actions![0].value).toBe("@synthetic");
  });
  it("exports only selected instances and freezes public destinations across draft edits", () => {
    const items: EditorItem[] = [
      { id: "wa-a", provider: "whatsapp", label: "A", value: "+201012345678", url: "https://wa.me/201012345678", profileOverride: true },
      { id: "wa-b", provider: "whatsapp", label: "B", value: "+201112345678", url: "https://wa.me/201112345678", profileOverride: true },
      { id: "ig-a", provider: "instagram", label: "A", value: "@synthetic_a", url: "https://instagram.com/synthetic_a", profileOverride: true },
      { id: "ig-b", provider: "instagram", label: "B", value: "@synthetic_b", url: "https://instagram.com/synthetic_b", profileOverride: true },
    ];
    const sections = [{ key: "social", kind: "social", title: "Social", position: 0, enabled: true, content: { items } }];
    const config = { ...emptyContact(), enabled: true, displayName: "Synthetic", primaryPhone: "01012345678", fields: [
      { id: "wa", kind: "whatsapp" as const, label: "B", value: "", enabled: true, binding: { sectionKey: "social", itemId: "wa-b", property: "url" as const } },
      { id: "ig", kind: "social" as const, label: "B", value: "", enabled: true, binding: { sectionKey: "social", itemId: "ig-b", property: "url" as const } },
    ] };
    const published = JSON.parse(JSON.stringify({ sections, contact: compileContact(config, { sections }) }));
    const html = renderToStaticMarkup(createElement(PublicSnapshot, { snapshot: published }));
    for (const item of items) expect(html).toContain(item.url);
    const vcf = serializeVCard(published.contact);
    expect(vcf).toContain("https://wa.me/201112345678");
    expect(vcf).toContain("https://instagram.com/synthetic_b");
    expect(vcf).not.toContain("https://wa.me/201012345678");
    items.reverse();
    sections[0].content.items = items.filter(item => !["wa-a", "ig-a"].includes(item.id));
    expect(compileContact(config, { sections })!.fields).toEqual(published.contact.fields);
    items.find(item => item.id === "wa-b")!.url = "https://wa.me/201212345678";
    expect(serializeVCard(published.contact)).toBe(vcf);
    expect(compileContact(config, { sections })!.fields[0].value).toBe("https://wa.me/201212345678");
  });
  it.each(["whatsapp", "instagram", "vodafone"] as const)("editing inherited %s B creates only B's override", provider => {
    const original = provider === "instagram" ? "@synthetic_a" : "01012345678";
    const changed = provider === "instagram" ? "@synthetic_b" : "01112345678";
    const profiles: Record<string, ProviderProfile> = { [provider]: { id: provider, value: original } };
    const items: EditorItem[] = ["A", "B"].map(id => ({ id, provider, label: id, value: original, url: "", profileOverride: false }));
    let result = items;
    const tree = ItemEditor({ section: { id: "social", kind: "quick_actions" }, items, onChange: next => { result = next; } });
    const input = nodes(tree).find(node => node.type === "input" && node.props.name === "social.B.value");
    input.props.onChange({ target: { value: changed } });
    expect(result[1].profileOverride).toBe(true);
    const preview = resolveSectionItems(result, "quick_actions", profiles);
    expect(preview.map(item => item.value)).toEqual([original, changed]);
    const reloaded = JSON.parse(JSON.stringify(preview));
    const nextProfiles = { [provider]: { id: provider, value: "01212345678" } };
    expect(resolveSectionItems(reloaded, "quick_actions", nextProfiles).map(item => item.value)).toEqual(["01212345678", changed]);
    expect(resolveSectionItems([reloaded[1]], "quick_actions", nextProfiles)[0].value).toBe(changed);
  });
});
