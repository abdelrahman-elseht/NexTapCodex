import { safeUrl } from "@/lib/business/content";

const brands = [
  { id: "whatsapp", hosts: ["whatsapp.com", "wa.me"], label: "WhatsApp" },
  { id: "facebook", hosts: ["facebook.com", "fb.com"], label: "Facebook" },
  { id: "instagram", hosts: ["instagram.com"], label: "Instagram" },
  { id: "tiktok", hosts: ["tiktok.com"], label: "TikTok" },
  { id: "youtube", hosts: ["youtube.com", "youtu.be"], label: "YouTube" },
  { id: "x", hosts: ["x.com", "twitter.com"], label: "X" },
  { id: "linkedin", hosts: ["linkedin.com"], label: "LinkedIn" },
  { id: "telegram", hosts: ["t.me", "telegram.me"], label: "Telegram" },
  { id: "snapchat", hosts: ["snapchat.com"], label: "Snapchat" },
  { id: "pinterest", hosts: ["pinterest.com"], label: "Pinterest" },
  { id: "messenger", hosts: ["m.me", "messenger.com"], label: "Messenger" },
];

export function SocialLinks({ items }: { items: Array<{ label?: string; url?: string }> }) {
  const links = items.flatMap(item => {
    if (!safeUrl(item.url) || !/^https?:$/.test(new URL(item.url).protocol)) return [];
    const host = new URL(item.url).hostname.replace(/^www\./, "").toLowerCase();
    const brand = brands.find(candidate => candidate.hosts.some(domain => host === domain || host.endsWith(`.${domain}`)));
    return [{ href: item.url, label: brand?.label || item.label || host, icon: brand?.id || null }];
  });
  if (!links.length) return null;

  return <nav className="social-icon-list" aria-label="Social media links">
    {links.map(({ href, label, icon }) => <a className="social-icon-link" href={href} key={href} aria-label={label} title={label} target="_blank" rel="noopener noreferrer">
      {icon ? <img src={`/icons/social/${icon}.svg`} alt="" width="24" height="24" loading="lazy"/> : <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 3h7v7M10 14 21 3M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/></svg>}
    </a>)}
  </nav>;
}
