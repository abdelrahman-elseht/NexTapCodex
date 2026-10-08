import { safeUrl } from "@/lib/content";
import { SocialLinks } from "@/components/social-links";

type Section = { key?: string; kind: string; title: string; position: number; enabled: boolean; content: Record<string, any> };
type Snapshot = { business?: { name?: string; category?: string }; page?: { branchName?: string }; sections?: Section[] };

function ReviewPrompt({ url }: { url: string }) {
  if (!safeUrl(url) || !/^https?:$/.test(new URL(url).protocol)) return null;
  return <a className="google-review-card" href={url} target="_blank" rel="noopener noreferrer" aria-label="اكتب تقييمًا على Google Reviews">
    <img src="/icons/social/google.svg" width="26" height="26" alt="Google"/>
    <span className="google-review-copy"><strong>Google Reviews</strong><span>يسعدنا تقييمك وتجربتك</span></span>
    <span className="review-stars" aria-hidden="true">★★★★★</span>
    <span className="review-arrow" aria-hidden="true">↗</span>
  </a>;
}

export function PublicSnapshot({ snapshot }: { snapshot: Snapshot }) {
  const sections = [...(snapshot.sections || [])].filter(section => section.enabled).sort((a, b) => a.position - b.position);
  const hero = sections.find(section => section.kind === "hero")?.content || {};
  const contact = sections.find(section => section.kind === "contact")?.content || {};
  const name = snapshot.business?.name || snapshot.page?.branchName || "NexTap";
  const accent = /^#[0-9a-f]{6}$/i.test(hero.color || "") ? hero.color : "#bb9659";
  const phoneNumber = String(contact.whatsapp || "").replace(/\D/g, "");
  const whatsappUrl = safeUrl(contact.whatsapp) && /^https?:$/.test(new URL(String(contact.whatsapp)).protocol)
    ? String(contact.whatsapp)
    : phoneNumber.length >= 5 ? `https://wa.me/${phoneNumber}` : "";

  return <main className="public-page"><article className="public-wrap">
    <div className="public-cover" style={{ borderTop: `6px solid ${accent}` }}/>
    <header className="public-profile"><div className="public-avatar" aria-hidden="true">{name.slice(0, 1)}</div><h1>{name}</h1>
      {snapshot.business?.category && <p>{snapshot.business.category}</p>}
      {(hero.tagline || hero.description) && <p>{hero.tagline || hero.description}</p>}
      <div className="public-actions">
        {whatsappUrl && <a className="action-link" href={whatsappUrl}><img src="/icons/social/whatsapp.svg" alt="" width="19" height="19"/> واتساب</a>}
        {contact.phone && <a className="action-link" href={`tel:${contact.phone}`}>اتصل بنا</a>}
        {contact.mapsUrl && safeUrl(contact.mapsUrl) && <a className="action-link" href={contact.mapsUrl} target="_blank" rel="noopener noreferrer">الموقع</a>}
      </div>
    </header>
    {sections.filter(section => section.kind !== "hero").map(section => <section className={`public-section public-section-${section.kind}`} key={section.key || `${section.kind}-${section.position}`}>
      <h2>{section.title}</h2>
      {section.kind === "about" && <p>{String(section.content.description || "")}</p>}
      {section.kind === "contact" && <p>{String(section.content.address || "")}</p>}
      {section.kind === "social" && <SocialLinks items={Array.isArray(section.content.items) ? section.content.items : []}/>}
      {section.kind === "reviews" && <ReviewPrompt url={String(section.content.url || "")}/>}
      {section.kind !== "social" && section.kind !== "reviews" && Array.isArray(section.content.items) && section.content.items.map((item: any, index: number) => <div className="public-item" key={index}>{item.url && safeUrl(item.url) ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.label}</a> : <span>{item.label} {item.value}</span>}</div>)}
    </section>)}
    <footer className="public-brand">صفحة أعمال بواسطة NexTap</footer>
  </article></main>;
}
