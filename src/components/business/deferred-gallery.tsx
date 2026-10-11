"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { GalleryViewItem } from "./gallery-view";

const GalleryView = dynamic(() => import("./gallery-view").then(module => module.GalleryView), {
  ssr: false,
  loading: () => null,
});

export function DeferredGallery({ title, items }: { title: string; items: GalleryViewItem[] }) {
  const section = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = section.current;
    if (!target) return;
    if (!("IntersectionObserver" in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "100px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return <section ref={section} className="business-section gallery-section"><h2>{title || "Gallery"}</h2>{visible ? <GalleryView items={items} /> : <div className="gallery-placeholder" aria-hidden="true" style={{ aspectRatio: `8 / ${3 * Math.ceil(items.length / 2)}` }} />}</section>;
}
