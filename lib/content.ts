import { z } from "zod";

export const safeUrl = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > 2048) return false;
  try { const url = new URL(value); return ["https:", "http:", "mailto:", "tel:"].includes(url.protocol); } catch { return false; }
};
export const itemSchema = z.object({ label: z.string().trim().min(1).max(80), url: z.string().max(2048).optional(), value: z.string().max(500).optional() }).strict();
export const sectionContentSchema = z.record(z.string(), z.unknown()).superRefine((content, ctx) => {
  for (const [key, value] of Object.entries(content)) {
    if (/url|link|href/i.test(key) && typeof value === "string" && value && !safeUrl(value)) ctx.addIssue({ code: "custom", message: "Use a complete http(s), mailto, or tel URL." });
    if (Array.isArray(value) && value.length > 100) ctx.addIssue({ code: "custom", message: "A section can contain at most 100 items." });
    if (Array.isArray(value)) for (const raw of value) {
      const parsed = itemSchema.safeParse(raw);
      if (!parsed.success) ctx.addIssue({ code: "custom", message: "Items need a short label and a safe URL or text value." });
      else if (parsed.data.url && !safeUrl(parsed.data.url)) ctx.addIssue({ code: "custom", message: "Item URL is not safe." });
    }
  }
});
export function parseSectionContent(raw: string) {
  const parsed = sectionContentSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Invalid section content.");
  return parsed.data;
}
export function reorderSectionIds<T extends { id: string }>(sections: T[], movingId: string, targetId: string) {
  const ids = sections.map(section => section.id);
  const from = ids.indexOf(movingId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return ids;
  const [moving] = ids.splice(from, 1);
  ids.splice(from < to ? to - 1 : to, 0, moving);
  return ids;
}
export const sectionKinds = ["hero","about","hours","contact","social","payments","links","services","gallery","reviews","branch"] as const;
export const templates = ["cafe","retail","professional"] as const;
