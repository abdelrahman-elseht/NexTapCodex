import { expect, it, vi } from "vitest";
import sharp from "sharp";
import { optimizeImage, MAX_INPUT_BYTES } from "../../src/lib/media/optimize";
import { storeManagedImage } from "../../src/lib/media/store";
import { isOptimizableImage } from "../../src/lib/media/urls";

const raster = (width = 2000, height = 1000, alpha = false) => sharp({ create: { width, height, channels: alpha ? 4 : 3, background: { r: 100, g: 80, b: 20, alpha: alpha ? 0.25 : 1 } } });
it.each(["jpeg", "png", "webp"] as const)("decodes real %s bytes regardless of filename/MIME; bounds photos", async format => {
  const result = await optimizeImage(await raster().toFormat(format).toBuffer(), "photo");
  const metadata = await sharp(result.bytes).metadata();
  expect(metadata.format).toBe("webp"); expect(metadata.width).toBe(1600); expect(metadata.height).toBe(800);
  expect(metadata.exif).toBeUndefined(); expect(result.size).toBeLessThan(MAX_INPUT_BYTES);
});
it("preserves transparent logos, limits to 512 and never enlarges", async () => {
  const result = await optimizeImage(await raster(1024, 512, true).png().toBuffer(), "logo");
  const metadata = await sharp(result.bytes).metadata();
  expect(metadata.width).toBe(512); expect(metadata.hasAlpha).toBe(true);
  expect((await optimizeImage(await raster(40, 20).png().toBuffer(), "photo")).width).toBe(40);
});
it("orients EXIF-rotated images and strips private metadata", async () => {
  const result = await optimizeImage(await raster(80, 40).withMetadata({ orientation: 6 }).jpeg().toBuffer(), "photo");
  expect([result.width, result.height]).toEqual([40, 80]);
  expect((await sharp(result.bytes).metadata()).orientation).toBeUndefined();
});
it("rejects empty, corrupt, oversized, unsupported, extreme dimensions and animation", async () => {
  for (const bytes of [Buffer.alloc(0), Buffer.from("fake image"), Buffer.alloc(MAX_INPUT_BYTES + 1), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'), await raster(20000, 1).png().toBuffer(), Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAAAAAAALAAAAAABAAEAAAIBRAA7", "base64")]) {
    await expect(optimizeImage(bytes, "photo")).rejects.toThrow();
  }
  const pixels = Buffer.concat([Buffer.alloc(4 * 4 * 3, 40), Buffer.alloc(4 * 4 * 3, 240)]);
  const animation = await sharp(pixels, { raw: { width: 4, height: 8, channels: 3, pageHeight: 4 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
  await expect(optimizeImage(animation, "photo")).rejects.toThrow(/animated/i);
});
it("only optimizes local raster paths and configured public bucket", () => {
  const host = "https://media.example.test";
  expect(isOptimizableImage("/payment-nfc.webp", host)).toBe(true);
  expect(isOptimizableImage(`${host}/storage/v1/object/public/business-media/owner/biz/image.webp`, host)).toBe(true);
  for (const url of ["https://other.test/image.jpg", `${host}/storage/v1/object/public/other/image.webp`, "//other.test/a.jpg", "/icon.svg", "/../secret.png"]) expect(isOptimizableImage(url, host)).toBe(false);
});
it("uses immutable owner/business paths and cleans storage after metadata failure", async () => {
  const upload = vi.fn().mockResolvedValue({ error: null }); const remove = vi.fn().mockResolvedValue({ error: null });
  const insert = vi.fn().mockResolvedValue({ error: { message: "metadata failed" } });
  const client = { storage: { from: () => ({ upload, remove, getPublicUrl: () => ({ data: { publicUrl: "https://fixture/image.webp" } }) }) }, from: () => ({ insert }) };
  await expect(storeManagedImage(client as never, "owner", "business", await optimizeImage(await raster(20, 20).png().toBuffer(), "logo"), "Logo")).rejects.toThrow();
  expect(upload.mock.calls[0][0]).toMatch(/^owner\/business\/[a-f0-9-]+\.webp$/);
  expect(upload.mock.calls[0][2]).toMatchObject({ upsert: false, contentType: "image/webp", cacheControl: "31536000" });
  expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
  upload.mockResolvedValue({ error: { message: "storage failed" } }); remove.mockClear(); insert.mockClear();
  await expect(storeManagedImage(client as never, "owner", "business", await optimizeImage(await raster(20, 20).png().toBuffer(), "logo"), "Logo")).rejects.toThrow();
  expect(insert).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
});
