/** Same allowlist as next.config: no arbitrary remote image proxy. */
export function isOptimizableImage(source: string, storageOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL || "") {
  if (source.startsWith("/api/media/")) return false; // Session-bound drafts must never enter the image optimizer cache.
  if (source.startsWith("/") && !source.startsWith("//") && !/[\\]|(?:\.{2})/.test(source)) return /\.(?:png|jpe?g|webp|avif)(?:\?.*)?$/i.test(source);
  try {
    const url = new URL(source); const origin = new URL(storageOrigin);
    return url.origin === origin.origin && url.protocol === "https:" && !url.username && !url.password && !url.search && url.pathname.startsWith("/storage/v1/object/public/business-media/") && /\.(?:webp|avif)$/i.test(url.pathname);
  } catch { return false; }
}

export const managedMediaPath = /^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}(?:\.crop-\d{1,4}-\d{1,4}-\d{4})?\.(?:webp|avif|png|jpe?g|contact\.jpg)$/i;
/** Preserve persisted snapshot URLs; resolve their bytes through publication-aware access. */
export function mediaDisplayUrl(source: string, storageOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL || "") {
  try {
    const url = new URL(source);
    const origin = new URL(storageOrigin);
    const prefix = "/storage/v1/object/public/business-media/";
    if (url.origin !== origin.origin || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(prefix)) return source;
    const path = url.pathname.slice(prefix.length);
    return managedMediaPath.test(path) ? `/api/media/${path}` : source;
  } catch { return source; }
}
