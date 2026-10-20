import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { compileContact, contactConfigSchema, emptyContact } from "@/lib/business/contact";
import { contactPhotoUrl, cropRectangle, croppedPhotoPath } from "@/lib/business/contact-crop";
import { serializeVCard } from "@/lib/business/vcard";
import { prepareContactPhoto } from "@/lib/media/contact-photo";
import { resolveContactPhoto } from "@/lib/media/resolve-contact-photo";
import { PublicSnapshot } from "@/components/business/public-snapshot";
import type { SupabaseClient } from "@supabase/supabase-js";

const config = () => ({ ...emptyContact(), enabled: true, displayName: "Synthetic QA", primaryPhone: "01012345678" });
const path = "00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000003.webp";

describe("Contacts UX regressions", () => {
  it("deduplicates identical URL values across kinds without merging accounts or phones", () => {
    const fields = ["https://instagram.com/one", "https://instagram.com/two", "https://wa.me/201012345678", "https://www.instapay.me/i?address=qa%40instapay", "https://facebook.com/qa", "https://qa.test"].map(value => ({ kind: "custom" as const, label: "Provider", value }));
    const projection = compileContact(config(), {})!;
    projection.fields = [...fields, { ...fields[0], kind: "social" }, { kind: "phone", label: "Second", value: "+442071234567" }, { kind: "phone", label: "Third", value: "+442071234568" }];
    const vcf = serializeVCard(projection).replace(/\r\n /g, "");
    expect(vcf.match(/^URL/gm)).toHaveLength(6);
    expect(vcf.match(/^TEL/gm)).toHaveLength(3);
    expect(vcf).not.toContain("NOTE:");
    projection.fields.push({ kind: "hours", label: "Hours", value: "9–5" });
    expect(serializeVCard(projection)).toContain("NOTE:Hours: 9–5");
  });
  it("defaults existing configurations to the visible secondary link and keeps the primary in both states", () => {
    const legacy: Partial<ReturnType<typeof config>> = { ...config() };
    delete legacy.showDownloadLink;
    expect(contactConfigSchema.parse(legacy).showDownloadLink).toBe(true);
    for (const visible of [true, false]) {
      const contact = compileContact({ ...config(), showDownloadLink: visible }, {})!;
      const html = renderToStaticMarkup(React.createElement(PublicSnapshot, { snapshot: { contact, sections: [] }, contactHref: "/b/qa/contact.vcf" }));
      expect(html).toContain('class="contact-download-button"');
      expect(html.includes('class="contact-download-fallback"')).toBe(visible);
    }
  });
  it("moves URLs out of mixed instructions and preserves their non-link text", () => {
    const projection = compileContact(config(), {})!;
    projection.fields = [{ kind: "notes", label: "Instructions", value: "Book https://qa.test/book then call us" }, { kind: "website", label: "Booking", value: "https://qa.test/book" }];
    const vcf = serializeVCard(projection).replace(/\r\n /g, "");
    expect(vcf.match(/^URL/gm)).toHaveLength(1);
    expect(vcf).toContain("NOTE:Instructions: Book then call us");
    expect(vcf.match(/^NOTE:.+/m)![0]).not.toContain("https://");
  });
  it("allows a selected InstaPay URL but never binds its identifier", () => {
    const c = { ...config(), fields: [{ id: "ip", kind: "website" as const, label: "InstaPay", value: "", enabled: true, binding: { sectionKey: "payments", itemId: "ip", property: "url" as const } }] };
    const sections = [{ key: "payments", kind: "payments", enabled: true, content: { items: [{ id: "ip", provider: "instapay", value: "qa@instapay", url: "https://www.instapay.me/i?address=qa%40instapay" }] } }];
    expect(compileContact(c, { sections })!.fields[0].value).toBe(sections[0].content.items[0].url);
    expect(() => compileContact({ ...c, fields: [{ ...c.fields[0], binding: { ...c.fields[0].binding, property: "value" } }] }, { sections })).toThrow();
  });
  it("inherits the logo and restores it when the override is removed", () => {
    const sections = [{ kind: "hero", enabled: true, content: { logoUrl: "https://qa.test/logo.webp" } }];
    expect(contactPhotoUrl(config(), sections)).toBe(sections[0].content.logoUrl);
    expect(contactPhotoUrl({ photoUrl: "https://qa.test/custom.webp" }, sections)).toBe("https://qa.test/custom.webp");
    expect(contactPhotoUrl({ photoUrl: "" }, sections)).toBe(sections[0].content.logoUrl);
    for (const crop of [{ x: -1, y: 500, zoom: 1000 }, { x: 500, y: 500, zoom: 5000 }, { x: 0.5, y: 500, zoom: 1000 }]) expect(contactConfigSchema.safeParse({ ...config(), photoCrop: crop }).success).toBe(false);
  });
  it("crops the intended pixels to a square JPEG without changing source bytes", async () => {
    const red = await sharp({ create: { width: 200, height: 200, channels: 3, background: "red" } }).png().toBuffer();
    const source = await sharp({ create: { width: 400, height: 200, channels: 3, background: "blue" } }).composite([{ input: red, left: 0, top: 0 }]).png().toBuffer();
    const original = Buffer.from(source);
    const crop = { x: 1000, y: 500, zoom: 1000 };
    expect(cropRectangle(400, 200, crop)).toEqual({ left: 200, top: 0, width: 200, height: 200 });
    const photo = await prepareContactPhoto(source, crop);
    const meta = await sharp(photo).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([200, 200, "jpeg"]);
    const stats = await sharp(photo).stats();
    expect(stats.channels[2].mean).toBeGreaterThan(240); expect(stats.channels[0].mean).toBeLessThan(10);
    expect(source.equals(original)).toBe(true);
    expect(croppedPhotoPath(path, crop)).toContain(".crop-1000-500-1000.contact.jpg");
  });
  it("reuses a cached crop without downloading, converting, uploading or changing metadata", async () => {
    const bucket = { exists: vi.fn().mockResolvedValue({ data: true }), download: vi.fn(), upload: vi.fn() };
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "asset", storage_path: path, contact_photo_path: path.replace(".webp", ".contact.jpg") } }) };
    const client = { from: vi.fn(() => query), storage: { from: vi.fn(() => bucket) } } as unknown as SupabaseClient;
    const photoCrop = { x: 500, y: 500, zoom: 2000 };
    const c = { ...config(), photoAssetId: "00000000-0000-4000-8000-000000000003", photoCrop };
    expect(await resolveContactPhoto(client, "business", c, [])).toBe(croppedPhotoPath(path, photoCrop));
    expect(bucket.download).not.toHaveBeenCalled(); expect(bucket.upload).not.toHaveBeenCalled();
    expect(await resolveContactPhoto(client, "business", { ...c, photoCrop: undefined }, [])).toBe(path.replace(".webp", ".contact.jpg"));
    expect(bucket.exists).toHaveBeenCalledTimes(1);
    expect(await resolveContactPhoto(client, "business", { ...config(), photoUrl: "https://attacker.test/logo.png" }, [])).toBeUndefined();
  });
  it("prepares a missing crop when Storage returns a 400 cache miss", async () => {
    const source = await sharp({ create: { width: 80, height: 40, channels: 3, background: "blue" } }).webp().toBuffer();
    const bucket = { exists: vi.fn().mockResolvedValue({ data: false, error: { status: 400 } }), download: vi.fn().mockResolvedValue({ data: new Blob([new Uint8Array(source)]) }), upload: vi.fn().mockResolvedValue({ error: null }) };
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "asset", storage_path: path } }) };
    const client = { from: vi.fn(() => query), storage: { from: vi.fn(() => bucket) } } as unknown as SupabaseClient;
    const photoCrop = { x: 500, y: 500, zoom: 2000 };
    expect(await resolveContactPhoto(client, "business", { ...config(), photoAssetId: "00000000-0000-4000-8000-000000000003", photoCrop }, [])).toBe(croppedPhotoPath(path, photoCrop));
    expect(bucket.upload).toHaveBeenCalledTimes(1);
    expect(bucket.upload.mock.calls[0][2]).toMatchObject({ upsert: false, contentType: "image/jpeg" });
  });
});
