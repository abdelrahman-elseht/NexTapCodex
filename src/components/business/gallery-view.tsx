"use client";

import { ManagedImage } from "./managed-image";
import { mediaDisplayUrl } from "@/lib/media/urls";

export type GalleryViewItem = { id?: string; url: string; alt: string; label: string; subtitle?: string; badge?: string };

export function GalleryView({ items }: { items: GalleryViewItem[] }) {
  items = items.map(item => ({ ...item, url: mediaDisplayUrl(item.url) }));
  return <div className="gallery-grid">{items.map((item, index) => <figure key={item.id || `${item.url}-${index}`}><a href={item.url} target="_blank" rel="noopener noreferrer" className="gallery-photo" aria-label={item.alt || item.label || `Gallery image ${index + 1}`}><ManagedImage src={item.url} alt={item.alt || item.label} sizes="(max-width: 560px) calc((100vw - 50px) / 2), 245px" /></a>{(item.label || item.subtitle || item.badge) && <figcaption>{item.label}{item.subtitle && <span className="item-subtitle">{item.subtitle}</span>}{item.badge && <span className="item-badge">{item.badge}</span>}</figcaption>}</figure>)}</div>;
}
