"use client";

import { ManagedImage } from "./managed-image";

export type GalleryViewItem = { url: string; alt: string; label: string };

export function GalleryView({ items }: { items: GalleryViewItem[] }) {
  return <div className="gallery-grid">{items.map((item, index) => <figure key={`${item.url}-${index}`}><a href={item.url} target="_blank" rel="noopener noreferrer" className="gallery-photo" aria-label={item.alt || item.label || `Gallery image ${index + 1}`}><ManagedImage src={item.url} alt={item.alt || item.label} sizes="(max-width: 560px) calc((100vw - 50px) / 2), 245px" /></a>{item.label && <figcaption>{item.label}</figcaption>}</figure>)}</div>;
}
