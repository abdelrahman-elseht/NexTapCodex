import { z } from "zod";
import { dialablePhone, phoneTypes, type PhoneType } from "./phone";
import { isPaymentProvider } from "./providers";
import { contactCropSchema } from "./contact-crop";

const bytes = (value: string) => new TextEncoder().encode(value).length;
const text = z.string().max(2000).refine(value => bytes(value) <= 8192 && !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value), "Use plain text without control characters.");
export const contactKinds = ["phone", "email", "website", "address", "whatsapp", "social", "hours", "notes", "custom"] as const;
const binding = z.object({ sectionKey: z.string().max(40), itemId: z.string().max(200).optional(), property: z.enum(["value", "url", "phone", "email", "address"]) }).strict();
export const contactConfigSchema = z.object({
  enabled: z.boolean(), displayName: text, organization: text, primaryPhone: text,
  primaryPhoneFieldId: z.string().min(1).max(100).optional(), primaryPhoneBinding: binding.optional(), primaryPhoneType: z.enum(phoneTypes).optional(),
  nameFromPage: z.boolean().default(false), phoneFromPage: z.boolean().default(false),
  photoUrl: z.string().max(2048).default(""), photoAssetId: z.uuid().optional(), photoCrop: contactCropSchema.optional(), showDownloadLink: z.boolean().default(true),
  fields: z.array(z.object({ id: z.string().min(1).max(100), kind: z.enum(contactKinds), label: text.refine(value => value.length <= 100, "Labels must be at most 100 characters."), value: text, enabled: z.boolean(), phoneType: z.enum(phoneTypes).optional(), binding: binding.optional() }).strict()).max(30),
}).strict().superRefine((value, ctx) => {
  if (bytes(JSON.stringify(value)) > 65536) ctx.addIssue({ code: "custom", message: "Contact configuration exceeds 64 KiB." });
  const overrides = { displayName: value.displayName, organization: value.organization, primaryPhone: value.primaryPhone, fields: value.fields.map(field => ({ id: field.id, value: field.value })) };
  if (bytes(JSON.stringify(overrides)) > 16384) ctx.addIssue({ code: "custom", message: "Page contact overrides exceed 16 KiB." });
  if (new Set(value.fields.map(field => field.id)).size !== value.fields.length) ctx.addIssue({ code: "custom", path: ["fields"], message: "Contact field IDs must be unique." });
});
export type ContactConfig = z.infer<typeof contactConfigSchema>;
export type ContactProjection = { version: 1; enabled: true; displayName: string; organization: string; primaryPhone: string; primaryPhoneType?: PhoneType; fields: { kind: typeof contactKinds[number]; label: string; value: string; phoneType?: PhoneType }[]; photoPath?: string; showDownloadLink?: boolean };
export const emptyContact = (): ContactConfig => ({ enabled: false, displayName: "", organization: "", primaryPhone: "", nameFromPage: false, phoneFromPage: false, photoUrl: "", showDownloadLink: true, fields: [] });
export function contactPhone(value: string) { return dialablePhone(value) ? value : ""; }
export function contactWeb(value: string) { try { const url = new URL(value); return value.length <= 2048 && !/[\u0000-\u0020\u007f]/.test(value) && ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; } }
export function contactNote(value: string) { const urls: string[] = []; const remainder = value.replace(/https?:\/\/[^\s<>\"]+/gi, token => { const url = token.replace(/[.,;!?)}\]]+$/, ""); if (!contactWeb(url)) return token; urls.push(url); return token.slice(url.length); }).replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim(); return { urls, text: remainder }; }
export function contactBindingAllowed(item: { provider?: string; url?: unknown }, property: string) { return !isPaymentProvider(item.provider) || (item.provider === "instapay" && property === "url" && typeof item.url === "string" && contactWeb(item.url)); }
type ContactSource = { business?: { name?: string }; page?: { branchName?: string }; sections?: { key?: string; section_key?: string; kind: string; enabled: boolean; content: Record<string, unknown> }[] };
export function compileContact(raw: unknown, source: ContactSource): ContactProjection | undefined {
  const config = contactConfigSchema.parse(raw); if (!config.enabled) return undefined;
  const sections = source.sections || []; const displayName = config.nameFromPage ? source.page?.branchName || source.business?.name || "" : config.displayName; text.parse(displayName);
  if (!displayName.trim()) throw new Error("Display name: enter a name or bind the page name.");
  const resolveBinding = (candidate: NonNullable<ContactConfig["primaryPhoneBinding"]>) => {
    const section = sections.find(section => (section.key || section.section_key) === candidate.sectionKey && section.enabled && section.kind !== "gallery" && (section.kind !== "payments" || (candidate.itemId && candidate.property === "url")));
    const items = Array.isArray(section?.content.items) ? section.content.items : [];
    const candidates = items.flatMap(item => [item, ...(item && typeof item === "object" && (item as { enabled?: boolean }).enabled !== false && Array.isArray((item as { actions?: unknown[] }).actions) ? (item as { actions: unknown[] }).actions : [])]);
    const item = candidate.itemId ? candidates.find(item => item && typeof item === "object" && (item as { id?: string }).id === candidate.itemId && (item as { enabled?: boolean }).enabled !== false && contactBindingAllowed(item as { provider?: string; url?: unknown }, candidate.property)) : undefined;
    return candidate.itemId ? item as Record<string, unknown> | undefined : section?.content;
  };
  const primarySource = config.primaryPhoneBinding ? resolveBinding(config.primaryPhoneBinding) : undefined;
  let primaryPhone = config.primaryPhoneBinding ? String(primarySource?.[config.primaryPhoneBinding.property] || "") : config.phoneFromPage ? String(sections.find(section => section.kind === "contact" && section.enabled)?.content.phone || "") : config.primaryPhone;
  let primaryPhoneType = config.primaryPhoneBinding ? primarySource?.phoneType as PhoneType | undefined : config.primaryPhoneType;
  const fields = config.fields.filter(field => field.enabled).map(field => {
    let value = field.value; let phoneType = field.phoneType;
    if (field.binding) { const bound = resolveBinding(field.binding); value = String(bound?.[field.binding.property] || ""); phoneType = phoneType || bound?.phoneType as PhoneType | undefined; }
    text.parse(value); if (!value.trim()) throw new Error(`${field.label || field.kind}: enter a value or repair the page binding.`);
    if (field.kind === "phone" && !contactPhone(value)) throw new Error(`${field.label || "Phone"}: invalid number.`);
    if (field.phoneType && !phoneTypes.includes(field.phoneType)) throw new Error(`${field.label || "Phone"}: invalid phone type.`);
    if (field.kind === "email" && (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) throw new Error(`${field.label || "Email"}: invalid email.`);
    if (["website", "social", "whatsapp"].includes(field.kind) && !contactWeb(value)) throw new Error(`${field.label || field.kind}: use a complete safe web URL.`);
    if (config.primaryPhoneFieldId === field.id && field.kind === "phone") { primaryPhone = value; primaryPhoneType = phoneType; }
    return { kind: field.kind, label: field.label, value, ...(field.kind === "phone" && phoneType ? { phoneType } : {}) };
  });
  if (config.primaryPhoneFieldId && !config.fields.some(field => field.id === config.primaryPhoneFieldId && field.kind === "phone" && field.enabled)) primaryPhone = "";
  if (primaryPhoneType && !phoneTypes.includes(primaryPhoneType)) throw new Error("Invalid primary phone type.");
  if (!contactPhone(primaryPhone)) throw new Error("Primary phone: enter a dialable number or select a saved phone entry.");
  const note = fields.filter(field => ["hours", "notes", "custom"].includes(field.kind)).flatMap(field => { const value = contactNote(field.value).text; return value ? [`${field.label || field.kind}: ${value}`] : []; }).join("\n");
  if (note.length > 8000 || bytes(note) > 32768) throw new Error("Combined notes exceed the contact limit.");
  return { version: 1, enabled: true, displayName, organization: config.organization, primaryPhone, ...(primaryPhoneType ? { primaryPhoneType } : {}), fields, showDownloadLink: config.showDownloadLink };
}
