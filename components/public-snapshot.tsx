import React from "react";
import { safeUrl } from "@/lib/content";
import { PaymentAction } from "@/components/copy-payment";
import { PaymentLogo } from "@/components/payment-logo";
import { destinationStrategyFor, getProviderMetadata, isPaymentProvider, paymentLinkHref, resolveProviderItem, type ProviderProfile } from "@/lib/providers";

type Item = { label?: string; url?: string; value?: string; provider?: string; enabled?: boolean; icon?: string; destinationStrategy?: string; profileOverride?: boolean };
type Section = { key?: string; kind: string; title: string; position: number; enabled: boolean; content: Record<string, unknown> };
type Snapshot = { business?: { name?: string; category?: string }; page?: { branchName?: string; template?: string }; providerProfiles?: Record<string, ProviderProfile>; sections?: Section[] };

const iconFiles: Record<string, string> = { whatsapp: "whatsapp", facebook: "facebook", instagram: "instagram", tiktok: "tiktok", snapchat: "snapchat", youtube: "youtube", x: "x", twitter: "x", telegram: "telegram", linkedin: "linkedin", pinterest: "pinterest", messenger: "messenger", google: "google" };
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function validWebUrl(value: unknown) { const source = text(value); if (!safeUrl(source)) return ""; try { return new URL(source).protocol === "https:" ? source : ""; } catch { return ""; } }
function imageUrl(value: unknown) { const source = text(value); return source.startsWith("/") && !source.startsWith("//") ? source : validWebUrl(source); }
function phoneUrl(value: unknown) { const source = text(value); const number = source.replace(/[^\d+]/g, ""); return number.replace(/\D/g, "").length >= 7 ? `tel:${number}` : ""; }
function labelFor(item: Item, fallback = "Link") { return text(item.label) || fallback; }
function visibleLabel(item: Item) {
  const label = text(item.label);
  const value = text(item.value);
  const provider = providerFor(item);
  if (!["instapay", "vodafone", "bank"].includes(provider) || !value) return label;
  const normalized = (input: string) => input.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g, "");
  if (normalized(value) && normalized(label).includes(normalized(value))) return "";
  // A wallet label may use a local number while the saved value uses +20, or add spaces.
  const digits = value.replace(/\D/g, "");
  if (provider === "vodafone" && digits.length >= 10 && label.replace(/\D/g, "").includes(digits.slice(-10))) return "";
  return label;
}
function accessibleLabel(item: Item, provider?: string) { return visibleLabel(item) || getProviderMetadata(provider || providerFor(item))?.label || "Payment option"; }
function providerFor(item: Item): string {
  const provider = text(item.provider).toLowerCase();
  if (provider) return provider === "twitter" ? "x" : provider;
  // Preserve legacy social icons using destination identity, never the custom label.
  try {
    const host = new URL(text(item.url)).hostname.toLowerCase().replace(/^www\./, "");
    const domains: Record<string, string> = { "instagram.com": "instagram", "facebook.com": "facebook", "linkedin.com": "linkedin", "tiktok.com": "tiktok", "youtube.com": "youtube", "youtu.be": "youtube", "snapchat.com": "snapchat", "twitter.com": "x", "x.com": "x", "t.me": "telegram", "wa.me": "whatsapp", "whatsapp.com": "whatsapp", "pinterest.com": "pinterest", "messenger.com": "messenger" };
    return Object.entries(domains).find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1] || "custom";
  } catch { return "custom"; }
}
function actionHref(item: Item) { const provider = providerFor(item); const strategy = destinationStrategyFor(provider, item.destinationStrategy, item.url); if (isPaymentProvider(provider)) return paymentLinkHref(item.url); if (strategy === "copy_identifier" || strategy === "instructions") return ""; if (strategy === "verified_deep_link") return getProviderMetadata(provider)?.verifiedDeepLink ? validWebUrl(item.url) : ""; if (provider === "phone" || provider === "call") return phoneUrl(item.value); if (provider === "email") { const address = text(item.value); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? `mailto:${address}` : ""; } if (provider === "whatsapp" && !validWebUrl(item.url)) { const phone = phoneUrl(item.value).replace(/^tel:/, ""); return phone ? `https://wa.me/${phone.replace(/[^0-9]/g, "")}` : ""; } return validWebUrl(item.url); }
function Icon({ name, size = 22 }: { name: string; size?: number }) {
  if (name === "instapay" || name === "vodafone") return <PaymentLogo provider={name} />;
  const file = iconFiles[name];
  if (file) return <img src={`/icons/social/${file}.svg`} alt="" width={size} height={size} loading="lazy" />;
  const paths: Record<string, React.ReactNode> = {
    phone: <path d="M6.5 3.8 9.2 3l1.8 4.5-1.9 1.5a13.7 13.7 0 0 0 5.8 5.8l1.5-1.9L21 14.7l-.8 2.7a2.4 2.4 0 0 1-2.7 1.7C10.6 17.9 6.1 13.4 4.9 6.5a2.4 2.4 0 0 1 1.6-2.7Z" />,
    pin: <><path d="M12 21s6-5.8 6-11a6 6 0 1 0-12 0c0 5.2 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.3 2" /></>,
    menu: <><path d="M5 5.5h14v13H5z" /><path d="M8 9h8M8 12h8M8 15h5" /></>,
    order: <><path d="M5 4h14v16H5z" /><path d="M8 2v4M16 2v4M5 9h14" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    arrow: <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
    link: <><path d="m10.5 13.5 3-3" /><path d="M7.8 16.2 6 18a3 3 0 0 1-4-4l3.1-3.1a3 3 0 0 1 4.2 0" /><path d="m16.2 7.8 1.8-1.8a3 3 0 0 1 4 4l-3.1 3.1a3 3 0 0 1-4.2 0" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.link}</svg>;
}
function ExternalLink({ href, children, className = "", ...props }: { href: string; children: React.ReactNode; className?: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) { return <a className={className} href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>; }

// Same-tab navigation lets the OS follow a provider's own mobile app handoff.
function PaymentLink({ href, children, ...props }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={href} rel="noreferrer" {...props}>{children}</a>;
}

function SocialSection({ title, items }: { title: string; items: Item[] }) {
  const links = items.filter(item => item.enabled !== false && validWebUrl(item.url)); if (!links.length) return null;
  return <section className="business-section social-section"><p className="section-overline">STAY CONNECTED</p><h2>{title || "Social & Community"}</h2><p className="section-intro">Follow us for updates, offers and more.</p><div className="social-icon-list social-tile-grid">{links.map((item, index) => { const provider = providerFor(item); const label = accessibleLabel(item, provider); return <ExternalLink href={validWebUrl(item.url)} className={`social-tile ${visibleLabel(item) ? "" : "social-tile-icon-only"}`} aria-label={label} key={`${item.url}-${index}`}><span className="social-tile-icon">{iconFiles[provider] ? <Icon name={provider} size={35} /> : <Icon name="globe" size={35} />}</span>{visibleLabel(item) && <span>{visibleLabel(item)}</span>}</ExternalLink>; })}</div></section>;
}

function columnCount(value: unknown) { const columns = Number(value); return Number.isInteger(columns) && columns >= 1 && columns <= 4 ? columns : 4; }

function QuickActions({ items, language, columns = 4 }: { items: Item[]; language: "ar" | "en"; columns?: number }) {
  const actions = items.filter(item => item.enabled !== false).map(item => ({ item, href: actionHref(item) })).filter(({ item, href }) => href || (["instapay", "vodafone", "bank"].includes(providerFor(item)) && Boolean(text(item.value)))).slice(0, 20);
  if (!actions.length) return null;
  return <section className="quick-actions quick-actions-configured" style={{ "--action-columns": columns } as React.CSSProperties} aria-label={language === "ar" ? "\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0627\u0644\u0633\u0631\u064a\u0639\u0629" : "Quick actions"}>{actions.map(({ item, href }, index) => { const provider = providerFor(item); const icon = text(item.icon) || (provider === "call" ? "phone" : provider === "location" ? "pin" : provider === "menu" ? "menu" : provider === "booking" ? "calendar" : provider === "reviews" ? "google" : provider); const label=visibleLabel(item); const accessible=accessibleLabel(item, provider); const strategy=destinationStrategyFor(provider, item.destinationStrategy, item.url); const content=<><Icon name={icon} size={28} />{label && <span>{label}</span>}</>; const Link = isPaymentProvider(provider) ? PaymentLink : ExternalLink; return href ? <Link href={href} className={`quick-action ${label ? "" : "quick-action-icon-only"}`} aria-label={accessible} key={`${item.provider || item.label}-${index}`}>{content}</Link> : <PaymentAction provider={provider} value={text(item.value)} accessibleLabel={accessible} mode={strategy === "copy_identifier" ? "copy" : "instructions"} language={language} className={`quick-action quick-action-payment ${label ? "" : "quick-action-icon-only"}`} key={`${item.provider || item.label}-${index}`}>{content}</PaymentAction>; })}</section>;
}

function PaymentSection({ title, items, backgroundUrl, columns = 4, language }: { title: string; items: Item[]; backgroundUrl?: unknown; columns?: number; language: "ar" | "en" }) {
  const validItems = items.filter(item => item.enabled !== false && (text(item.value) || validWebUrl(item.url))); if (!validItems.length) return null;
  return <section className="business-section payments-section" style={{ "--payment-photo": `url("${imageUrl(backgroundUrl) || "/payment-nfc.webp"}")` } as React.CSSProperties}><p className="section-overline">PAY YOUR WAY</p><h2>{title || "Easy & Secure Payments"}</h2><p className="section-intro">Choose an option provided by the business.</p><p className="payments-disclaimer">Payment details are provided by the business. NexTap does not process or verify payments.</p><div className="payment-grid" style={{ "--payment-columns": columns } as React.CSSProperties}>{validItems.map((item, index) => { const provider = providerFor(item); const strategy = destinationStrategyFor(provider, item.destinationStrategy, item.url); const href = actionHref(item); const label = visibleLabel(item); const accessible = accessibleLabel(item, provider); const logo = provider === "instapay" || provider === "vodafone" ? <PaymentLogo provider={provider} /> : provider === "google" ? <Icon name="google" size={30} /> : <Icon name="link" size={28} />; const card = <><span className={`payment-icon payment-icon-${provider}`}>{logo}</span>{label && <strong>{label}</strong>}</>; const key = `${provider}-${index}`; return href ? <PaymentLink href={href} className="payment-tile" aria-label={accessible} key={key}>{card}</PaymentLink> : <PaymentAction provider={provider} value={text(item.value)} accessibleLabel={accessible} mode={strategy === "copy_identifier" ? "copy" : "instructions"} language={language} className="payment-tile" key={key}>{card}</PaymentAction>; })}</div></section>;
}

function ReviewPrompt({ title, content, language }: { title: string; content: Record<string, unknown>; language: "ar" | "en" }) {
  const url = validWebUrl(content.url); if (!url) return null; const label = language === "ar" ? "Ø§ÙƒØªØ¨ ØªÙ‚ÙŠÙŠÙ…Ù‹Ø§ Ø¹Ù„Ù‰ Google Reviews" : "Review us on Google";
  return <section className="business-section reviews-section"><p className="section-overline">GOOGLE REVIEWS</p><div className="review-heading"><div><h2>{title || (language === "ar" ? "Ø±Ø£ÙŠÙƒ ÙŠÙ‡Ù…Ù†Ø§" : "Loved by our customers")}</h2><p>{language === "ar" ? "ÙŠØ³Ø§Ø¹Ø¯Ù†Ø§ Ø±Ø£ÙŠÙƒ Ø¹Ù„Ù‰ ØªÙ‚Ø¯ÙŠÙ… ØªØ¬Ø±Ø¨Ø© Ø£ÙØ¶Ù„." : "Your feedback helps us grow and serve you better."}</p></div><span className="review-badge"><Icon name="google" size={32} /></span></div><ExternalLink href={url} className="google-review-card"><Icon name="google" size={28} /><span className="google-review-copy"><strong>{label}</strong><span>{language === "ar" ? "Ø´Ø§Ø±ÙƒÙ†Ø§ ØªØ¬Ø±Ø¨ØªÙƒ Ø¹Ù„Ù‰ Google" : "Share your experience on Google"}</span></span><Icon name="arrow" size={20} /></ExternalLink></section>;
}

function HoursSection({ title, items, language }: { title: string; items: Item[]; language: "ar" | "en" }) {
  const rows = items.filter(item => text(item.label) || text(item.value)); if (!rows.length) return null;
  return <section className="business-section hours-section"><p className="section-overline">OPENING HOURS</p><div className="hours-heading"><span className="hours-icon"><Icon name="clock" size={26} /></span><div><h2>{title || (language === "ar" ? "Ù…ÙˆØ§Ø¹ÙŠØ¯ Ø§Ù„Ø¹Ù…Ù„" : "Open Daily")}</h2><p>{language === "ar" ? "Ù†Ø±Ø­Ø¨ Ø¨Ø²ÙŠØ§Ø±ØªÙƒÙ… ÙŠÙˆÙ…ÙŠÙ‹Ø§." : "Great coffee, every day."}</p></div></div><div className="hours-list">{rows.map((item, index) => <div className="hours-row" key={`${item.label}-${index}`}><span>{labelFor(item)}</span><strong>{text(item.value) || (language === "ar" ? "Ù…ØºÙ„Ù‚" : "Closed")}</strong></div>)}</div></section>;
}

function GenericItems({ section, language }: { section: Section; language: "ar" | "en" }) {
  const items = Array.isArray(section.content.items) ? section.content.items as Item[] : []; const description = text(section.content.description); const address = text(section.content.address);
  if (section.kind === "about" && !description) return null; if (section.kind === "contact" && !address && !validWebUrl(section.content.mapsUrl)) return null; if (!items.length && section.kind !== "about" && section.kind !== "contact") return null;
  if (section.kind === "about") return <section className="business-section about-section"><p className="section-overline">ABOUT</p><h2>{section.title}</h2><p className="section-intro about-copy">{description}</p></section>;
  if (section.kind === "contact") { const mapsUrl = validWebUrl(section.content.mapsUrl); const mapImage = imageUrl(section.content.mapImageUrl); return <section className="business-section find-section"><p className="section-overline">LOCATE US & DIRECTIONS</p><div className="find-heading"><div><h2>{section.title || (language === "ar" ? "Ø§Ø¹Ø«Ø± Ø¹Ù„ÙŠÙ†Ø§" : "Find Us")}</h2><p>{address}</p></div><div className="map-actions">{mapsUrl && <ExternalLink href={mapsUrl} className="map-link"><Icon name="pin" size={18} />{language === "ar" ? "Ø®Ø±Ø§Ø¦Ø· Google" : "Google Maps"}</ExternalLink>}</div></div> {mapImage && <div className="map-preview"><img src={mapImage} alt="" /></div>}</section>; }
  return <section className={`business-section generic-section business-section-${section.kind}`}><p className="section-overline">{section.kind.toUpperCase()}</p><h2>{section.title}</h2><div className="generic-items">{items.filter(item => item.enabled !== false && (text(item.value) || validWebUrl(item.url))).map((item, index) => { const href = validWebUrl(item.url); const row = <><span className="generic-item-label">{labelFor(item)}</span>{text(item.value) && <span className="generic-item-value">{item.value}</span>}</>; return href ? <ExternalLink href={href} className="generic-item" key={`${item.label}-${index}`}>{row}<Icon name="arrow" size={18} /></ExternalLink> : <div className="generic-item" key={`${item.label}-${index}`}>{row}</div>; })}</div></section>;
}

export function PublicSnapshot({ snapshot }: { snapshot: Snapshot }) {
  const sections = [...(snapshot.sections || [])].map((section): Section => ({ ...section, content: { ...section.content, ...(Array.isArray(section.content.items) ? { items: (section.content.items as Item[]).map(item => resolveProviderItem(item, snapshot.providerProfiles || {})) } : {}) } })).map(section => section.content?._editorKind === "quick_actions" && section.kind === "social" ? { ...section, kind: "quick_actions", title: "Quick Actions" } : section).filter(section => section.enabled).sort((a, b) => a.position - b.position); const heroSection = sections.find(section => section.kind === "hero"); const hero = heroSection?.content || {}; const contactSection = sections.find(section => section.kind === "contact"); const contact = contactSection?.content || {}; const name = text(snapshot.business?.name) || text(snapshot.page?.branchName) || "Business";
  const language: "ar" | "en" = hero.language === "ar" || hero.language === "en" ? hero.language : /[\u0600-\u06ff]/.test(name) ? "ar" : "en"; const direction = language === "ar" ? "rtl" : "ltr"; const cover = imageUrl(hero.coverUrl); const logo = imageUrl(hero.logoUrl); const hours = sections.find(section => section.kind === "hours"); const hoursItems = Array.isArray(hours?.content.items) ? hours?.content.items as Item[] : []; const location = text(hero.location) || text(contact.address); const opening = text(hero.openingSummary) || text(hoursItems[0]?.value); const rating = Number(hero.rating); const ratingVerified = hero.ratingVerified === true && Number.isFinite(rating) && rating > 0; const ctaUrl = validWebUrl(hero.ctaUrl);
  const configuredActions = sections.find(section => section.kind === "quick_actions"); const actions = [{ key: "call", label: language === "ar" ? "Ø§ØªØµÙ„" : "Call", href: phoneUrl(contact.phone), icon: "phone" }, { key: "menu", label: language === "ar" ? "Ø§Ù„Ù‚Ø§Ø¦Ù…Ø©" : "Menu", href: validWebUrl(contact.menuUrl) || validWebUrl(hero.menuUrl), icon: "menu" }, { key: "order", label: language === "ar" ? "Ø§Ø·Ù„Ø¨ Ø§Ù„Ø¢Ù†" : "Order", href: validWebUrl(contact.orderUrl), icon: "order" }, { key: "location", label: language === "ar" ? "Ø§Ù„Ù…ÙˆÙ‚Ø¹" : "Directions", href: validWebUrl(contact.mapsUrl), icon: "pin" }].filter(action => action.href);
  return <main className="public-page premium-public" dir={direction} lang={language}><article className="business-wrap"><section className="business-hero" style={cover ? ({ "--hero-photo": `url("${cover}")` } as React.CSSProperties) : undefined}><div className="hero-overlay" /><div className="hero-content"><div className="business-logo">{logo ? <img src={logo} alt={`${name} logo`} /> : <span>{name.slice(0, 1).toUpperCase()}</span>}</div><h1>{name}</h1>{text(hero.tagline || hero.description) && <p className="hero-tagline">{text(hero.tagline || hero.description)}</p>}<div className="hero-meta">{ratingVerified && Boolean(hero.ratingSource) && <span><span className="meta-star">â˜…</span>{rating.toFixed(1)}</span>}{location && <span><Icon name="pin" size={17} />{location}</span>}{opening && <span><Icon name="clock" size={17} />{opening}</span>}</div>{ctaUrl && text(hero.ctaLabel) && <ExternalLink href={ctaUrl} className="hero-cta">{text(hero.ctaLabel)}<Icon name="arrow" size={19} /></ExternalLink>}</div></section>{configuredActions ? <QuickActions items={Array.isArray(configuredActions.content.items) ? configuredActions.content.items as Item[] : []} columns={columnCount(configuredActions.content.columns)} language={language} /> : actions.length > 0 && <section className={`quick-actions quick-actions-${actions.length}`} aria-label={language === "ar" ? "Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª Ø³Ø±ÙŠØ¹Ø©" : "Quick actions"}>{actions.map(action => <ExternalLink href={String(action.href)} className="quick-action" key={action.key}><Icon name={String(action.icon)} size={28} /><span>{String(action.label)}</span></ExternalLink>)}</section>}{sections.map(section => { if (section.kind === "hero" || section.kind === "quick_actions" || section.kind === "reviews") return null; if (section.kind === "social") return <SocialSection title={section.title} items={Array.isArray(section.content.items) ? section.content.items as Item[] : []} key={section.key || section.kind} />; if (section.kind === "payments") return <PaymentSection language={language} title={section.title} columns={columnCount(section.content.columns)} backgroundUrl={section.content.backgroundUrl} items={Array.isArray(section.content.items) ? section.content.items as Item[] : []} key={section.key || section.kind} />; if (section.kind === "hours") return <HoursSection title={section.title} items={hoursItems} language={language} key={section.key || section.kind} />; return <GenericItems section={section} language={language} key={section.key || section.kind} />; })}<footer className="powered-footer"><span />Powered by <strong>NexTap</strong></footer></article></main>;
}
