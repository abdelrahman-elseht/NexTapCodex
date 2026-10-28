import sharp from "sharp";
import { inspectStillRaster } from "./inspect";
import { MAX_INPUT_BYTES, MAX_PIXELS, MAX_DIMENSION, type ImageRole } from "./limits";
export { MAX_INPUT_BYTES } from "./limits";
export type ManagedImage = { bytes: Buffer; width: number; height: number; size: number; format: "avif" | "webp" };

/** Bytes, never a filename or MIME declaration, are the source of truth. */
export async function optimizeImage(input: Buffer, role: ImageRole): Promise<ManagedImage> {
  if (!input.length || input.length > MAX_INPUT_BYTES) throw new Error("Choose an image between 1 byte and 5 MiB.");
  try {
    const pipeline = sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "warning", animated: true });
    const metadata = await pipeline.metadata();
    const inspected = inspectStillRaster(input);
    // Some valid AVIF brand combinations are reported by Sharp/libheif as
    // image/heic (for example, a `mif1` major brand). The bounded byte
    // inspector has already established the AVIF-compatible ftyp and ispe.
    const isAvif = metadata.format === "heif" && (metadata.mediaType === "image/avif" || inspected !== null);
    if (!["jpeg", "png", "webp"].includes(metadata.format || "") && !isAvif) throw new Error("Choose a still JPEG, PNG, WebP or AVIF image.");
    if ((metadata.pages || 1) > 1) throw new Error("Animated images are not supported. Choose a still image.");
    if (!inspected) throw new Error("Choose a valid still JPEG, PNG, WebP or AVIF image; animations are not supported.");
    if (!metadata.width || !metadata.height || metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION || metadata.width * metadata.height > MAX_PIXELS) throw new Error("Image dimensions exceed the 20 megapixel limit.");
    const edge = role === "logo" ? 512 : 1600;
    // Keep AVIF uploads in AVIF; transcoding them to WebP can expand the stored file.
    const format = isAvif ? "avif" : "webp";
    const output = pipeline.rotate().resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true });
    const { data, info } = await (format === "avif" ? output.avif({ quality: 60, effort: 4 }) : output.webp({ quality: 82, effort: 4 })).toBuffer({ resolveWithObject: true });
    if (data.length > MAX_INPUT_BYTES) throw new Error("The processed image is too large. Choose a smaller image.");
    return { bytes: data, width: info.width, height: info.height, size: data.length, format };
  } catch (error) {
    if (error instanceof Error && /Choose|Animated|dimensions|processed/.test(error.message)) throw error;
    throw new Error("This image could not be decoded. Choose a valid still JPEG, PNG, WebP or AVIF.");
  }
}
