import { z } from "zod";

export const safeUrl = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:", "tel:"].includes(url.protocol) && !/^(javascript|data|vbscript):/i.test(value);
  } catch { return false; }
};
export const safeContentUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("..")) return value.length <= 2048;
  return safeUrl(value);
};
export const providerSchema = z.string().trim().max(40).regex(/^[a-z0-9_-]+$/i).optional();
export const itemSchema = z.object({
  label: z.string().trim().min(1).max(80),
  url: z.string().trim().max(2048).optional().or(z.literal("")),
  value: z.string().trim().max(500).optional().or(z.literal("")),
  provider: providerSchema,
  enabled: z.boolean().optional(),
  icon: z.string().trim().max(40).optional(),
}).strict().superRefine((item, ctx) => {
  if (item.url && !safeUrl(item.url)) ctx.addIssue({ code: "custom", path: ["url"], message: "Use a safe http(s), mailto, or tel URL." });
});
export const sectionContentSchema = z.record(z.string(), z.unknown()).superRefine((content, ctx) => {
  for (const [key, value] of Object.entries(content)) {
    if (/url|link|href/i.test(key) && typeof value === "string" && value && !safeContentUrl(value)) ctx.addIssue({ code: "custom", message: "Use a safe local path or complete http(s), mailto, or tel URL." });
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

// Keep the original three-value export for backwards compatibility with existing
// integrations, while the editor exposes four business presets through the
// richer metadata below. `retail` remains a supported legacy value.
export const templates = ["cafe","retail","professional"] as const;
export const templateValues = ["cafe", "restaurant", "salon", "professional", "retail"] as const;
export type TemplateValue = typeof templateValues[number];
export const templatePresets: Array<{ value: TemplateValue; label: string; description: string; sections: string[] }> = [
  { value: "cafe", label: "Premium Coffee Shop", description: "Hero, social, payments, reviews, directions and hours", sections: ["hero", "social", "payments", "reviews", "contact", "hours"] },
  { value: "restaurant", label: "Restaurant", description: "Menu-first layout with ordering and location", sections: ["hero", "contact", "hours", "services", "social", "reviews"] },
  { value: "salon", label: "Salon / Beauty", description: "Services, booking links and social proof", sections: ["hero", "contact", "hours", "services", "social", "reviews"] },
  { value: "professional", label: "Universal / Professional", description: "Clear identity, contact and useful links", sections: ["hero", "about", "contact", "links", "social", "reviews"] },
];
export function isTemplate(value: string): value is TemplateValue {
  return (templateValues as readonly string[]).includes(value);
}
export function presetSections(value: string) {
  return templatePresets.find(preset => preset.value === value)?.sections || templatePresets[3].sections;
}
