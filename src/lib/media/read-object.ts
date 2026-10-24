import type { SupabaseClient } from "@supabase/supabase-js";
import { readBoundedBody } from "@/lib/security/bounded-body";
import { managedMediaPath } from "./urls";

/** Storage RLS authorizes every read; buffer only within the byte and time budget. */
export async function readManagedObject(path: string, maxBytes: number, client?: SupabaseClient): Promise<Uint8Array | undefined> {
  if (!managedMediaPath.test(path)) return;
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!origin || !key) return;
  try {
    const token = client ? (await client.auth.getSession()).data.session?.access_token : undefined;
    if (client && !token) return;
    const authorization = token || (key.startsWith("eyJ") ? key : undefined);
    const response = await fetch(`${origin}/storage/v1/object/business-media/${path}`, {
      headers: { apikey: key, ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}) },
      cache: "no-store", signal: AbortSignal.timeout(3000), redirect: "error",
    });
    if (!response.ok) { await response.body?.cancel(); return; }
    return await readBoundedBody(response, maxBytes);
  } catch { return; }
}
