import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publishDraftState, saveDraftState } from "@/app/admin/businesses/actions";

/** JSON transport keeps route revalidation out of the live editor's React tree. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || url.protocol.slice(0, -1);
  if (request.headers.get("origin") !== `${protocol}://${host}`) return new Response("Forbidden", { status: 403 });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;
  if (error || typeof subject !== "string") return new Response("Unauthorized", { status: 401 });
  const { data: owner, error: ownerError } = await supabase.from("owner_users").select("user_id").eq("user_id", subject).maybeSingle();
  if (ownerError || !owner) return new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  const mode = form.get("mode");
  if (mode !== "save" && mode !== "publish") return NextResponse.json({ ok: false, error: "Invalid save mode." }, { status: 400 });
  // Existing actions retain validation, owner checks, atomic persistence and cache invalidation.
  const result = await (mode === "publish" ? publishDraftState(form) : saveDraftState(form));
  return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: { "Cache-Control": "private, no-store" } });
}
