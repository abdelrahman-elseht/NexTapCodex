import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ManagedImage } from "./optimize";
import { prepareContactPhoto } from "./contact-photo";

export async function storeManagedImage(supabase: SupabaseClient, ownerId: string, businessId: string, image: ManagedImage, alt: string) {
  const path = `${ownerId}/${businessId}/${randomUUID()}.webp`;
  const bucket = supabase.storage.from("business-media");
  const photo = await prepareContactPhoto(image.bytes);
  const photoPath = path.replace(/\.webp$/, ".contact.jpg");
  const { error } = await bucket.upload(path, image.bytes, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (error) throw new Error("Upload failed. Retry the image upload.");
  let photoAssetId: string;
  try {
    const { error: photoError } = await bucket.upload(photoPath, photo, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    if (photoError) throw photoError;
    const { data: asset, error: metadataError } = await supabase.from("media_assets").insert({ business_id: businessId, storage_path: path, contact_photo_path: photoPath, mime_type: "image/webp", size_bytes: image.size, alt_text: alt.trim().slice(0, 200) }).select("id").single();
    if (metadataError) throw metadataError;
    if (!asset) throw new Error("Image metadata missing.");
    photoAssetId = asset.id;
  } catch {
    const { error: cleanupError } = await bucket.remove([path, photoPath]);
    if (cleanupError) console.error("Failed-upload object cleanup failed; media orphan audit required.");
    throw new Error("Could not register the image. Retry the image upload.");
  }
  return { url: bucket.getPublicUrl(path).data.publicUrl, photoAssetId, width: image.width, height: image.height, size: image.size };
}
