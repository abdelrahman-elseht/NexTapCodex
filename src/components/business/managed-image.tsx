"use client";
import Image from "next/image";
import { useState } from "react";
import { isOptimizableImage } from "@/lib/media/urls";

/** Reserved geometry lives in the parent; failures never remove surrounding actions. */
export function ManagedImage({ src, alt, sizes, priority = false, className = "" }: { src: string; alt: string; sizes: string; priority?: boolean; className?: string }) {
  const [failedSource, setFailedSource] = useState("");
  if (failedSource === src) return <span className={`image-unavailable ${className}`} role={alt ? "img" : undefined} aria-label={alt || undefined}>{alt ? "Image unavailable" : null}</span>;
  if (sizes === "84px") return <Image src={src} alt={alt} width={84} height={84} priority={priority} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" unoptimized={!isOptimizableImage(src)} className={className} onError={() => setFailedSource(src)} />;
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" unoptimized={!isOptimizableImage(src)} className={className} onError={() => setFailedSource(src)} />;
}
