import { z } from "zod";

// Integer coordinates keep browser, Sharp and PostgreSQL cache keys identical.
export const contactCropSchema = z.object({
  x: z.number().int().min(0).max(1000),
  y: z.number().int().min(0).max(1000),
  zoom: z.number().int().min(1000).max(4000),
}).strict();
export type ContactCrop = z.infer<typeof contactCropSchema>;
export const defaultContactCrop: ContactCrop = { x: 500, y: 500, zoom: 1000 };
export function cropRectangle(width: number, height: number, crop: ContactCrop) {
  const size = Math.max(1, Math.floor(Math.min(width, height) * 1000 / crop.zoom));
  return { left: Math.round((width - size) * crop.x / 1000), top: Math.round((height - size) * crop.y / 1000), width: size, height: size };
}
export function croppedPhotoPath(path: string, crop: ContactCrop) {
  return path.replace(/\.[^.]+$/, `.crop-${crop.x}-${crop.y}-${crop.zoom}.contact.jpg`);
}
export function contactPhotoUrl(config: { photoUrl: string; photoAssetId?: string }, sections: { kind: string; enabled: boolean; content: Record<string, unknown> }[]) {
  return config.photoUrl || (config.photoAssetId ? "" : String(sections.find(section => section.kind === "hero" && section.enabled)?.content.logoUrl || ""));
}
