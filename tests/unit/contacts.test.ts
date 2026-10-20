import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import sharp from "sharp";
import { compileContact, contactConfigSchema, emptyContact, type ContactConfig, type ContactProjection } from "@/lib/business/contact";
import { serializeVCard } from "@/lib/business/vcard";
import { prepareContactPhoto } from "@/lib/media/contact-photo";
import { PublicSnapshot, type Snapshot } from "@/components/business/public-snapshot";

// Independent third-party parser; never imports the serializer's parsing/escaping logic.
const parser = createRequire(import.meta.url)("vcard-parser") as { parse: (value: string) => Record<string, { value: string | string[] }[]> };
const config = (): ContactConfig => ({ ...emptyContact(), enabled: true, displayName: "مقهى ☕", organization: "NexTap", primaryPhone: "01012345678" });
const contact = (): ContactProjection => compileContact(config(), {})!;

describe("contact configuration and projection", () => {
  it("defaults old snapshots and disabled configurations off", () => {
    expect(compileContact(emptyContact(), {})).toBeUndefined();
  });
  it("never substitutes WhatsApp or another page for a primary phone", () => {
    expect(() => compileContact({ ...config(), primaryPhone: "", phoneFromPage: true }, { sections: [{ key: "contact", kind: "contact", enabled: true, content: { whatsapp: "01012345678" } }] })).toThrow(/Primary phone/);
  });
  it("binds a specific item and preserves distinct values without serializing private rows", () => {
    const c = config(); c.fields = [
      { id: "a", kind: "website", label: "Second", value: "", enabled: true, binding: { sectionKey: "social", itemId: "second", property: "url" } },
      { id: "b", kind: "notes", label: "Private", value: "secret", enabled: false },
    ];
    const projected = compileContact(c, { sections: [{ key: "social", kind: "social", enabled: true, content: { items: [{ id: "first", provider: "website", url: "https://first.test" }, { id: "second", provider: "website", url: "https://second.test" }] } }] })!;
    expect(projected.fields).toEqual([{ kind: "website", label: "Second", value: "https://second.test" }]);
    expect(JSON.stringify(projected)).not.toMatch(/secret|binding|itemId/);
  });
  it.each(["javascript:alert(1)", "https://user:pass@example.test", "https://example.test\r\nFN:injection"])("rejects unsafe URLs: %s", value => {
    const c = config(); c.fields = [{ id: "a", kind: "website", label: "Website", value, enabled: true }];
    expect(() => compileContact(c, {})).toThrow();
  });
  it("enforces row counts including disabled fields, stable IDs and label/text/URL bounds", () => {
    const c = config(); const field = { id: "a", kind: "notes" as const, label: "", value: "", enabled: false };
    expect(contactConfigSchema.safeParse({ ...c, fields: Array.from({ length: 31 }, (_, i) => ({ ...field, id: String(i) })) }).success).toBe(false);
    expect(contactConfigSchema.safeParse({ ...c, fields: [field, field] }).success).toBe(false);
    for (const patch of [{ label: "x".repeat(101) }, { value: "x".repeat(2001) }]) expect(contactConfigSchema.safeParse({ ...c, fields: [{ ...field, ...patch }] }).success).toBe(false);
  });
  it("bounds the combined public NOTE", () => {
    const c = config(); c.fields = Array.from({ length: 5 }, (_, i) => ({ id: String(i), kind: "notes", label: "Note", value: "x".repeat(2000), enabled: true }));
    expect(() => compileContact(c, {})).toThrow(/Combined notes/);
  });
});

describe("vCard wire format", () => {
  it("parses independently with Arabic, emoji, structured N/ADR, repeated phones/URLs and escaped notes", () => {
    const c = contact(); c.fields = [
      { kind: "phone", label: "Other", value: "+442071234567" }, { kind: "phone", label: "Mobile", value: "+442071234568" },
      { kind: "website", label: "One", value: "https://one.test" }, { kind: "website", label: "Two", value: "https://two.test" },
      { kind: "whatsapp", label: "WhatsApp", value: "https://wa.me/201000000000" }, { kind: "social", label: "Instagram", value: "https://instagram.com/example" },
      { kind: "custom", label: "Booking page", value: "https://example.test/book" },
      { kind: "email", label: "Work", value: "qa@example.test" },
      { kind: "address", label: "Office", value: "Cairo; مصر, Nile" },
      { kind: "notes", label: "Notes", value: "Hello, world; \\ ☕\nFN:still a note" },
    ];
    const raw = serializeVCard(c), parsed = parser.parse(raw);
    expect(parsed.version[0].value).toBe("3.0"); expect(parsed.fn[0].value).toBe("مقهى ☕");
    expect(parsed.n[0].value).toHaveLength(5); expect(parsed.tel.map(row => row.value)).toEqual(["+201012345678", "+442071234567", "+442071234568"]);
    expect(parsed.url.map(row => row.value)).toEqual(["https://one.test", "https://two.test", "https://wa.me/201000000000", "https://instagram.com/example", "https://example.test/book"]);
    expect(raw).toContain("URL;TYPE=Booking-page:"); expect(raw).toContain("WhatsApp: https://wa.me/201000000000");
    expect(parsed.adr[0].value).toHaveLength(7); expect(parsed.fn).toHaveLength(1);
    expect(raw.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n")).toBe(true); expect(raw.endsWith("END:VCARD\r\n")).toBe(true);
    expect(raw).not.toContain("\ufeff"); expect(raw.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });
  it("folds UTF-8 at 75 octets including continuation spaces and preserves Unicode", () => {
    const c = contact(); c.displayName = "مصر ☕😀".repeat(150);
    const raw = serializeVCard(c);
    for (const line of raw.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    // This parser trims continuation whitespace; unfold exactly one RFC continuation byte first.
    expect(parser.parse(raw.replace(/\r\n[ \t]/g, "")).fn[0].value).toBe(c.displayName);
    expect(raw).not.toContain("�");
  });
  it("escapes property injection and rejects parameter/URL injection", () => {
    const c = contact(); c.displayName = "Business\r\nTEL:attacker";
    expect(() => serializeVCard(c)).toThrow();
    c.displayName = "Business\nTEL:attacker";
    expect(parser.parse(serializeVCard(c)).tel).toHaveLength(1);
    c.fields = [{ kind: "website", label: "", value: "javascript:alert(1)" }];
    expect(() => serializeVCard(c)).toThrow();
  });
  it("serializes a bounded inline JPEG and omits a missing photo", async () => {
    const source = await sharp({ create: { width: 1000, height: 500, channels: 3, background: "red" } }).withMetadata().png().toBuffer();
    const photo = await prepareContactPhoto(source), metadata = await sharp(photo).metadata();
    expect([metadata.width, metadata.height]).toEqual([384, 192]); expect(metadata.exif).toBeUndefined(); expect(photo.length).toBeLessThanOrEqual(100 * 1024);
    expect(serializeVCard(contact(), photo)).toContain("PHOTO;ENCODING=b;TYPE=JPEG:"); expect(serializeVCard(contact())).not.toContain("PHOTO");
    const small = await prepareContactPhoto(await sharp({ create: { width: 20, height: 10, channels: 3, background: "red" } }).png().toBuffer());
    expect((await sharp(small).metadata()).width).toBe(20);
  });
});

describe("Quick Actions reference placement", () => {
  const actions = (enabled = true, position = 1) => ({ key: `actions${position}`, kind: "quick_actions", title: "", enabled, position, content: { items: [{ id: "call", provider: "call", label: "Call", value: "01012345678" }] } });
  const render = (sections: Snapshot["sections"], enabled = true) => renderToStaticMarkup(React.createElement(PublicSnapshot, { snapshot: { contact: enabled ? contact() : undefined, sections }, contactHref: "/b/qa/contact.vcf" }));
  it.each([[], [actions()], [actions(), actions(true, 2)], [{ ...actions(), content: { items: [] } }]].map(sections => ({ sections })))("renders exactly one full-width anchor before the independent tiles", ({ sections }) => {
    const html = render(sections);
    expect(html.match(/class="contact-download-button"/g)).toHaveLength(1);
    expect(html).not.toMatch(/contact-download-button[^>]*target=/);
    expect(html).not.toMatch(/contact-download-button[^>]*download=/);
    expect(html).toContain('class="contact-download-fallback"');
    const cta = html.indexOf('class="contact-download-button"'), tile = html.indexOf('class="quick-action ');
    if (tile >= 0) expect(cta).toBeLessThan(tile);
  });
  it("keeps a disabled primary section hidden and does not transfer its contact CTA", () => {
    expect(render([actions(false), actions(true, 2)])).not.toContain('class="contact-download-button"');
  });
  it("preserves action tiles when Contacts is disabled", () => {
    const html = render([actions()], false); expect(html).toContain("tel:"); expect(html).not.toContain('class="contact-download-button"');
  });
});
