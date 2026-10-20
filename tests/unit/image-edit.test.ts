import { describe, it, expect } from "vitest";
import { imageCropRectangle, imageEditSchema } from "@/lib/media/image-edit";
import { parseSectionContent } from "@/lib/business/content";
import { normalizeEditorItems } from "@/lib/business/editor-items";

const edit = { sourceUrl: "https://example.test/original.webp", crop: { x: 1000, y: 500, zoom: 2000 }, aspect: 4 / 3 };
describe("business image cropping", () => {
  it("selects rectangular pixels independently of the original aspect ratio", () => {
    expect(imageCropRectangle(800, 600, edit.crop, 4 / 3)).toEqual({ left: 400, top: 150, width: 400, height: 300 });
    expect(imageCropRectangle(800, 600, { x: 0, y: 1000, zoom: 1000 }, 1)).toEqual({ left: 0, top: 0, width: 600, height: 600 });
    for (const aspect of [0.25, 3 / 4, 1, 4 / 3, 16 / 9, 4]) {
      const r = imageCropRectangle(333, 777, { x: 1000, y: 1000, zoom: 4000 }, aspect);
      expect(r.left + r.width).toBeLessThanOrEqual(333);
      expect(r.top + r.height).toBeLessThanOrEqual(777);
      expect(r.width).toBeGreaterThan(0); expect(r.height).toBeGreaterThan(0);
    }
  });
  it("persists partial section image settings and gallery originals through normalization", () => {
    for (const key of ["logoUrl", "coverUrl", "mapImageUrl", "backgroundUrl"]) {
      const content = { [key]: "https://example.test/cropped.webp", imageEdits: { [key]: edit }, description: "Keep this text" };
      expect(parseSectionContent(JSON.stringify(content))).toEqual(content);
    }
    const item = { id: "one", label: "Gallery", url: "https://example.test/crop.webp", imageEdit: edit };
    const content = parseSectionContent(JSON.stringify({ items: [item] }), "gallery");
    expect(normalizeEditorItems(content.items, "gallery", "gallery")[0].imageEdit).toEqual(edit);
  });
  it("rejects malformed crop metadata and unsafe source references", () => {
    for (const sourceUrl of ["javascript:alert(1)", "//other.test/image", "https://user:secret@example.test/image"]) expect(imageEditSchema.safeParse({ ...edit, sourceUrl }).success).toBe(false);
    expect(() => parseSectionContent(JSON.stringify({ imageEdits: { logoUrl: { ...edit, aspect: 0 } } }))).toThrow();
    expect(() => parseSectionContent(JSON.stringify({ imageEdits: { unknown: edit } }))).toThrow();
  });
});
