/** Same allowlist as next.config: no arbitrary remote image proxy. */
export function isOptimizableImage(source: string, storageOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL || "") {
  if (source.startsWith("/") && !source.startsWith("//") && !/[\\]|(?:\.{2})/.test(source)) return /\.(?:png|jpe?g|webp|avif)(?:\?.*)?$/i.test(source);
  try {
    const url = new URL(source); const origin = new URL(storageOrigin);
    return url.origin === origin.origin && url.protocol === "https:" && !url.username && !url.password && !url.search && url.pathname.startsWith("/storage/v1/object/public/business-media/") && /\.webp$/i.test(url.pathname);
  } catch { return false; }
}
