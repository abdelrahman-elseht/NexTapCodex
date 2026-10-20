import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContactConfig } from "@/lib/business/contact";
import { contactPhotoUrl, croppedPhotoPath } from "@/lib/business/contact-crop";
import { prepareContactPhoto } from "./contact-photo";

type Section = { kind: string; enabled: boolean; content: Record<string, unknown> };
/** Owner-only preparation on save/private preview. Downloads only read frozen bytes. */
export async function resolveContactPhoto(client: SupabaseClient, businessId: string, config: ContactConfig, sections: Section[]) {
  const url = contactPhotoUrl(config, sections);
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prefix = `${origin}/storage/v1/object/public/business-media/`;
  let query = client.from("media_assets").select("id,storage_path,contact_photo_path").eq("business_id", businessId);
  if (config.photoAssetId) query = query.eq("id", config.photoAssetId);
  else {
    // Never fetch arbitrary URLs or accept a different project's storage objects.
    if (!url.startsWith(prefix)) return;
    const path = url.slice(prefix.length);
    if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(webp|png|jpe?g)$/i.test(path)) return;
    query = query.eq("storage_path", path);
  }
  const { data: asset, error } = await query.maybeSingle();
  if (error) throw new Error("Could not check the contact photo. Retry saving.");
  if (!asset) { if (config.photoAssetId) throw new Error("Contact photo is not available for this business."); return; }
  if (!config.photoCrop && asset.contact_photo_path) return asset.contact_photo_path as string;
  const path = config.photoCrop ? croppedPhotoPath(asset.storage_path, config.photoCrop) : asset.storage_path.replace(/\.[^.]+$/, ".contact.jpg");
  const bucket = client.storage.from("business-media");
  const { data: existing, error: checkError } = await bucket.exists(path);
  if (checkError && ![400, 404].includes(Number((checkError as { status?: number }).status))) throw new Error("Could not check the cached contact photo. Retry saving.");
  if (!existing) {
    const { data: source, error: sourceError } = await bucket.download(asset.storage_path);
    if (sourceError || !source || source.size > 5 * 1024 * 1024) return;
    let photo: Buffer;
    try { photo = await prepareContactPhoto(new Uint8Array(await source.arrayBuffer()), config.photoCrop); } catch { return; }
    const { error: uploadError } = await bucket.upload(path, photo, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    // Another save may have won the same deterministic cache key. Never overwrite.
    if (uploadError && !(await bucket.exists(path)).data) throw new Error("Could not prepare the contact photo. Retry saving.");
  }
  if (!config.photoCrop && asset.contact_photo_path !== path) {
    const { error: updateError } = await client.from("media_assets").update({ contact_photo_path: path }).eq("id", asset.id).eq("business_id", businessId);
    if (updateError) throw new Error("Could not register the contact photo. Retry saving.");
  }
  return path;
}
