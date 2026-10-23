import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { dialablePhone, telephoneHref } from "@/lib/business/phone";
import { compileContact, emptyContact } from "@/lib/business/contact";
import { serializeVCard } from "@/lib/business/vcard";
import { PublicSnapshot } from "@/components/business/public-snapshot";

describe("landline and service-code safety", () => {
  it.each(["(02) 2345-6789", "+44 (20) 7123-4567", "123", "*123#", "02.1234.5678"])("accepts %s without country inference", value => {
    expect(dialablePhone(value)).toBe(value.replace(/[ ().-]/g, ""));
  });
  it.each(["12+34", "123;ext=4", "123%0aFN:bad", "123/45", "123\n456", "123\t456", "*#", "abc123"])("rejects unsafe %s", value => expect(telephoneHref(value)).toBe(""));
  it("encodes service hashes without a fragment", () => expect(telephoneHref("*123#")).toBe("tel:*123%23"));
  it("keeps raw display text while vCard emits the dial value once", () => {
    const contact = compileContact({ ...emptyContact(), enabled: true, displayName: "Office", primaryPhone: "(02) 2345-6789", primaryPhoneType: "landline", fields: [{ id: "x", kind: "phone", label: "Service", value: "*123#", enabled: true, phoneType: "other" }] }, {})!;
    expect(contact.primaryPhone).toBe("(02) 2345-6789");
    expect(serializeVCard(contact)).toContain("TEL;TYPE=WORK,VOICE:0223456789\r\n");
    expect(serializeVCard(contact)).toContain("TEL;TYPE=VOICE:*123#\r\n");
  });
  it("does not duplicate a normalized primary field binding", () => {
    const contact = compileContact({ ...emptyContact(), enabled: true, displayName: "Office", primaryPhone: "", primaryPhoneFieldId: "primary", fields: [{ id: "primary", kind: "phone", label: "Reception", value: "(02) 2345-6789", enabled: true, phoneType: "landline" }] }, {})!;
    const vcard = serializeVCard(contact);
    expect(vcard.match(/0223456789/g)).toHaveLength(1);
  });
  it("renders safe public phone links and preserves About newlines", () => {
    const html = renderToStaticMarkup(React.createElement(PublicSnapshot, { snapshot: { business: { name: "Office" }, sections: [
      { key: "hero", kind: "hero", title: "", position: 0, enabled: true, content: { language: "en" } },
      { key: "about", kind: "about", title: "About", position: 1, enabled: true, content: { description: "Line 1\nLine 2\n\nLine 4" } },
      { key: "actions", kind: "quick_actions", title: "", position: 2, enabled: true, content: { items: [{ id: "phone", provider: "call", label: "Reception", value: "(02) 2345-6789", phoneType: "landline", enabled: true }] } },
    ] } }));
    expect(html).toContain("Line 1\nLine 2\n\nLine 4");
    expect(html).toContain('href="tel:0223456789"');
    expect(html).toContain("(02) 2345-6789");
  });

  it("keeps unsafe legacy phone rows visible as text-only", () => {
    const html = renderToStaticMarkup(React.createElement(PublicSnapshot, { snapshot: { business: { name: "Office" }, sections: [
      { key: "hero", kind: "hero", title: "", position: 0, enabled: true, content: { language: "en" } },
      { key: "actions", kind: "quick_actions", title: "", position: 1, enabled: true, content: { items: [{ id: "bad-action", provider: "call", label: "Legacy", value: "123;ext=4", enabled: true }] } },
      { key: "social", kind: "social", title: "", position: 2, enabled: true, content: { items: [{ id: "bad-social", provider: "phone", label: "Legacy social", value: "12/34", enabled: true }] } },
    ] } })); 
    expect(html.match(/123;ext=4/g)).toHaveLength(1);
    expect(html.match(/12\/34/g)).toHaveLength(1);
    expect(html).not.toContain("tel:123");
    expect(html).not.toContain("tel:12");
  });

  it("shows the fallback Find-us phone once and keeps telephone links same-tab", () => {
    const html = renderToStaticMarkup(React.createElement(PublicSnapshot, { snapshot: { business: { name: "Office" }, sections: [
      { key: "hero", kind: "hero", title: "", position: 0, enabled: true, content: { language: "en" } },
      { key: "contact", kind: "contact", title: "", position: 1, enabled: true, content: { phone: "(02) 2345-6789" } },
    ] } })); 
    expect(html.match(/\(02\) 2345-6789/g)).toHaveLength(1);
    expect(html).toContain('href="tel:0223456789"');
    expect(html).not.toContain('target="_blank"');
  });
});
