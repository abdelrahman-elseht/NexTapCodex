import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { dialablePhone, telephoneHref } from "@/lib/business/phone";
import { compileContact, emptyContact } from "@/lib/business/contact";
import { serializeVCard } from "@/lib/business/vcard";
import { resolveProviderItem, whatsappHref } from "@/lib/business/providers";
import { PublicSnapshot } from "@/components/business/public-snapshot";

describe("flexible phone safety", () => {
  it.each(["02 2345 6789", "(03) 123-4567", "+44 (20) 7123-4567", "01012345678", "123", "1", "*123#", " 02.1234.5678 "])("accepts without inferring a country: %s", value => {
    expect(dialablePhone(value)).toBe(value.replace(/[ ().-]/g, ""));
  });
  it.each(["", "++123", "12+34", "123;ext=4", "123?x=1", "123%0aFN:bad", "123/45", "123\n456", "123\n", "123\r", "javascript:123", "abc123", "*#", "123\t456"])("never strips unsafe characters into a dialable destination: %s", value => {
    expect(telephoneHref(value)).toBe("");
  });
  it("encodes service-code hashes and keeps WhatsApp normalization", () => {
    expect(telephoneHref("*123#")).toBe("tel:*123%23");
    expect(new URL(telephoneHref("*123#")).hash).toBe("");
    expect(whatsappHref("01012345678")).toBe("https://wa.me/201012345678");
  });
});

describe("phone publication and contacts", () => {
  const items = [
    { id: "landline", provider: "call", label: "Reception", value: "(02) 2345-6789", phoneType: "landline", enabled: true },
    { id: "mobile", provider: "call", label: "Manager", value: "010 1234 5678", phoneType: "mobile", enabled: true },
    { id: "business", provider: "phone", label: "Orders", value: "123", phoneType: "work", enabled: true },
  ];
  const sections = [{ key: "actions", kind: "quick_actions", title: "", position: 0, enabled: true, content: { items } }];
  it("preserves display values and binds any independent saved entry as primary", () => {
    for (const item of items) {
      const contact = compileContact({ ...emptyContact(), enabled: true, displayName: "Business", primaryPhoneBinding: { sectionKey: "actions", itemId: item.id, property: "value" } }, { sections })!;
      expect(contact.primaryPhone).toBe(item.value);
      expect(contact.primaryPhoneType).toBe(item.phoneType);
      expect(serializeVCard(contact)).toContain(`TEL;TYPE=${item.phoneType === "mobile" ? "CELL" : "WORK,VOICE"}:${dialablePhone(item.value)}`);
    }
  });
  it("exports a landline-only contact and independently typed additional phones", () => {
    const contact = compileContact({ ...emptyContact(), enabled: true, displayName: "Business", primaryPhone: "02 2345 6789", primaryPhoneType: "landline", fields: [
      { id: "a", kind: "phone", label: "Manager", value: "010 1234 5678", enabled: true, phoneType: "mobile" },
      { id: "b", kind: "phone", label: "Orders", value: "123", enabled: true, phoneType: "work" },
      { id: "c", kind: "phone", label: "Other", value: "*123#", enabled: true, phoneType: "other" },
    ] }, {})!;
    const raw = serializeVCard(contact);
    expect(raw).toContain("TEL;TYPE=WORK,VOICE:0223456789\r\n");
    expect(raw).toContain("TEL;TYPE=CELL:01012345678\r\n");
    expect(raw).toContain("TEL;TYPE=WORK,VOICE:123\r\n");
    expect(raw).toContain("TEL;TYPE=VOICE:*123#\r\n");
    expect(contact.fields.map(field => field.value)).toEqual(["010 1234 5678", "123", "*123#"]);
  });
  it("keeps populated phone entries independent of shared defaults", () => {
    for (const item of items) expect(resolveProviderItem(item, { call: { id: "call", value: "999" } }).value).toBe(item.value);
  });
  it("selects an included contact phone as primary and inherits its bound type", () => {
    const config = { ...emptyContact(), enabled: true, displayName: "Business", primaryPhoneFieldId: "reception", fields: [
      { id: "reception", kind: "phone" as const, label: "Reception", value: "", enabled: true, binding: { sectionKey: "actions", itemId: "landline", property: "value" as const } },
    ] };
    const contact = compileContact(config, { sections })!;
    expect(contact.primaryPhone).toBe("(02) 2345-6789");
    expect(contact.primaryPhoneType).toBe("landline");
    expect(serializeVCard(contact)).toContain("TEL;TYPE=WORK,VOICE:0223456789");
    for (const fields of [[], [{ ...config.fields[0], enabled: false }], [{ ...config.fields[0], kind: "custom" }]]) {
      expect(() => compileContact({ ...config, fields }, { sections })).toThrow(/Primary phone/);
    }
  });
  it("excludes nested phone actions when their parent is disabled", () => {
    expect(() => compileContact({ ...emptyContact(), enabled: true, displayName: "Business", primaryPhoneBinding: { sectionKey: "services", itemId: "nested", property: "value" } }, {
      sections: [{ key: "services", kind: "services", enabled: true, content: { items: [{ id: "parent", enabled: false, actions: [{ id: "nested", provider: "call", value: "123" }] }] } }],
    })).toThrow(/Primary phone/);
  });
  it("renders safe links, original display text and the monochrome landline glyph", () => {
    const html = renderToStaticMarkup(React.createElement(PublicSnapshot, { snapshot: { sections: [...sections, { key: "unsafe", kind: "quick_actions", title: "", position: 1, enabled: true, content: { items: [{ provider: "phone", label: "Unsafe", value: "12+34" }] } }] } }));
    for (const item of items) expect(html).toContain(item.value);
    expect(html).toContain('href="tel:0223456789"');
    expect(html).toContain('href="tel:123"');
    expect(html).not.toContain("tel:12+34");
    expect(html).toContain('d="M5 9 3 19');
  });
  it("rejects stale, disabled and other-page bindings", () => {
    for (const binding of [{ sectionKey: "another-page", itemId: "landline", property: "value" }, { sectionKey: "actions", itemId: "missing", property: "value" }]) {
      expect(() => compileContact({ ...emptyContact(), enabled: true, displayName: "Business", primaryPhoneBinding: binding }, { sections })).toThrow(/Primary phone/);
    }
  });
});
