import React from "react";
import type { ContactProjection } from "@/lib/business/contact";
import { ManagedImage } from "./managed-image";
import { DeferredGallery } from "./deferred-gallery";
import type { GalleryViewItem } from "./gallery-view";
import { sectionText } from "@/lib/business/section-text";
import { safeUrl } from "@/lib/business/content";
import { PaymentAction } from "@/components/business/copy-payment";
import { PaymentLogo } from "@/components/business/payment-logo";
import { providerIconPath, deliveryLinkHref, isDeliveryProvider, destinationStrategyFor, getProviderMetadata, isLocalWalletProvider, isMobileWalletProvider, isPaymentProvider, paymentLinkHref, resolveProviderItem, type ProviderProfile } from "@/lib/business/providers";

type Item = { id?: string; subtitle?: string; badge?: string; actions?: Item[]; label?: string; url?: string; value?: string; alt?: string; provider?: string; enabled?: boolean; icon?: string; destinationStrategy?: string; profileOverride?: boolean };
type Section = { key?: string; kind: string; title: string; position: number; enabled: boolean; content: Record<string, unknown> };
export type Snapshot = { business?: { name?: string; category?: string }; contact?: ContactProjection; page?: { slug?: string; branchName?: string; template?: string }; providerProfiles?: Record<string, ProviderProfile>; sections?: Section[]; publicationId?: string; version?: number };

const iconFiles: Record<string, string> = { whatsapp: "whatsapp", facebook: "facebook", instagram: "instagram", tiktok: "tiktok", snapchat: "snapchat", youtube: "youtube", x: "x", twitter: "x", telegram: "telegram", linkedin: "linkedin", talabat: "talabat", fast: "fast", github: "github", behance: "behance", artstation: "artstation", dribbble: "dribbble", medium: "medium", pinterest: "pinterest", messenger: "messenger", google: "google" };
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function validWebUrl(value: unknown) { const source = text(value); if (!safeUrl(source)) return ""; try { return new URL(source).protocol === "https:" ? source : ""; } catch { return ""; } }
function imageUrl(value: unknown) { const source = text(value); return source.startsWith("/") && !source.startsWith("//") ? source : validWebUrl(source); }
function phoneUrl(value: unknown) { const source = text(value); const number = source.replace(/[^\d+]/g, ""); return number.replace(/\D/g, "").length >= 7 ? `tel:${number}` : ""; }
function visibleLabel(item: Item) {
  const label = text(item.label);
  const value = text(item.value);
  const provider = providerFor(item);
  if (!isPaymentProvider(provider)) return label;
  if (/[a-z0-9._-]+@[a-z0-9._-]+/i.test(label) || label.replace(/\D/g, "").length >= 7) return "";
  if (!value) return label;
  const normalized = (input: string) => input.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g, "");
  if (normalized(value) && normalized(label).includes(normalized(value))) return "";
  // A wallet label may use a local number while the saved value uses +20, or add spaces.
  const digits = value.replace(/\D/g, "");
  if (isMobileWalletProvider(provider) && digits.length >= 10 && label.replace(/\D/g, "").includes(digits.slice(-10))) return "";
  return label;
}
function accessibleLabel(item: Item, provider?: string) { return visibleLabel(item) || getProviderMetadata(provider || providerFor(item))?.label || "Payment option"; }
function providerFor(item: Item): string {
  const provider = text(item.provider).toLowerCase();
  if (provider) return provider === "twitter" ? "x" : provider;
  // Preserve legacy social icons using destination identity, never the custom label.
  try {
    const host = new URL(text(item.url)).hostname.toLowerCase().replace(/^www\./, "");
    const domains: Record<string, string> = { "instagram.com": "instagram", "facebook.com": "facebook", "linkedin.com": "linkedin", "tiktok.com": "tiktok", "youtube.com": "youtube", "youtu.be": "youtube", "snapchat.com": "snapchat", "twitter.com": "x", "x.com": "x", "t.me": "telegram", "wa.me": "whatsapp", "whatsapp.com": "whatsapp", "pinterest.com": "pinterest", "messenger.com": "messenger", "github.com": "github", "behance.net": "behance", "artstation.com": "artstation", "dribbble.com": "dribbble", "medium.com": "medium" };
    return Object.entries(domains).find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1] || "custom";
  } catch { return "custom"; }
}
function actionHref(item: Item) { const provider = providerFor(item); const strategy = destinationStrategyFor(provider, item.destinationStrategy, item.url); if (isDeliveryProvider(provider)) return deliveryLinkHref(provider, item.url); if (isPaymentProvider(provider)) return paymentLinkHref(item.url); if (strategy === "copy_identifier" || strategy === "instructions") return ""; if (strategy === "verified_deep_link") return getProviderMetadata(provider)?.verifiedDeepLink ? validWebUrl(item.url) : ""; if (provider === "phone" || provider === "call") return phoneUrl(item.value); if (provider === "email") { const address = text(item.value); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? `mailto:${address}` : ""; } if (provider === "whatsapp" && !validWebUrl(item.url)) { const phone = phoneUrl(item.value).replace(/^tel:/, ""); return phone ? `https://wa.me/${phone.replace(/[^0-9]/g, "")}` : ""; } return validWebUrl(item.url); }
function Icon({ name, size = 22 }: { name: string; size?: number }) {
  if (isLocalWalletProvider(name)) return <PaymentLogo provider={name} />;
  const file = iconFiles[name];
  if (file) return <img src={providerIconPath(file)} alt="" width={size} height={size} decoding="async" />;
  const paths: Record<string, React.ReactNode> = {
    phone: <path d="M6.5 3.8 9.2 3l1.8 4.5-1.9 1.5a13.7 13.7 0 0 0 5.8 5.8l1.5-1.9L21 14.7l-.8 2.7a2.4 2.4 0 0 1-2.7 1.7C10.6 17.9 6.1 13.4 4.9 6.5a2.4 2.4 0 0 1 1.6-2.7Z" />,
    pin: <><path d="M12 21s6-5.8 6-11a6 6 0 1 0-12 0c0 5.2 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.3 2" /></>,
    menu: <><path d="M5 5.5h14v13H5z" /><path d="M8 9h8M8 12h8M8 15h5" /></>,
    order: <><path d="M5 4h14v16H5z" /><path d="M8 2v4M16 2v4M5 9h14" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    arrow: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
    link: <><path d="m10.5 13.5 3-3" /><path d="M7.8 16.2 6 18a3 3 0 0 1-4-4l3.1-3.1a3 3 0 0 1 4.2 0" /><path d="m16.2 7.8 1.8-1.8a3 3 0 0 1 4 4l-3.1 3.1a3 3 0 0 1-4.2 0" /></>,
    globe: <><circle cx="12" r="9" cy="12" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
    email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.link}</svg>;
}
function ExternalLink({ href, children, className = "", ...props }: { href: string; children: React.ReactNode; className?: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) { return <a className={className} href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>; }

// Same-tab navigation lets the OS follow a provider's own mobile app handoff.
function PaymentLink({ href, children, ...props }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={href} rel="noreferrer" {...props}>{children}</a>;
}

function SectionText({ title, content, kind }: { title: string; content: Record<string, unknown>; kind: string }) {
  const eyebrow = sectionText(content, kind, "eyebrow"), description = sectionText(content, kind, "description"), badge = sectionText(content, kind, "badge");
  const heading = <>{text(title) && <h2>{title}</h2>}{description && <p className={`section-intro${kind === "about" ? " about-copy" : ""}`}>{description}</p>}</>;
  return <>{eyebrow && <p className="section-overline">{eyebrow}</p>}{kind === "hours" && (text(title) || description) ? <div className="hours-heading"><span className="hours-icon"><Icon name="clock" size={26}/></span><div>{heading}</div></div> : heading}{badge && <p className="section-badge">{badge}</p>}</>;
}
function ItemText({ item }: { item: Item }) {
  const subtitle = visibleLabel({ ...item, label: item.subtitle }), badge = visibleLabel({ ...item, label: item.badge });
  return <>{subtitle && <span className="item-subtitle">{subtitle}</span>}{badge && <span className="item-badge">{badge}</span>}</>;
}
function PaymentFallback({ items, language }: { items: Item[]; language: "ar" | "en" }) {
  const links = items.filter(item => item.enabled !== false && providerFor(item) === "instapay" && paymentLinkHref(item.url));
  if (!links.length) return null;
  const ar = language === "ar";
  return <details className="payment-link-help"><summary>{ar ? "لم يفتح تطبيق InstaPay؟" : "InstaPay app didn't open?"}</summary><p>{ar ? "إذا ظهرت صفحة رمز QR، استخدم خيارات InstaPay الموجودة بها. على Android، تحقق من تثبيت التطبيق وتفعيل فتح الروابط المتوافقة في إعداداته. يمكنك العودة هنا وإعادة المحاولة أو طلب بيانات الدفع من النشاط." : "If a QR page appears, use the options provided by InstaPay on that page. On Android, check that the app is installed and Open supported links is enabled in its settings. Return here to retry, or ask the business for payment details."}</p>{links.map((item,index)=><p key={item.id || index}><PaymentLink href={paymentLinkHref(item.url)}>{ar ? "فتح InstaPay" : "Open InstaPay"}{links.length > 1 ? ` ${index+1}` : ""}</PaymentLink></p>)}<ExternalLink href="https://www.instapay.eg/?page_id=348&lang=en">{ar ? "مساعدة InstaPay الرسمية" : "Official InstaPay help"}</ExternalLink></details>;
}
function SocialSection({ title, items, content }: { title: string; items: Item[]; content: Record<string, unknown> }) {
  const links = items.filter(item => item.enabled !== false && actionHref(item)); if (!links.length) return null;
  return <section className="business-section social-section"><SectionText title={title} content={content} kind="social"/><div className="social-icon-list social-tile-grid">{links.map((item, index) => { const provider = providerFor(item); const label = accessibleLabel(item, provider); const iconName = iconFiles[provider] || ["email", "phone", "call", "link", "globe"].includes(provider) ? provider : "globe"; return <ExternalLink target={isDeliveryProvider(provider) ? "_self" : "_blank"} href={actionHref(item)} className={`social-tile ${visibleLabel(item) ? "" : "social-tile-icon-only"}`} aria-label={label} key={item.id || index}><span className="social-tile-icon"><Icon name={iconName} size={35}/></span>{visibleLabel(item) && <span>{visibleLabel(item)}</span>}<ItemText item={item}/></ExternalLink>; })}</div></section>;
}

function columnCount(value: unknown) { const columns = Number(value); return Number.isInteger(columns) && columns >= 1 && columns <= 4 ? columns : 4; }

function QuickActions({ items, language, columns = 4, title = "", content = {}, contactCta }: { items: Item[]; language: "ar" | "en"; columns?: number; title?: string; content?: Record<string, unknown>; contactCta?: React.ReactNode }) {
  const actions = items.filter(item => item.enabled !== false).map(item => ({ item, href: actionHref(item) })).filter(({ item, href }) => href || (isPaymentProvider(providerFor(item)) && Boolean(text(item.value))));
  if (!actions.length && !contactCta) return null;
  return <section className="business-section configured-actions-section"><SectionText title={title} content={content} kind="quick_actions"/>{contactCta}<div className="quick-actions quick-actions-configured" style={{ "--action-columns": columns } as React.CSSProperties} aria-label={language === "ar" ? "\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0627\u0644\u0633\u0631\u064a\u0639\u0629" : "Quick actions"}>{actions.map(({ item, href }, index) => { const provider = providerFor(item); const icon = text(item.icon) || (provider === "call" ? "phone" : provider === "location" ? "pin" : provider === "menu" ? "menu" : provider === "booking" ? "calendar" : provider === "reviews" ? "google" : provider); const label=visibleLabel(item); const accessible=accessibleLabel(item, provider); const strategy=destinationStrategyFor(provider, item.destinationStrategy, item.url); const content=<><Icon name={icon} size={28} />{label && <span>{label}</span>}<ItemText item={item}/></>; const Link = (isPaymentProvider(provider) || isDeliveryProvider(provider)) ? PaymentLink : ExternalLink; return href ? <Link href={href} className={`quick-action ${label ? "" : "quick-action-icon-only"}`} aria-label={accessible} key={item.id || index}>{content}</Link> : <PaymentAction provider={provider} value={text(item.value)} accessibleLabel={accessible} mode={strategy === "copy_identifier" ? "copy" : "instructions"} language={language} className={`quick-action quick-action-payment ${label ? "" : "quick-action-icon-only"}`} key={item.id || index}>{content}</PaymentAction>; })}</div>{content.showInstapayHelp !== false && <PaymentFallback items={items} language={language}/>}</section>;
}

function PaymentSection({ title, items, backgroundUrl, backgroundAlt, columns = 4, language, content }: { content: Record<string, unknown>; title: string; items: Item[]; backgroundUrl?: unknown; backgroundAlt?: unknown; columns?: number; language: "ar" | "en" }) {
  const validItems = items.filter(item => item.enabled !== false && (text(item.value) || validWebUrl(item.url))); if (!validItems.length) return null;
  return <section className="business-section payments-section"><ManagedImage src={imageUrl(backgroundUrl) || "/payment-nfc.webp"} alt={text(backgroundAlt)} sizes="(max-width: 560px) 100vw, 560px" className="section-background-photo" /><SectionText title={title} content={content} kind="payments"/><p className="payments-disclaimer">Payment details are provided by the business. NexTap does not process or verify payments.</p><div className="payment-grid" style={{ "--payment-columns": columns } as React.CSSProperties}>{validItems.map((item, index) => { const provider = providerFor(item); const strategy = destinationStrategyFor(provider, item.destinationStrategy, item.url); const href = actionHref(item); const label = visibleLabel(item); const accessible = accessibleLabel(item, provider); const logo = <Icon name={provider} size={30} />; const card = <><span className={`payment-icon payment-icon-${provider}`}>{logo}</span>{label && <strong>{label}</strong>}<ItemText item={item}/></>; const key = item.id || `${provider}-${index}`; return href ? <PaymentLink href={href} className="payment-tile" aria-label={accessible} key={key}>{card}</PaymentLink> : <PaymentAction provider={provider} value={text(item.value)} accessibleLabel={accessible} mode={strategy === "copy_identifier" ? "copy" : "instructions"} language={language} className="payment-tile" key={key}>{card}</PaymentAction>; })}</div>{content.showInstapayHelp !== false && <PaymentFallback items={items} language={language}/>}</section>;
}

function HoursSection({ title, items, content }: { title: string; items: Item[]; content: Record<string, unknown> }) {
  const rows = items.filter(item => item.enabled !== false && (text(item.label) || text(item.value))); if (!rows.length) return null;
  return <section className="business-section hours-section"><SectionText title={title} content={content} kind="hours"/><div className="hours-list">{rows.map((item,index)=><div className="hours-row" key={item.id || index}>{text(item.label) && <span>{item.label}</span>}{text(item.value) && <strong dir="ltr">{item.value}</strong>}</div>)}</div></section>;
}
function GenericItems({ section, language }: { section: Section; language: "ar" | "en" }) {
  const items = (Array.isArray(section.content.items) ? section.content.items as Item[] : []).filter(item=>item.enabled!==false && (text(item.label)||text(item.value)||actionHref(item)||item.actions?.length));
  const description = text(section.content.description), address = text(section.content.address);
  if (section.kind === "about" && !description && !text(section.title)) return null;
  if (section.kind === "contact" && !address && !validWebUrl(section.content.mapsUrl)) return null;
  if (!items.length && !["about","contact"].includes(section.kind)) return null;
  const heading=<SectionText title={section.title} content={section.content} kind={section.kind}/>;
  if (section.kind === "about") return <section className="business-section about-section">{heading}</section>;
  if (section.kind === "contact") { const mapsUrl=validWebUrl(section.content.mapsUrl), mapImage=imageUrl(section.content.mapImageUrl);return <section className="business-section find-section"><div className="find-heading"><div>{heading}{address&&<p>{address}</p>}</div><div className="map-actions">{mapsUrl&&<ExternalLink href={mapsUrl} className="map-link"><Icon name="pin"/>{language==="ar"?"خرائط Google":"Google Maps"}</ExternalLink>}</div></div>{mapImage&&<div className="map-preview"><ManagedImage src={mapImage} alt={text(section.content.mapImageAlt)} sizes="(max-width: 560px) calc(100vw - 40px), 500px"/></div>}</section>; }
  return <section className={`business-section generic-section business-section-${section.kind}`}>{heading}<div className="generic-items">{items.map((item,index)=>{
    const href=actionHref(item), label=visibleLabel(item), row=<>{isDeliveryProvider(providerFor(item)) && <Icon name={providerFor(item)} size={28}/>}{label&&<span className="generic-item-label">{label}</span>}{text(item.value)&&!isPaymentProvider(providerFor(item))&&<span className="generic-item-value">{item.value}</span>}<ItemText item={item}/></>;
    return <div key={item.id || index}>{href?<ExternalLink target={isDeliveryProvider(providerFor(item)) ? "_self" : "_blank"} href={href} className="generic-item" aria-label={accessibleLabel(item)}>{row}<Icon name="arrow" size={18}/></ExternalLink>:(label||text(item.value)||text(item.subtitle)||text(item.badge))?<div className="generic-item">{row}</div>:null}{item.actions?.length ? <QuickActions items={item.actions} language={language}/>:null}</div>;
  })}</div></section>;
}

function galleryItems(section: Section): GalleryViewItem[] {
  return (Array.isArray(section.content.items) ? section.content.items as Item[] : [])
    .filter(item => item.enabled !== false && imageUrl(item.url))
    .map(item => ({ id:item.id, url: imageUrl(item.url), alt: text(item.alt) || text(item.label), label: text(item.label), subtitle:text(item.subtitle), badge:text(item.badge) }));
}
export function PublicSnapshot({ snapshot, contactHref }: { snapshot: Snapshot; contactHref?: string }) {
  const allSections = [...(snapshot.sections || [])].map((section): Section => ({ ...section, content: { ...section.content, ...(Array.isArray(section.content.items) ? { items: ["gallery", "hours"].includes(section.kind) ? section.content.items : (section.content.items as Item[]).map(item => ({...resolveProviderItem(item, snapshot.providerProfiles || {}), ...(item.actions ? {actions:item.actions.map(action=>resolveProviderItem(action,snapshot.providerProfiles || {}))}:{})})) } : {}) } })).map(section => section.content?._editorKind === "quick_actions" && section.kind === "social" ? { ...section, kind: "quick_actions", title: section.title } : section).sort((a, b) => a.position - b.position); const sections = allSections.filter(section => section.enabled); const heroSection = sections.find(section => section.kind === "hero"); const hero = heroSection?.content || {}; const contactSection = sections.find(section => section.kind === "contact"); const contact = contactSection?.content || {}; const name = text(snapshot.business?.name) || text(snapshot.page?.branchName) || "Business";
  const language: "ar" | "en" = hero.language === "ar" || hero.language === "en" ? hero.language : /[\u0600-\u06ff]/.test(name) ? "ar" : "en"; const direction = language === "ar" ? "rtl" : "ltr"; const cover = imageUrl(hero.coverUrl); const logo = imageUrl(hero.logoUrl); const hours = sections.find(section => section.kind === "hours"); const hoursItems = Array.isArray(hours?.content.items) ? hours?.content.items as Item[] : []; const location = typeof hero.location === "string" ? text(hero.location) : text(contact.address); const opening = typeof hero.openingSummary === "string" ? text(hero.openingSummary) : text(hoursItems[0]?.value); const rating = Number(hero.rating); const ratingVerified = hero.ratingVerified === true && Number.isFinite(rating) && rating > 0; const ctaUrl = validWebUrl(hero.ctaUrl);
  const configuredActions = allSections.find(section => section.kind === "quick_actions");
  const contactCta = snapshot.contact?.enabled && snapshot.contact.version === 1 ? <div className="contact-download"><a className="contact-download-button" href={contactHref} aria-disabled={!contactHref || undefined}><span>{language === "ar" ? "\u0625\u0636\u0627\u0641\u0629 \u0625\u0644\u0649 \u062c\u0647\u0627\u062a \u0627\u0644\u0627\u062a\u0635\u0627\u0644" : "Add to Contact"}</span><Icon name="arrow" size={18}/></a>{contactHref && snapshot.contact?.showDownloadLink !== false && <a className="contact-download-fallback" href={`${contactHref}?download=1`} download="business-contact.vcf">{language === "ar" ? "تنزيل ملف جهة الاتصال" : "Download contact file"}</a>}<small className="sr-only">{language === "ar" ? "\u0627\u0641\u062a\u062d \u0627\u0644\u0645\u0644\u0641 \u0648\u0623\u0643\u062f \u0627\u0644\u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0639\u0644\u0649 \u062c\u0647\u0627\u0632\u0643." : "Open the file and confirm import on your device."}</small></div> : undefined; const actions = [{ key: "call", label: language === "ar" ? "Ø§ØªØµÙ„" : "Call", href: phoneUrl(contact.phone), icon: "phone" }, { key: "menu", label: language === "ar" ? "Ø§Ù„Ù‚Ø§Ø¦Ù…Ø©" : "Menu", href: validWebUrl(contact.menuUrl) || validWebUrl(hero.menuUrl), icon: "menu" }, { key: "order", label: language === "ar" ? "Ø§Ø·Ù„Ø¨ Ø§Ù„Ø¢Ù†" : "Order", href: validWebUrl(contact.orderUrl), icon: "order" }, { key: "location", label: language === "ar" ? "Ø§Ù„Ù…ÙˆÙ‚Ø¹" : "Directions", href: validWebUrl(contact.mapsUrl), icon: "pin" }].filter(action => action.href);
  return <main className="public-page premium-public" dir={direction} lang={language}><article className="business-wrap"><section className="business-hero">{cover && <ManagedImage src={cover} alt={text(hero.coverAlt)} sizes="(max-width: 560px) 100vw, 560px" loading="eager" fetchPriority="high" decoding="sync" quality={50} className="hero-photo" />}<div className="hero-overlay" /><div className="hero-content"><div className="business-logo">{logo ? <ManagedImage src={logo} alt={text(hero.logoAlt) || `${name} logo`} sizes="84px" loading="eager" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}</div><h1>{name}</h1>{text(hero.tagline) && <p className="hero-tagline">{text(hero.tagline)}</p>}{text(hero.description) && <p className="hero-description">{text(hero.description)}</p>}<div className="hero-meta">{ratingVerified && Boolean(hero.ratingSource) && <span><span className="meta-star">â˜…</span>{rating.toFixed(1)}</span>}{location && <span><Icon name="pin" size={17} />{location}</span>}{opening && <span><Icon name="clock" size={17} /><bdi dir="ltr">{opening}</bdi></span>}</div>{ctaUrl && text(hero.ctaLabel) && <ExternalLink href={ctaUrl} className="hero-cta">{text(hero.ctaLabel)}<Icon name="arrow" size={19} /></ExternalLink>}</div></section>{configuredActions ? configuredActions.enabled && <QuickActions contactCta={contactCta} title={configuredActions.title} content={configuredActions.content} items={Array.isArray(configuredActions.content.items) ? configuredActions.content.items as Item[] : []} columns={columnCount(configuredActions.content.columns)} language={language} /> : (actions.length > 0 || contactCta) && <section className="business-section configured-actions-section">{contactCta}<div className={`quick-actions quick-actions-${actions.length}`} aria-label={language === "ar" ? "Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª Ø³Ø±ÙŠØ¹Ø©" : "Quick actions"}>{actions.map(action => <ExternalLink href={String(action.href)} className="quick-action" key={action.key}><Icon name={String(action.icon)} size={28} /><span>{String(action.label)}</span></ExternalLink>)}</div></section>}{sections.map(section => { if (section.kind === "hero" || section.kind === "reviews") return null; if(section.kind === "quick_actions") return section === configuredActions ? null : <QuickActions title={section.title} content={section.content} items={Array.isArray(section.content.items)?section.content.items as Item[]:[]} columns={columnCount(section.content.columns)} language={language} key={section.key || section.kind}/>; if (section.kind === "social") return <SocialSection content={section.content} title={section.title} items={Array.isArray(section.content.items) ? section.content.items as Item[] : []} key={section.key || section.kind} />; if (section.kind === "payments") return <PaymentSection content={section.content} language={language} title={section.title} columns={columnCount(section.content.columns)} backgroundUrl={section.content.backgroundUrl} backgroundAlt={section.content.backgroundAlt} items={Array.isArray(section.content.items) ? section.content.items as Item[] : []} key={section.key || section.kind} />; if (section.kind === "gallery") { const items = galleryItems(section); return items.length ? <DeferredGallery title={section.title} content={section.content} items={items} key={section.key || section.kind} /> : null; } if (section.kind === "hours") return <HoursSection title={section.title} items={Array.isArray(section.content.items)?section.content.items as Item[]:[]} content={section.content} key={section.key || section.kind} />; return <GenericItems section={section} language={language} key={section.key || section.kind} />; })}<footer className="powered-footer"><span />Powered by <strong>NexTap</strong></footer></article></main>;
}
