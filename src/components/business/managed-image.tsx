"use client";
import Image from "next/image";
import { useState } from "react";
import { isOptimizableImage } from "@/lib/media/urls";

/** Reserved geometry lives in the parent; failures never remove surrounding actions. */
export function ManagedImage({ src, alt, sizes, priority = false, loading, fetchPriority, decoding = "async", quality, className = "" }: { src: string; alt: string; sizes: string; priority?: boolean; loading?: "eager" | "lazy"; fetchPriority?: "high" | "low" | "auto"; decoding?: "async" | "sync" | "auto"; quality?: number; className?: string }) {
  const [failedSource, setFailedSource] = useState("");
  if (failedSource === src) return <span className={`image-unavailable ${className}`} role={alt ? "img" : undefined} aria-label={alt || undefined}>{alt ? "Image unavailable" : null}</span>;
  const imageLoading = loading || (priority ? "eager" : "lazy");
  const imageFetchPriority = fetchPriority || (priority ? "high" : undefined);
  if (sizes === "84px") return <Image src={src} alt={alt} width={84} height={84} priority={priority} loading={imageLoading} fetchPriority={imageFetchPriority} decoding={decoding} quality={quality} unoptimized={!isOptimizableImage(src)} className={className} onError={() => setFailedSource(src)} />;
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} loading={imageLoading} fetchPriority={imageFetchPriority} decoding={decoding} quality={quality} unoptimized={!isOptimizableImage(src)} className={className} onError={() => setFailedSource(src)} />;
}
