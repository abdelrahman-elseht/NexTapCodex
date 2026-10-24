import { expect, it, vi } from "vitest";
import sharp from "sharp";
import { prepareImage } from "../../src/lib/media/prepare";
import { inspectStillRaster } from "../../src/lib/media/inspect";
it.each(["jpeg", "png", "webp", "avif"] as const)("inspects %s dimensions before browser allocation", async format => {
  const bytes = await sharp({ create: { width: 100, height: 60, channels: 3, background: "red" } }).toFormat(format).toBuffer();
  expect(inspectStillRaster(bytes)).toEqual({ width: 100, height: 60 });
});
it("accepts AVIF with mif1 major brand and avif compatible brand", async () => {
  const bytes = Buffer.from(await sharp({ create: { width: 100, height: 60, channels: 3, background: "red" } }).avif().toBuffer());
  bytes.write("mif1", 8, "ascii");
  expect(inspectStillRaster(bytes)).toEqual({ width: 100, height: 60 });
});
it("parses a bounded AVIF ftyp with a 64-bit box size and nested ispe", () => {
  const bytes = new Uint8Array(28 + 36); const view = new DataView(bytes.buffer);
  view.setUint32(0, 1); bytes.set([...Buffer.from("ftyp")], 4); view.setBigUint64(8, BigInt(28));
  bytes.set([...Buffer.from("mif1")], 16); bytes.set([...Buffer.from("avif")], 24);
  view.setUint32(28, 36); bytes.set([...Buffer.from("meta")], 32);
  view.setUint32(36, 0); view.setUint32(40, 24); bytes.set([...Buffer.from("ispe")], 44);
  view.setUint32(52, 100); view.setUint32(56, 60);
  expect(inspectStillRaster(bytes)).toEqual({ width: 100, height: 60 });
});
it("rejects truncated AVIF boxes", () => {
  const bytes = new Uint8Array(28); const view = new DataView(bytes.buffer);
  view.setUint32(0, 28); bytes.set([...Buffer.from("ftyp")], 4); bytes.set([...Buffer.from("mif1")], 8); bytes.set([...Buffer.from("avif")], 16);
  expect(inspectStillRaster(bytes)).toBeNull();
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
