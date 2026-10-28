import { createClient } from "@/lib/supabase/server";
import { managedMediaPath } from "@/lib/media/urls";
import { readManagedObject } from "@/lib/media/read-object";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const denied = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join("/");
  if (!managedMediaPath.test(path)) return denied();
  try {
    let bytes = await readManagedObject(path, 5 * 1024 * 1024);
    const published = !!bytes;
    if (!published) {
      const client = await createClient();
      const { data, error } = await client.auth.getClaims();
      if (error || !data?.claims?.sub) return denied();
      // Storage RLS verifies internal admission; no service credential or URL signing.
      bytes = await readManagedObject(path, 5 * 1024 * 1024, client);
    }
    if (!bytes) return denied();
    const type = path.endsWith(".avif") ? "image/avif" : path.endsWith(".webp") ? "image/webp" : path.endsWith(".png") ? "image/png" : "image/jpeg";
    return new Response(bytes as BodyInit, { headers: { "Content-Type": type, "Content-Length": String(bytes.byteLength), "Cache-Control": published ? "public, max-age=60, must-revalidate" : "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Vary": "Cookie" } });
  } catch { return denied(); }
}
