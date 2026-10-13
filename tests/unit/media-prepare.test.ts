import { expect, it, vi } from "vitest";
import sharp from "sharp";
import { prepareImage } from "../../src/lib/media/prepare";
import { inspectStillRaster } from "../../src/lib/media/inspect";
it.each(["jpeg", "png", "webp"] as const)("inspects %s dimensions before browser allocation", async format => {
  const bytes = await sharp({ create: { width: 100, height: 60, channels: 3, background: "red" } }).toFormat(format).toBuffer();
  expect(inspectStillRaster(bytes)).toEqual({ width: 100, height: 60 });
});
it("passes small images to authoritative decoding and limits inputs per image", async () => {
  const file = new File([new Uint8Array([1, 2, 3])], "image.png");
  expect(await prepareImage(file, "photo")).toBe(file);
  await expect(prepareImage(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png"), "photo")).rejects.toThrow("5 MiB");
});
it("rejects extreme dimensions before allocating a bitmap and gives a browser fallback", async () => {
  const bytes = await sharp({ create: { width: 20000, height: 1, channels: 3, background: "red" } }).png().toBuffer();
  const padded = new Uint8Array(3 * 1024 * 1024 + 1); padded.set(bytes);
  const bitmap = vi.fn(); vi.stubGlobal("createImageBitmap", bitmap);
  await expect(prepareImage(new File([padded], "extreme.png"), "photo")).rejects.toThrow("dimensions");
  expect(bitmap).not.toHaveBeenCalled();
  const valid = await sharp({ create: { width: 100, height: 60, channels: 3, background: "red" } }).png().toBuffer(); padded.fill(0); padded.set(valid);
  vi.stubGlobal("createImageBitmap", undefined);
  await expect(prepareImage(new File([padded], "large.png"), "photo")).rejects.toThrow("below 3 MiB");
  vi.unstubAllGlobals();
});
