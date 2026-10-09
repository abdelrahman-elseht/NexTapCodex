import { safeUrl } from "./content";

export type ProviderId = "whatsapp"|"facebook"|"instagram"|"tiktok"|"youtube"|"snapchat"|"x"|"website"|"maps"|"reviews"|"instapay"|"vodafone"|"phone"|"email"|"menu"|"custom"|"bank";

export function normalizeEgyptianPhone(value: string) {
  const raw = value.trim().replace(/[\s().-]/g, "");
  if (/^01\d{9}$/.test(raw)) return `+20${raw.slice(1)}`;
  if (/^201\d{9}$/.test(raw)) return `+${raw}`;
  if (/^\+201\d{9}$/.test(raw)) return raw;
  return "";
}
export function phoneHref(value: string) { const phone = normalizeEgyptianPhone(value); return phone ? `tel:${phone}` : ""; }
export function whatsappHref(value: string) { const phone = normalizeEgyptianPhone(value); return phone ? `https://wa.me/${phone.slice(1)}` : ""; }
export function normalizeInstagram(value: string) {
  const input = value.trim(); if (!input) return "";
  if (/^https:\/\/(www\.)?instagram\.com\//i.test(input)) return input;
  const handle = input.replace(/^@/, ""); return /^[a-z0-9._]{1,30}$/i.test(handle) ? `https://instagram.com/${handle}` : "";
}
export function normalizeSafeUrl(value: string) { const input = value.trim(); return safeUrl(input) && /^https?:$/i.test(new URL(input).protocol) ? input : ""; }
export function normalizeProviderValue(provider: ProviderId, value: string) {
  if (provider === "whatsapp" || provider === "vodafone" || provider === "phone") return normalizeEgyptianPhone(value);
  if (provider === "instagram") return normalizeInstagram(value);
  if (provider === "instapay") return /^[a-z0-9._-]{2,64}@[a-z0-9._-]{2,64}$/i.test(value.trim()) ? value.trim() : "";
  if (provider === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? value.trim() : "";
  if (["facebook","tiktok","youtube","snapchat","x","website","maps","reviews","menu","custom"].includes(provider)) return normalizeSafeUrl(value);
  return value.trim().slice(0, 500);
}
export const providerLabels: Record<ProviderId,string> = { whatsapp:"WhatsApp", facebook:"Facebook", instagram:"Instagram", tiktok:"TikTok", youtube:"YouTube", snapchat:"Snapchat", x:"X", website:"Website", maps:"Google Maps", reviews:"Google Reviews", instapay:"InstaPay", vodafone:"Vodafone Cash", phone:"Phone", email:"Email", menu:"Menu", custom:"Custom URL", bank:"Bank instructions" };
