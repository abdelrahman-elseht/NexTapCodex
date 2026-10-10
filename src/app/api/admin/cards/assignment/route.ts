import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureOperationError } from "@/lib/observability/operations";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Native POST/303 avoids the production RSC redirect stall on the card table. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  // Next's middleware adapter may normalize a loopback URL to localhost.
  // Host is the browser's destination; Vercel supplies the external protocol.
  const host = request.headers.get("host") || url.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || url.protocol.slice(0, -1);
  const origin = `${protocol}://${host}`;
  // Native form endpoints need the same cross-origin protection as Server Actions.
  if (request.headers.get("origin") !== origin) return new Response("Forbidden", { status: 403 });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;
  if (error || typeof subject !== "string") return new Response("Unauthorized", { status: 401 });
  const { data: owner, error: ownerError } = await supabase.from("owner_users").select("user_id").eq("user_id", subject).maybeSingle();
  if (ownerError || !owner) return new Response("Forbidden", { status: 403 });

  const form = await request.formData();
  const value = (name: string) => String(form.get(name) || "").trim();
  const cardId = value("card_id"), pageId = value("page_id"), mode = value("mode");
  const redirect = (query: string) => NextResponse.redirect(new URL(`/admin/cards?${query}`, origin), 303);
  if (value("confirm") !== "on") return redirect("error=confirmation");
  if (!uuid.test(cardId) || (mode !== "" && mode !== "disable") || (mode !== "disable" && !uuid.test(pageId))) {
    return redirect("error=assignment");
  }
  const { error: assignmentError } = await supabase.rpc("assign_card", {
    card_id: cardId, target_page_id: mode === "disable" ? null : pageId,
    next_status: mode === "disable" ? "disabled" : "active",
    change_reason: mode === "disable" ? "deactivation" : "reassignment",
  });
  if (assignmentError) { captureOperationError(assignmentError, "admin.card_assignment"); return redirect("error=assignment"); }
  // Cards and permanent redirect routes read live state; the native navigation
  // reloads the inventory instead of retaining a stale client router entry.
  return redirect("assigned=1");
}
