import { z } from "zod";
import { parseSectionContent, sectionKinds, isTemplate } from "./content";
import { isDeliveryProvider, deliveryLinkHref, destinationStrategyFor, isMobileWalletProvider, normalizeEgyptianPhone, normalizeInstagram, normalizeProviderValue, normalizeSafeUrl, type ProviderId } from "./providers";
import { dialablePhone } from "./phone";
import { contactConfigSchema, compileContact } from "./contact";
import { normalizeEditorItems } from "./editor-items";

export const businessSlugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?[a-z0-9]$/,"Use lowercase letters, numbers and hyphens only.");
const draftEnvelopeSchema = z.object({
  businessId: z.string().optional(), pageId: z.string().optional(), name: z.string().optional(), category: z.string().optional(),
  slug: z.string().optional(), template: z.string().optional(), archived: z.boolean().optional(), sections: z.array(z.unknown()).optional(),
  providerProfiles: z.record(z.string(), z.unknown()).optional(), contact: z.unknown().optional(),
  expectedPageRevision: z.number().optional(), expectedBusinessRevision: z.number().optional(),
}).passthrough();
type DraftSection = { id?: string; section_key?: string; key: string; kind: string; title: string; position: number; enabled: boolean; content: Record<string, unknown> };
type DraftProviderProfile = { value?: string; url?: string; destinationStrategy?: string };
const MAX_DRAFT_SECTIONS = 40;
const MAX_DRAFT_ITEMS = 400;
const MAX_DRAFT_TEXT_BYTES = 512 * 1024;

export type ParsedDraft = ReturnType<typeof parseDraftPayload>;
export function parseDraftPayload(raw: string) {
 if (new TextEncoder().encode(raw).byteLength > 256 * 1024) throw new Error("Draft is too large.");
 const parsed = draftEnvelopeSchema.parse(JSON.parse(raw));
 const name = String(parsed.name || "").trim().slice(0, 120);
 const category = String(parsed.category || "business").trim().slice(0, 80) || "business";
 const slug = String(parsed.slug || "").trim().toLowerCase();
 const template = String(parsed.template || "professional");
 if (!parsed.businessId || !parsed.pageId || !name || !businessSlugSchema.safeParse(slug).success || !isTemplate(template)) throw new Error("Check the business name, slug and template.");
 const sections = parsed.sections || [];
 if (sections.length > MAX_DRAFT_SECTIONS) throw new Error("Too many sections.");
 let itemCount = 0;
 let decodedTextBytes = new TextEncoder().encode(name + category + slug + template).byteLength;
 if (!sections.some(section => (section as DraftSection).kind === "hero")) throw new Error("A page needs a hero section.");
 const cleanSections = sections.map((rawSection, index) => {
   const section = rawSection as DraftSection;
   if (!section || !sectionKinds.includes(section.kind as typeof sectionKinds[number])) throw new Error("Unsupported section type.");
   const key = String(section.section_key || section.key || section.kind).toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40) || `section_${index + 1}`;
   const rawContent = section.content && typeof section.content === "object" ? section.content : {};
   itemCount += countDraftItems(rawContent);
   if (itemCount > MAX_DRAFT_ITEMS) throw new Error("Draft content exceeds the permitted limit.");
   const content = cleanSectionContent(rawContent, section.kind, key);
   decodedTextBytes += new TextEncoder().encode(JSON.stringify(content)).byteLength + new TextEncoder().encode(String(section.title ?? section.kind)).byteLength;
   if (itemCount > MAX_DRAFT_ITEMS || decodedTextBytes > MAX_DRAFT_TEXT_BYTES) throw new Error("Draft content exceeds the permitted limit.");
   if (section.kind === "about" && content.description !== undefined && (typeof content.description !== "string" || content.description.length > 1200 || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(content.description))) throw new Error("About copy must be plain text up to 1200 characters.");
   parseSectionContent(JSON.stringify(content), section.kind);
   return { key, kind: section.kind, title: String(section.title ?? section.kind).trim().slice(0, 80), position: index, enabled: Boolean(section.enabled), content };
 });
 const rawProfiles = parsed.providerProfiles || {};
 for (const [provider, rawProfile] of Object.entries(rawProfiles)) {
  const profile = rawProfile as DraftProviderProfile | undefined;
  decodedTextBytes += new TextEncoder().encode(provider + JSON.stringify(profile || {})).byteLength;
  if (isDeliveryProvider(provider) && profile?.url && !deliveryLinkHref(provider, profile.url)) throw new Error("Delivery destinations must be safe HTTPS URLs.");
 }
 if (Object.keys(rawProfiles).length > 40 || decodedTextBytes > MAX_DRAFT_TEXT_BYTES) throw new Error("Draft content exceeds the permitted limit.");
 const providerProfiles = Object.fromEntries(Object.entries(rawProfiles).slice(0, 40).map(([provider, rawProfile]) => {
   const profile = rawProfile as DraftProviderProfile | undefined;
   return [provider.slice(0, 40), { value: String(profile?.value || "").trim().slice(0, 500) || undefined, url: String(profile?.url || "").trim().slice(0, 2048) || undefined, destinationStrategy: destinationStrategyFor(provider, profile?.destinationStrategy, profile?.url) }];
 }));
 const contact = parsed.contact === undefined ? undefined : contactConfigSchema.parse(parsed.contact);
 if (contact) compileContact(contact, { business: { name }, sections: cleanSections });
 return { contact, expectedPageRevision: parsed.expectedPageRevision, expectedBusinessRevision: parsed.expectedBusinessRevision, businessId: parsed.businessId, pageId: parsed.pageId, name, category, slug, template, archived: Boolean(parsed.archived), sections: cleanSections, providerProfiles };
}

function countDraftItems(value: unknown): number {
 if (Array.isArray(value)) return value.reduce((count, item) => count + 1 + countDraftItems(item), 0);
 if (value && typeof value === "object") return Object.values(value).reduce((count, item) => count + countDraftItems(item), 0);
 return 0;
}

function cleanSectionContent(content: Record<string, unknown>, kind: string, scope: string): Record<string, unknown> {
 content = {...content,...(Array.isArray(content.items)?{items:normalizeEditorItems(content.items,kind,scope)}:{})};
 const next: Record<string, unknown> = { ...content };
 for (const [key, value] of Object.entries(next)) {
  if (!Array.isArray(value)) continue;
  next[key] = value.filter(raw => {
   if (!raw || typeof raw !== "object") return false;
   const item = raw as Record<string, unknown>;
   return (Array.isArray(item.actions) && item.actions.length > 0) || [item.label, item.url, item.value, item.provider, item.icon, item.subtitle, item.badge].some(part => typeof part === "string" && part.trim());
  }).map(raw => {
   const item = raw as Record<string, unknown>;
   const provider = typeof item.provider === "string" ? item.provider.trim().slice(0, 40) : undefined;
   const label = String(item.label || "").trim().slice(0, 80);
   const valueText = String(item.value || "").slice(0, 500);
   const url = String(item.url || "").trim().slice(0, 2048);
   if (isDeliveryProvider(provider) && item.url && !deliveryLinkHref(provider, String(item.url))) throw new Error("Delivery destinations must be complete HTTPS URLs without credentials or control characters.");
   if ((provider === "call" || provider === "phone") && valueText && !dialablePhone(valueText)) throw new Error("Use digits, spaces, +, parentheses, hyphens, dots, * or # for this phone action.");
   if (provider === "whatsapp" && valueText && !normalizeEgyptianPhone(valueText) && !normalizeSafeUrl(url)) throw new Error("Use a valid WhatsApp number or destination URL.");
   if (provider === "instagram" && valueText && !normalizeInstagram(valueText)) throw new Error("Use a valid Instagram handle or URL.");
   if (["facebook","tiktok","youtube","snapchat","x","linkedin","github","behance","artstation","dribbble","medium","telegram","website","maps","reviews","booking","order","location","menu","custom"].includes(provider || "") && url && !normalizeSafeUrl(url) && !(provider === "custom" && url.startsWith("/") && !url.startsWith("//") && !url.includes(".."))) throw new Error("Use a complete https:// destination URL.");
   if (provider === "instapay" && valueText && !normalizeProviderValue("instapay" as ProviderId, valueText)) throw new Error("Use an InstaPay ID such as name@provider.");
   if (isMobileWalletProvider(provider) && valueText && !normalizeEgyptianPhone(valueText)) throw new Error("Use a valid Egyptian wallet number.");
   const destinationStrategy = destinationStrategyFor(provider, typeof item.destinationStrategy === "string" ? item.destinationStrategy : undefined, url);
   return { id: item.id, ...(kind === "gallery" && item.imageEdit ? {imageEdit:item.imageEdit} : {}), subtitle: typeof item.subtitle === "string" ? item.subtitle.trim().slice(0,500) : undefined, badge: typeof item.badge === "string" ? item.badge.trim().slice(0,80) : undefined, ...(Array.isArray(item.actions) ? {actions: cleanSectionContent({items:item.actions}, "quick_actions", String(item.id)).items} : {}), label, value: valueText, url, alt: typeof item.alt === "string" ? item.alt.trim().slice(0, 200) : undefined, provider, phoneType: ["mobile","landline","work","other"].includes(String(item.phoneType)) ? String(item.phoneType) : undefined, destinationStrategy, profileOverride: item.profileOverride === true, enabled: item.enabled !== false, icon: typeof item.icon === "string" ? item.icon.trim().slice(0, 40) : undefined };
  });
 }
 return next;
}
