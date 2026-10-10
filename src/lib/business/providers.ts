import { safeUrl } from "./content";

export type ProviderId = "whatsapp"|"facebook"|"instagram"|"tiktok"|"youtube"|"snapchat"|"x"|"linkedin"|"telegram"|"website"|"maps"|"reviews"|"booking"|"order"|"location"|"call"|"instapay"|"vodafone"|"phone"|"email"|"menu"|"custom"|"bank";

export type DestinationStrategy = "verified_deep_link" | "external_url" | "copy_identifier" | "instructions";
export type ProviderValueKind = "url" | "phone" | "email" | "identifier" | "instructions" | "none";
export type ProviderMetadata = {
  id: ProviderId;
  label: string;
  icon: string;
  valueKind: ProviderValueKind;
  sensitive: boolean;
  defaultDestinationStrategy: DestinationStrategy;
  verifiedDeepLink: boolean;
  officialHelpUrl?: string;
};

export const providerMetadata: Record<ProviderId, ProviderMetadata> = {
  whatsapp: { id: "whatsapp", label: "WhatsApp", icon: "whatsapp", valueKind: "phone", sensitive: true, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  facebook: { id: "facebook", label: "Facebook", icon: "facebook", valueKind: "url", sensitive: false, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  instagram: { id: "instagram", label: "Instagram", icon: "instagram", valueKind: "url", sensitive: false, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  tiktok: { id: "tiktok", label: "TikTok", icon: "tiktok", valueKind: "url", sensitive: false, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  youtube: { id: "youtube", label: "YouTube", icon: "youtube", valueKind: "url", sensitive: false, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  snapchat: { id: "snapchat", label: "Snapchat", icon: "snapchat", valueKind: "url", sensitive: false, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  x: { id: "x", label: "X", icon: "x", valueKind: "url", sensitive: false, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  linkedin: { id: "linkedin", label: "LinkedIn", icon: "linkedin", valueKind: "url", sensitive: false, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  telegram: { id: "telegram", label: "Telegram", icon: "telegram", valueKind: "url", sensitive: false, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  website: { id: "website", label: "Website", icon: "globe", valueKind: "url", sensitive: false, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  maps: { id: "maps", label: "Google Maps", icon: "pin", valueKind: "url", sensitive: false, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  reviews: { id: "reviews", label: "Google Reviews", icon: "google", valueKind: "url", sensitive: false, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  booking: { id: "booking", label: "Booking", icon: "calendar", valueKind: "url", sensitive: false, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  order: { id: "order", label: "Order", icon: "link", valueKind: "url", sensitive: false, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  location: { id: "location", label: "Location", icon: "pin", valueKind: "url", sensitive: false, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  call: { id: "call", label: "Call", icon: "phone", valueKind: "phone", sensitive: true, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  instapay: { id: "instapay", label: "InstaPay", icon: "instapay", valueKind: "identifier", sensitive: true, defaultDestinationStrategy: "copy_identifier", verifiedDeepLink: false, officialHelpUrl: "https://www.instapay.eg/?page_id=348&lang=en" },
  vodafone: { id: "vodafone", label: "Vodafone Cash", icon: "vodafone", valueKind: "phone", sensitive: true, defaultDestinationStrategy: "copy_identifier", verifiedDeepLink: false, officialHelpUrl: "https://web.vodafone.com.eg/en/money-transfer" },
  phone: { id: "phone", label: "Phone", icon: "phone", valueKind: "phone", sensitive: true, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  email: { id: "email", label: "Email", icon: "link", valueKind: "email", sensitive: true, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  menu: { id: "menu", label: "Menu", icon: "link", valueKind: "url", sensitive: false, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  custom: { id: "custom", label: "Custom URL", icon: "link", valueKind: "url", sensitive: false, defaultDestinationStrategy: "external_url", verifiedDeepLink: false },
  bank: { id: "bank", label: "Bank instructions", icon: "link", valueKind: "instructions", sensitive: true, defaultDestinationStrategy: "instructions", verifiedDeepLink: false },
};

export type ProviderProfile = Pick<ProviderMetadata, "id"> & {
  value?: string;
  url?: string;
  destinationStrategy?: DestinationStrategy;
};

export type ProviderItemLike = {
  provider?: string;
  value?: string;
  url?: string;
  destinationStrategy?: string;
  profileOverride?: boolean;
};

export function buildProviderProfiles(items: ProviderItemLike[]): Record<string, ProviderProfile> {
  const profiles: Record<string, ProviderProfile> = {};
  for (const item of items) {
    const provider = item.provider;
    if (!provider || profiles[provider] || item.profileOverride) continue;
    if (!String(item.value || "").trim() && !String(item.url || "").trim()) continue;
    profiles[provider] = {
      id: provider as ProviderId,
      value: String(item.value || "").trim() || undefined,
      url: String(item.url || "").trim() || undefined,
      destinationStrategy: destinationStrategyFor(provider, item.destinationStrategy, item.url),
    };
  }
  return profiles;
}

export function resolveProviderItem<T extends ProviderItemLike>(item: T, profiles: Record<string, ProviderProfile>): T {
  if (!item.provider || item.profileOverride) return item;
  const profile = profiles[item.provider];
  if (!profile) return item;
  return {
    ...item,
    value: profile.value ?? item.value ?? "",
    url: profile.url ?? item.url ?? "",
    destinationStrategy: profile.destinationStrategy ?? item.destinationStrategy,
  };
}

export function getProviderMetadata(provider: string | undefined): ProviderMetadata | undefined {
  return provider && provider in providerMetadata ? providerMetadata[provider as ProviderId] : undefined;
}

export function isPaymentProvider(provider: string | undefined) {
  return provider === "instapay" || provider === "vodafone" || provider === "bank";
}

// Open the complete link supplied by the owner. Never construct recipient links
// or label an owner-supplied URL as a provider-verified deep-link contract.
export function paymentLinkHref(value: string | undefined) {
  const input = value?.trim() || "";
  if (!safeUrl(input) || /[\u0000-\u001f\u007f]/.test(input)) return "";
  const url = new URL(input);
  return url.protocol === "https:" && !url.username && !url.password ? input : "";
}

export function destinationStrategyFor(provider: string | undefined, strategy?: string, url?: string): DestinationStrategy {
  const metadata = getProviderMetadata(provider);
  if (isPaymentProvider(provider) && paymentLinkHref(url)) return "external_url";
  if (strategy === "external_url" || strategy === "copy_identifier" || strategy === "instructions") return strategy;
  if (strategy === "verified_deep_link" && metadata?.verifiedDeepLink) return strategy;
  return metadata?.defaultDestinationStrategy || "external_url";
}

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
  if (["facebook","tiktok","youtube","snapchat","x","linkedin","telegram","website","maps","reviews","booking","order","location","menu","custom"].includes(provider)) return normalizeSafeUrl(value);
  return value.trim().slice(0, 500);
}
export const providerLabels: Record<ProviderId,string> = { whatsapp:"WhatsApp", facebook:"Facebook", instagram:"Instagram", tiktok:"TikTok", youtube:"YouTube", snapchat:"Snapchat", x:"X", linkedin:"LinkedIn", telegram:"Telegram", website:"Website", maps:"Google Maps", reviews:"Google Reviews", booking:"Booking", order:"Order", location:"Location", call:"Call", instapay:"InstaPay", vodafone:"Vodafone Cash", phone:"Phone", email:"Email", menu:"Menu", custom:"Custom URL", bank:"Bank instructions" };
