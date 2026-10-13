import { MAX_DIMENSION, MAX_INPUT_BYTES, MAX_PIXELS, MAX_TRANSPORT_BYTES, type ImageRole } from "./limits";

import { inspectStillRaster } from "./inspect";

export async function prepareImage(file: File, role: ImageRole): Promise<Blob> {
  if (!file.size || file.size > MAX_INPUT_BYTES) throw new Error("Choose an image up to 5 MiB per image.");
  if (file.size <= MAX_TRANSPORT_BYTES) return file; // authoritative decoding stays on the server
  const dimensions = inspectStillRaster(new Uint8Array(await file.arrayBuffer()));
  if (!dimensions) throw new Error("Choose a still JPEG, PNG or WebP image.");
  if (!dimensions.width || !dimensions.height || dimensions.width * dimensions.height > MAX_PIXELS || Math.max(dimensions.width, dimensions.height) > MAX_DIMENSION) throw new Error("Image dimensions exceed the 20 megapixel limit.");
  if (typeof createImageBitmap !== "function") throw new Error("This browser cannot prepare large images. Choose an image below 3 MiB or use a current browser.");
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { throw new Error("This image could not be decoded. Choose another image."); }
  try {
    if (bitmap.width * bitmap.height > MAX_PIXELS || Math.max(bitmap.width, bitmap.height) > MAX_DIMENSION) throw new Error("Image dimensions exceed the 20 megapixel limit.");
    const ratio = Math.min(1, (role === "logo" ? 512 : 1600) / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d"); if (!context) throw new Error("Image preparation unavailable. Choose an image below 3 MiB.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", 0.9));
    if (!blob || blob.size > MAX_TRANSPORT_BYTES) throw new Error("This image is too large to upload. Choose a smaller image.");
    return blob;
  } finally { bitmap.close(); }
}
