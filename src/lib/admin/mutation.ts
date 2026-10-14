import { createClient } from "@/lib/supabase/server";

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function mutationResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
export async function authorizeMutation(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || url.protocol.slice(0, -1);
  const origin = `${protocol}://${host}`;
  if (request.headers.get("origin") !== origin) return { response: mutationResponse({ ok: false, error: "Forbidden", code: "forbidden" }, 403) };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;
  if (error || typeof subject !== "string") return { response: mutationResponse({ ok: false, error: "انتهت الجلسة. سجّل الدخول ثم أعد المحاولة.", code: "unauthorized" }, 401) };
  const { data: owner, error: ownerError } = await supabase.from("owner_users").select("user_id").eq("user_id", subject).maybeSingle();
  if (ownerError || !owner) return { response: mutationResponse({ ok: false, error: "Forbidden", code: "forbidden" }, 403) };
  return { supabase, origin };
}
export function databaseFailure(error: { code?: string }) {
  const status = error.code === "42501" ? 403 : error.code === "40001" ? 409 : error.code === "P0002" ? 404 : ["22023", "23505", "23514"].includes(error.code || "") ? 422 : 500;
  const message = status === 409 ? "تغيّرت البيانات. راجع التأكيد مجدداً قبل المتابعة." : status === 404 ? "لم يعد العنصر موجوداً. حدّث النتائج." : "تعذر تنفيذ العملية. راجع البيانات وأعد المحاولة؛ لم يتم تأكيد النجاح.";
  return mutationResponse({ ok: false, error: message, code: status === 409 ? "conflict" : status === 404 ? "missing" : "rejected" }, status);
}
async function boundedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) throw new Error("Request too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength; if (length > limit) { await reader.cancel(); throw new Error("Request too large"); }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally { reader.releaseLock(); }
}
export async function boundedJson(request: Request, limit = 65536) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Invalid content type");
  return JSON.parse((await boundedBody(request, limit)).toString("utf8"));
}
export async function boundedForm(request: Request) {
  const body = await boundedBody(request, 16384);
  return new Response(body, { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
}
