"use client";
import { imageEditSchema } from "@/lib/media/image-edit";

import { ImageField, type UploadTracker } from "./image-field";
import type { ReactNode } from "react";
import { PaymentLogo } from "@/components/business/payment-logo";
import { providerIconPath, deliveryLinkHref, isDeliveryProvider, isLocalWalletProvider, isMobileWalletProvider, isPaymentProvider, paymentLinkHref, normalizeEgyptianPhone, normalizeInstagram, normalizeProviderValue, normalizeSafeUrl, providerLabels, type ProviderId, whatsappHref } from "@/lib/business/providers";

import { duplicateEditorItem, createEditorItem, type EditorItem } from "@/lib/business/editor-items";
export type { EditorItem } from "@/lib/business/editor-items";
type Section = { id: string; kind: string };

const valueLabels: Partial<Record<ProviderId, string>> = {
  call: "Phone number", phone: "Phone number", whatsapp: "WhatsApp number",
  instapay: "InstaPay ID", vodafone: "Vodafone Cash number", etisalat: "Etisalat Cash number", orange: "Orange Cash number", bank: "Payment instructions",
  email: "Email address", instagram: "Instagram handle or URL",
};
const valueProviders = new Set<ProviderId>(["call", "phone", "whatsapp", "instapay", "vodafone", "etisalat", "orange", "bank", "email", "instagram"]);
const brandIcons = new Set(["whatsapp", "facebook", "instagram", "tiktok", "youtube", "snapchat", "x", "linkedin", "telegram", "instapay", "vodafone", "github", "behance", "artstation", "dribbble", "medium", "talabat", "fast"]);

function providerIcon(provider: ProviderId): ReactNode {
  if (isLocalWalletProvider(provider)) return <PaymentLogo provider={provider} />;
  if (brandIcons.has(provider)) return <img src={providerIconPath(provider)} alt="" width={24} height={24} />;
  const paths: Record<string, ReactNode> = {
    call: <path d="M6 3.8 9 3l2 4.5-2.1 1.7a13 13 0 0 0 5.9 5.9l1.7-2.1 4.5 2-.8 3a2.3 2.3 0 0 1-2.6 1.7C10 18.8 5.2 14 4.3 6.4A2.3 2.3 0 0 1 6 3.8Z" />,
    maps: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    reviews: <path d="m12 3 2.7 5.6 6.2.9-4.5 4.4 1.1 6.2-5.5-2.9-5.5 2.9 1.1-6.2-4.5-4.4 6.2-.9L12 3Z" />,
    email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    menu: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    booking: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4m8-4v4M4 10h16m-12 4h2m3 0h2m-7 3h2" /></>,
    link: <path d="m10 13 4-4m-6 7H6a4 4 0 0 1 0-8h4m4 0h4a4 4 0 0 1 0 8h-4" />,
  };
  const name = provider === "location" || provider === "maps" ? "maps"
    : provider === "reviews" ? "reviews"
    : provider === "call" || provider === "phone" ? "call"
    : provider === "email" ? "email"
    : provider === "menu" ? "menu"
    : provider === "booking" ? "booking" : "link";
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function itemValidationError(item: EditorItem) {
  const provider = item.provider as ProviderId | undefined;
  if ((["whatsapp", "phone", "call"].includes(provider || "") || isMobileWalletProvider(provider)) && item.value.trim() && !normalizeEgyptianPhone(item.value)) return "Use a valid Egyptian mobile number, such as 01012345678.";
  if (provider === "instagram" && item.value.trim() && !normalizeInstagram(item.value)) return "Use an Instagram handle or https://instagram.com/ URL.";
  if (provider === "instapay" && item.value.trim() && !normalizeProviderValue("instapay", item.value)) return "Use an InstaPay IPA such as name@instapay.";
  if (provider === "email" && item.value.trim() && !normalizeProviderValue("email", item.value)) return "Use a valid email address.";
  if (item.url.trim() && !(isDeliveryProvider(provider) ? deliveryLinkHref(provider, item.url) : isPaymentProvider(provider) ? paymentLinkHref(item.url) : normalizeSafeUrl(item.url.trim()))) return "Use a complete https:// destination URL.";
  return "";
}

export function ItemEditor({ section, items, onChange, onSaveDetails, businessId, track, mutationLocked = false }: { section: Section; items: EditorItem[]; onChange: (items: EditorItem[]) => void; onSaveDetails?: (item: EditorItem) => void; businessId?: string; track?: UploadTracker; mutationLocked?: boolean }) {
  const set = (id: string, patch: Partial<EditorItem>) => onChange(items.map(item => item.id === id ? { ...item, ...patch, ...(("value" in patch || "url" in patch || "destinationStrategy" in patch) ? { profileOverride: true } : {}) } : item));
  const move = (id: string, offset: number) => {
    const index = items.findIndex(item => item.id === id);
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  };
  const add = () => { if (items.length < 100) onChange([...items, createEditorItem(section.kind === "hours" || section.kind === "gallery" ? undefined : "custom")]); };

  return <div className="live-items-editor">
    <div className="live-items-heading"><strong>{section.kind === "hours" ? "Weekly schedule" : "Entries"}</strong><button type="button" className="small-button" disabled={items.length >= 100 || mutationLocked} onClick={add}>+ Add</button></div>
    {items.map((item, index) => {
      const provider = (item.provider || "custom") as ProviderId;
      const isAction = section.kind === "quick_actions";
      const isSocial = section.kind === "social";
      const isPayment = section.kind === "payments";
      const isHours = section.kind === "hours";
      const needsValue = isHours || valueProviders.has(provider);
      const optionalUrl = !isHours && (isPayment || (isAction && (["whatsapp", "bank"].includes(provider) || isLocalWalletProvider(provider))) || (isSocial && provider === "whatsapp"));
      const needsUrl = !isHours && (!needsValue || optionalUrl);
      const valueLabel = isHours ? "Hours" : valueLabels[provider] || "Details";
      const valuePlaceholder = provider === "call" || provider === "phone" || provider === "whatsapp" || isMobileWalletProvider(provider) ? "01012345678"
        : provider === "instapay" ? "name@instapay"
        : provider === "instagram" ? "@yourbusiness"
        : provider === "email" ? "name@example.com"
        : provider === "bank" ? "Account or payment instructions"
        : isHours ? "9:00 AM – 5:00 PM" : "Details";
      const urlPlaceholder = provider === "reviews" ? "https://g.page/r/…/review" : "https://";
      return <div className="live-item-row" key={item.id} data-item-id={item.id}>
        <span className="item-drag" aria-hidden="true">:::</span>
        <div className="live-item-fields">
          {(isAction || isSocial || isPayment || isDeliveryProvider(provider)) && <span className={`provider-inline-icon provider-${provider}`}>{providerIcon(provider)}</span>}
          {provider === "fast" && <p className="field-hint">Paste the public Fast page or share URL for this business or restaurant. Open it to check the business identity before publishing.</p>}
          {isAction && <label className="field">Provider<select aria-label="Action provider" value={provider} onChange={event => set(item.id, { provider: event.target.value, icon: undefined, url: "", value: "", profileOverride: true })}>{Object.entries(providerLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
          <label className="field"><span>{isAction ? "Button label" : "Label"}</span><input id={`item-${section.id}-${item.id}-label`} name={`${section.id}.${item.id}.label`} value={item.label} placeholder={isHours ? "Day or period" : providerLabels[provider]} onChange={event => set(item.id, { label: event.target.value })} /></label>
          {needsValue && <label className="field"><span>{valueLabel}</span><input name={`${section.id}.${item.id}.value`} type={isMobileWalletProvider(provider) ? "text" : undefined} dir={provider === "bank" ? "auto" : "ltr"} inputMode={provider === "call" || provider === "phone" || provider === "whatsapp" || isMobileWalletProvider(provider) ? "tel" : undefined} autoComplete="off" value={item.value} placeholder={valuePlaceholder} onChange={event => {
            const value = event.target.value;
            const patch: Partial<EditorItem> = { value };
            if (provider === "instagram") patch.url = normalizeInstagram(value);
            if (provider === "whatsapp") patch.url = item.url && item.url !== whatsappHref(item.value) ? item.url : whatsappHref(value);
            set(item.id, patch);
          }} />{!isHours && <small className="field-hint">{provider === "bank" ? "These instructions stay available to your team. Visitors request transfer details directly from the business." : isLocalWalletProvider(provider) ? "Optional fallback details. Add a provider link to open the payment destination directly." : `This destination stays tied to ${providerLabels[provider]} if you change the button label.`}</small>}</label>}
          {section.kind === "gallery" && businessId && track && <ImageField businessId={businessId} label={`Gallery image ${index + 1}`} value={item.url} alt={item.alt || ""} onChange={url => set(item.id, { url, imageEdit: undefined })} imageEdit={imageEditSchema.safeParse(item.imageEdit).data} onEdited={(url,imageEdit) => set(item.id, { url, imageEdit })} onAltChange={alt => set(item.id, { alt })} track={track} />}
          {needsUrl && section.kind !== "gallery" && <label className="field"><span>{optionalUrl ? "Provider link (optional)" : isAction || isSocial ? "Destination URL" : "URL"}</span><input id={`item-${section.id}-${item.id}-url`} name={`${section.id}.${item.id}.url`} dir="ltr" inputMode="url" autoCapitalize="none" spellCheck={false} value={item.url} placeholder={urlPlaceholder} onChange={event => set(item.id, { url: event.target.value })} /><small className="field-hint">{isPaymentProvider(provider) ? "Paste the complete HTTPS payment link from your provider. Tapping the card opens that exact link; app opening depends on the provider and the phone. No details are copied when a link is set." : optionalUrl ? "Use only a verified link supplied by the provider. Without one, visitors can copy the saved details." : "Add the complete destination supplied by the business. No URL is inferred."}</small></label>}
          {provider !== "custom" && !isHours && <label className="field"><span>Destination source</span><select value={item.profileOverride ? "override" : "default"} onChange={event => set(item.id, { profileOverride: event.target.value === "override" })}><option value="default">Use saved details</option><option value="override">Custom value</option></select><small>{item.profileOverride ? "Only this item changes." : "Uses saved business details. Editing creates a custom value for this item."}</small></label>}
          {onSaveDetails && provider !== "custom" && !isHours && section.kind !== "gallery" && <button type="button" className="small-button" onClick={() => onSaveDetails(item)}>Save these details as business default</button>}
          {!isHours && <details className="item-optional-text"><summary>Optional item text</summary><label className="field">Item subtitle<input name={`${section.id}.${item.id}.subtitle`} value={item.subtitle || ""} maxLength={500} onChange={event => set(item.id,{subtitle:event.target.value})}/></label><label className="field">Item badge<input name={`${section.id}.${item.id}.badge`} value={item.badge || ""} maxLength={80} onChange={event => set(item.id,{badge:event.target.value})}/></label></details>}
          {section.kind === "services" && <><label className="field">Service description<textarea value={item.value} maxLength={500} onChange={event => set(item.id,{value:event.target.value})}/></label><details><summary>Service buttons</summary><ItemEditor section={{id:`${section.id}-${item.id}`,kind:"quick_actions"}} items={item.actions || []} onChange={actions=>set(item.id,{actions})} mutationLocked={mutationLocked} onSaveDetails={onSaveDetails}/></details></>}

          {(isAction || isPayment) && <label className="field"><span>Button icon</span><select value={item.icon || ""} onChange={event => set(item.id, { icon: event.target.value || undefined })}><option value="">Provider icon</option><option value="link">Link</option><option value="phone">Phone</option><option value="pin">Location pin</option><option value="menu">Menu</option><option value="calendar">Calendar</option><option value="google">Google</option><option value="globe">Website</option></select></label>}
          {itemValidationError(item) && <small className="field-error" role="alert">{itemValidationError(item)}</small>}
        </div>
        <label className="item-enabled"><input type="checkbox" checked={item.enabled !== false} onChange={event => set(item.id, { enabled: event.target.checked })} /> on</label>
        <button type="button" className="small-button" disabled={mutationLocked || items.length >= 100} onClick={() => onChange([...items, duplicateEditorItem(item)])}>Duplicate item</button>
        <div className="item-reorder"><button type="button" onClick={() => move(item.id, -1)} disabled={index === 0 || mutationLocked} aria-label={`Move item ${index + 1} up`}>↑</button><button type="button" onClick={() => move(item.id, 1)} disabled={index === items.length - 1 || mutationLocked} aria-label={`Move item ${index + 1} down`}>↓</button></div>
        <button type="button" className="small-button danger" disabled={mutationLocked} onClick={() => onChange(items.filter(entry => entry.id !== item.id))} aria-label={`Remove item ${index + 1}`}>×</button>
      </div>;
    })}
  </div>;
}
