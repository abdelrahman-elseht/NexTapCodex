import sharp from "sharp";
import { cropRectangle, type ContactCrop } from "@/lib/business/contact-crop";
/** Immutable upload-time derivative. Sharp strips metadata unless explicitly retained. */
export async function prepareContactPhoto(bytes: Uint8Array, crop?: ContactCrop) {
  if (crop) {
    const oriented = await sharp(bytes, { limitInputPixels: 20_000_000 }).rotate().toBuffer({ resolveWithObject: true });
    bytes = await sharp(oriented.data).extract(cropRectangle(oriented.info.width, oriented.info.height, crop)).toBuffer();
  }
  for (const quality of [82, 65, 45]) {
    const photo = await sharp(bytes, { limitInputPixels: 20_000_000 }).rotate().resize({ width: 384, height: 384, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (photo.length <= 100 * 1024) return photo;
  }
  throw new Error("Could not prepare the contact photo within its size limit.");
}
