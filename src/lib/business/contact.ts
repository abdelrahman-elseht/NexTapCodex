import { z } from "zod";
import { normalizeEgyptianPhone, isPaymentProvider } from "./providers";
import { contactCropSchema } from "./contact-crop";

const bytes = (value: string) => new TextEncoder().encode(value).length;
const text = z.string().max(2000).refine(value => bytes(value) <= 8192 && !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value), "Use plain text without control characters.");
export const contactKinds = ["phone", "email", "website", "address", "whatsapp", "social", "hours", "notes", "custom"] as const;
const binding = z.object({ sectionKey: z.string().max(40), itemId: z.string().max(200).optional(), property: z.enum(["value", "url", "phone", "email", "address"]) }).strict();
export const contactConfigSchema = z.object({
  enabled: z.boolean(), displayName: text, organization: text, primaryPhone: text,
  nameFromPage: z.boolean().default(false), phoneFromPage: z.boolean().default(false),
  photoUrl: z.string().max(2048).default(""), photoAssetId: z.uuid().optional(),
  photoCrop: contactCropSchema.optional(), showDownloadLink: z.boolean().default(true),
  fields: z.array(z.object({ id: z.string().min(1).max(100), kind: z.enum(contactKinds), label: text.refine(value => value.length <= 100, "Labels must be at most 100 characters."), value: text, enabled: z.boolean(), binding: binding.optional() }).strict()).max(30),
}).strict().superRefine((value, ctx) => {
  if (bytes(JSON.stringify(value)) > 65536) ctx.addIssue({ code: "custom", message: "Contact configuration exceeds 64 KiB." });
  const overrides = { displayName: value.displayName, organization: value.organization, primaryPhone: value.primaryPhone, fields: value.fields.map(field => ({ id: field.id, value: field.value })) };
  if (bytes(JSON.stringify(overrides)) > 16384) ctx.addIssue({ code: "custom", message: "Page contact overrides exceed 16 KiB." });
  if (new Set(value.fields.map(field => field.id)).size !== value.fields.length) ctx.addIssue({ code: "custom", path: ["fields"], message: "Contact field IDs must be unique." });
});
export type ContactConfig = z.infer<typeof contactConfigSchema>;
export type ContactProjection = { version: 1; enabled: true; displayName: string; organization: string; primaryPhone: string; fields: { kind: typeof contactKinds[number]; label: string; value: string }[]; photoPath?: string; showDownloadLink?: boolean };
export const emptyContact = (): ContactConfig => ({ enabled: false, displayName: "", organization: "", primaryPhone: "", nameFromPage: false, phoneFromPage: false, photoUrl: "", showDownloadLink: true, fields: [] });
export function contactPhone(value: string) {
  const egyptian = normalizeEgyptianPhone(value);
  const number = value.trim().replace(/[\s().-]/g, "");
  return egyptian || (/^\+[1-9]\d{6,14}$/.test(number) ? number : "");
}
export function contactWeb(value: string) {
  try { const url = new URL(value); return value.length <= 2048 && !/[\u0000-\u0020\u007f]/.test(value) && ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
/** Keep URLs clickable even when pasted into instructions or custom text. */
export function contactNote(value: string) {
  const urls: string[] = [];
  const remainder = value.replace(/https?:\/\/[^\s<>"]+/gi, token => {
    const url = token.replace(/[.,;!?)}\]]+$/, "");
    if (!contactWeb(url)) return token;
    urls.push(url);
    return token.slice(url.length);
  }).replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
  return { urls, text: remainder };
}
export function contactBindingAllowed(item: { provider?: string; url?: unknown }, property: string) {
  return !isPaymentProvider(item.provider) || (item.provider === "instapay" && property === "url" && typeof item.url === "string" && contactWeb(item.url));
}
type ContactSource = { business?: { name?: string }; page?: { branchName?: string }; sections?: { key?: string; section_key?: string; kind: string; enabled: boolean; content: Record<string, unknown> }[] };
/** Deliberate page bindings only: never pick the first matching provider or another branch. */
export function compileContact(raw: unknown, source: ContactSource): ContactProjection | undefined {
  const config = contactConfigSchema.parse(raw);
  if (!config.enabled) return undefined;
  const sections = source.sections || [];
  const local = sections.find(section => section.kind === "contact" && section.enabled)?.content;
  const displayName = config.nameFromPage ? source.page?.branchName || source.business?.name || "" : config.displayName;
  const primaryPhone = contactPhone(config.phoneFromPage ? String(local?.phone || "") : config.primaryPhone);
  text.parse(displayName);
  if (!displayName.trim()) throw new Error("Display name: enter a name or bind the page name.");
  if (!primaryPhone) throw new Error("Primary phone: enter a valid Egyptian or international number.");
  const fields = config.fields.filter(field => field.enabled).map(field => {
    let value = field.value;
    if (field.binding) {
      const section = sections.find(section => (section.key || section.section_key) === field.binding!.sectionKey && section.enabled && section.kind !== "gallery" && (section.kind !== "payments" || (field.binding!.itemId && field.binding!.property === "url")));
      const item = field.binding.itemId && Array.isArray(section?.content.items) ? section.content.items.find((item: { id?: string; enabled?: boolean; provider?: string; url?: unknown }) => item.id === field.binding!.itemId && item.enabled !== false && contactBindingAllowed(item, field.binding!.property)) : undefined;
      value = String((field.binding.itemId ? item : section?.content)?.[field.binding.property] || "");
    }
    text.parse(value);
    if (!value.trim()) throw new Error(`${field.label || field.kind}: enter a value or repair the page binding.`);
    if (field.kind === "phone") { value = contactPhone(value); if (!value) throw new Error(`${field.label || "Phone"}: invalid number.`); }
    if (field.kind === "email" && (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) throw new Error(`${field.label || "Email"}: invalid email.`);
    if (["website", "social", "whatsapp"].includes(field.kind) && !contactWeb(value)) throw new Error(`${field.label || field.kind}: use a complete safe web URL.`);
    return { kind: field.kind, label: field.label, value };
  });
  const note = fields.filter(field => ["hours", "notes", "custom"].includes(field.kind)).flatMap(field => { const value = contactNote(field.value).text; return value ? [`${field.label || field.kind}: ${value}`] : []; }).join("\n");
  if (note.length > 8000 || bytes(note) > 32768) throw new Error("Combined notes exceed the contact limit.");
  return { version: 1, enabled: true, displayName, organization: config.organization, primaryPhone, fields, showDownloadLink: config.showDownloadLink };
}
