import { z } from "zod";
import { contactCropSchema } from "@/lib/business/contact-crop";
import { mediaDisplayUrl } from "./urls";
import { readBoundedBody } from "@/lib/security/bounded-body";
import { inspectStillRaster } from "./inspect";

export const imageEditSchema = z.object({
  sourceUrl: z.string().max(2048).refine(value => {
    if (value.startsWith("/") && !value.startsWith("//") && !value.includes("..")) return true;
    try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
  }),
  crop: contactCropSchema,
  aspect: z.number().min(0.25).max(4),
}).strict();
export type ImageEdit = z.infer<typeof imageEditSchema>;

export function imageCropRectangle(width: number, height: number, crop: ImageEdit["crop"], aspect: number) {
  const baseWidth = Math.min(width, height * aspect);
  const cropWidth = Math.max(1, Math.floor(baseWidth * 1000 / crop.zoom));
  const cropHeight = Math.max(1, Math.min(height, Math.round(cropWidth / aspect)));
  return { left: Math.round((width - cropWidth) * crop.x / 1000), top: Math.round((height - cropHeight) * crop.y / 1000), width: cropWidth, height: cropHeight };
}

/** Export only on Apply; retain the source URL for subsequent adjustments. */
export async function renderImageCrop(sourceUrl: string, crop: ImageEdit["crop"], aspect: number, edge: number) {
  const displayUrl = mediaDisplayUrl(sourceUrl);
  const response = await fetch(displayUrl, { mode: "cors", credentials: displayUrl.startsWith("/api/media/") ? "same-origin" : "omit", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("Could not load the original image. Retry or upload another image.");
  const bytes = await readBoundedBody(response, 5 * 1024 * 1024);
  const dimensions = inspectStillRaster(bytes);
  if (!dimensions || dimensions.width * dimensions.height > 20_000_000 || Math.max(dimensions.width, dimensions.height) > 16_384) throw new Error("Choose a still image within the 20 megapixel limit.");
  const blob = new Blob([new Uint8Array(bytes)]);
  const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  try {
    if (bitmap.width * bitmap.height > 20_000_000 || Math.max(bitmap.width, bitmap.height) > 16_384) throw new Error("Image dimensions exceed the 20 megapixel limit.");
    const rect = imageCropRectangle(bitmap.width, bitmap.height, crop, aspect);
    const scale = Math.min(1, edge / Math.max(rect.width, rect.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(rect.width * scale)); canvas.height = Math.max(1, Math.round(rect.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image cropping is unavailable in this browser.");
    context.drawImage(bitmap, rect.left, rect.top, rect.width, rect.height, 0, 0, canvas.width, canvas.height);
    const output = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", 0.9));
    if (!output) throw new Error("Could not prepare the crop. Retry.");
    return output;
  } finally { bitmap.close(); }
}
