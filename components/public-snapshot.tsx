import { safeUrl } from "@/lib/content";
import { SocialLinks } from "@/components/social-links";

type Section = {
  key?: string;
  kind: string;
  title: string;
  position: number;
  enabled: boolean;
  content: Record<string, unknown>;
};
type Item = { label?: string; url?: string; value?: string };
type Snapshot = {
  business?: { name?: string; category?: string };
  page?: { branchName?: string };
  sections?: Section[];
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
function isWebUrl(value: string) {
  return safeUrl(value) && /^https?:$/.test(new URL(value).protocol);
}
function imageUrl(value: unknown) {
  const source = text(value);
  if (source.startsWith("/") && !source.startsWith("//")) return source;
  return isWebUrl(source) ? source : "";
}
function phoneUrl(value: unknown) {
  const number = text(value).replace(/[^\d+]/g, "");
  return number.replace(/\D/g, "").length >= 5 ? "tel:" + number : "";
}
function whatsappUrl(value: unknown) {
  const input = text(value);
  if (isWebUrl(input)) return input;
  const number = input.replace(/\D/g, "");
  return number.length >= 5 && number.length <= 15 ? "https://wa.me/" + number : "";
}

function ReviewPrompt({ url }: { url: string }) {
  if (!isWebUrl(url)) return null;
  return (
    <a className="google-review-card" href={url} target="_blank" rel="noopener noreferrer" aria-label="اكتب تقييمًا على Google Reviews">
      <img src="/icons/social/google.svg" width="26" height="26" alt="Google" loading="lazy" />
      <span className="google-review-copy"><strong>Google Reviews</strong><span>يسعدنا تقييمك وتجربتك</span></span>
      <span className="review-stars" aria-hidden="true">★★★★★</span>
      <span className="review-arrow" aria-hidden="true">↗</span>
    </a>
  );
}

function SectionContent({ section }: { section: Section }) {
  const items = Array.isArray(section.content.items) ? section.content.items as Item[] : [];
  const description = text(section.content.description);
  const address = text(section.content.address);
  const reviewsUrl = text(section.content.url);

  if (section.kind === "hero") return null;
  if (section.kind === "about" && !description) return null;
  if (section.kind === "contact" && !address) return null;
  if (section.kind === "social" && !items.length) return null;
  if (section.kind === "reviews" && !isWebUrl(reviewsUrl)) return null;
  if (section.kind !== "about" && section.kind !== "contact" && section.kind !== "social" && section.kind !== "reviews" && !items.length) return null;

  return (
    <section className={"public-section public-section-" + section.kind} key={section.key || section.kind + "-" + section.position}>
      <h2>{section.title}</h2>
      {section.kind === "about" && <p>{description}</p>}
      {section.kind === "contact" && <p>{address}</p>}
      {section.kind === "social" && <SocialLinks items={items} />}
      {section.kind === "reviews" && <ReviewPrompt url={reviewsUrl} />}
      {section.kind !== "social" && section.kind !== "reviews" && section.kind !== "about" && section.kind !== "contact" &&
        items.map((item, index) => {
          const label = text(item?.label);
          const value = text(item?.value);
          const href = text(item?.url);
          if (!label && !value) return null;
          return (
            <div className="public-item" key={index}>
              {isWebUrl(href)
                ? <a href={href} target="_blank" rel="noopener noreferrer">{label || href}</a>
                : <span>{label}{label && value ? " · " : ""}{value}</span>}
            </div>
          );
        })}
    </section>
  );
}

export function PublicSnapshot({ snapshot }: { snapshot: Snapshot }) {
  const sections = [...(snapshot.sections || [])].filter(section => section.enabled).sort((a, b) => a.position - b.position);
  const hero = sections.find(section => section.kind === "hero")?.content || {};
  const contact = sections.find(section => section.kind === "contact")?.content || {};
  const name = text(snapshot.business?.name) || text(snapshot.page?.branchName) || "NexTap";
  const tagline = text(hero.tagline) || text(hero.description);
  const language = hero.language === "en" || hero.language === "ar"
    ? hero.language
    : /[\u0600-\u06ff]/.test(name) ? "ar" : "en";
  const direction = language === "ar" ? "rtl" : "ltr";  const accent = /^#[0-9a-f]{6}$/i.test(text(hero.color)) ? text(hero.color) : "#bd8b37";
  const cover = imageUrl(hero.coverUrl);
  const logo = imageUrl(hero.logoUrl);
  const actions = [
    { label: "واتساب", href: whatsappUrl(contact.whatsapp), icon: "/icons/social/whatsapp.svg" },
    { label: "اتصل بنا", href: phoneUrl(contact.phone) },
    { label: "الموقع", href: isWebUrl(text(contact.mapsUrl)) ? text(contact.mapsUrl) : "" },
  ].filter(action => action.href);
  const primaryAction = actions.find(action => action.label === "واتساب") || actions.find(action => action.label === "اتصل بنا") || actions[0];

  return (
    <main className="public-page" dir={direction} lang={language}>
      <article className="public-wrap">
        <div className="public-cover" style={{ borderTop: "6px solid " + accent }}>
          {cover && <img src={cover} alt="" />}
          <span className="public-cover-mark">NexTap</span>
          <span className="public-cover-caption">Tap or scan to connect</span>
        </div>
        <header className="public-profile">
          <div className="public-avatar" aria-hidden="true">
            {logo ? <img src={logo} alt="" /> : name.slice(0, 1)}
          </div>
          <p className="eyebrow">{language === "ar" ? "صفحة نشاط على NexTap" : "A NexTap business page"}</p>
          <h1>{name}</h1>
          {snapshot.business?.category && <p>{snapshot.business.category}</p>}
          {snapshot.page?.branchName && <p className="muted">{language === "ar" ? "فرع " : "Branch "}{snapshot.page.branchName}</p>}
          {tagline && <p className="profile-description">{tagline}</p>}
          {actions.length > 0 && (
            <div className="public-actions" aria-label={language === "ar" ? "طرق التواصل السريعة" : "Quick actions"}>
              {actions.map(action => (
                <a className="action-link" href={action.href} key={action.label} target={action.href.startsWith("https:") ? "_blank" : undefined} rel={action.href.startsWith("https:") ? "noopener noreferrer" : undefined}>
                  {action.icon && <img src={action.icon} alt="" width="19" height="19" />}
                  {language === "en" && action.label === "واتساب" ? "WhatsApp" : language === "en" && action.label === "اتصل بنا" ? "Call" : language === "en" && action.label === "الموقع" ? "Directions" : action.label}
                </a>
              ))}
            </div>
          )}
        </header>
        {sections.map(section => {
          const englishTitles: Record<string, Record<string, string>> = {
            about: { "عن النشاط": "About" }, hours: { "مواعيد العمل": "Opening hours" },
            contact: { "تواصل معنا": "Contact" }, social: { "تابعنا": "Find us online" },
            payments: { "طرق الدفع": "Payment options" }, links: { "روابط مهمة": "Useful links" },
            services: { "الخدمات": "Services" }, gallery: { "معرض الصور": "Gallery" },
            reviews: { "آراء العملاء": "Reviews" }, branch: { "الفروع": "Branches" },
          };
          const localized = language === "en"
            ? { ...section, title: englishTitles[section.kind]?.[section.title] || section.title }
            : section;
          return <SectionContent key={section.key || section.kind + "-" + section.position} section={localized} />;
        })}
        <footer className="public-brand"><span className="dot" />{language === "ar" ? "صفحة أعمال بواسطة NexTap" : "Business page by NexTap"}</footer>
      </article>
      {primaryAction && (
        <nav className="public-bottom-actions" aria-label={language === "ar" ? "الإجراء السريع" : "Quick action"}>
          {actions.slice(0, 2).map((action, index) => (
            <a className={"action-link" + (index === 0 ? " primary" : "")} href={action.href} key={action.label} target={action.href.startsWith("https:") ? "_blank" : undefined} rel={action.href.startsWith("https:") ? "noopener noreferrer" : undefined}>
              {language === "en" && action.label === "واتساب" ? "WhatsApp" : language === "en" && action.label === "اتصل بنا" ? "Call" : language === "en" && action.label === "الموقع" ? "Directions" : action.label}
            </a>
          ))}
        </nav>
      )}
    </main>
  );
}
