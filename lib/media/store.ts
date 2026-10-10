import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ManagedImage } from "./optimize";

export async function storeManagedImage(supabase: SupabaseClient, ownerId: string, businessId: string, image: ManagedImage, alt: string) {
  const path = `${ownerId}/${businessId}/${randomUUID()}.webp`;
  const bucket = supabase.storage.from("business-media");
  const { error } = await bucket.upload(path, image.bytes, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (error) throw new Error("Upload failed. Retry the image upload.");
  try {
    const { error: metadataError } = await supabase.from("media_assets").insert({ business_id: businessId, storage_path: path, mime_type: "image/webp", size_bytes: image.size, alt_text: alt.trim().slice(0, 200) });
    if (metadataError) throw metadataError;
  } catch {
    const { error: cleanupError } = await bucket.remove([path]);
    if (cleanupError) console.error("Failed-upload object cleanup failed; media orphan audit required.");
    throw new Error("Could not register the image. Retry the image upload.");
  }
  return { url: bucket.getPublicUrl(path).data.publicUrl, width: image.width, height: image.height, size: image.size };
}
