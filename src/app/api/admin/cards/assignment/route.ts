import { NextResponse } from "next/server";
import { captureOperationError } from "@/lib/observability/operations";
import { authorizeMutation, mutationResponse, databaseFailure, boundedForm } from "@/lib/admin/mutation";
import { revalidatePath } from "next/cache";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Hydrated callers negotiate JSON; native forms retain a POST/303 fallback. */
export async function POST(request: Request) {
  const auth = await authorizeMutation(request);
  if (auth.response) return auth.response;
  const { supabase, origin } = auth;
  const json = request.headers.get("accept")?.includes("application/json");
  if (Number(request.headers.get("content-length")) > 16384) return mutationResponse({ ok: false, error: "Request too large" }, 413);
  let form: FormData;
  try { form = await boundedForm(request); } catch { return mutationResponse({ ok: false, error: "Invalid form" }, 400); }
  const value = (name: string) => String(form.get(name) || "").trim();
  const cardId = value("card_id"), pageId = value("page_id"), mode = value("mode");
  const redirect = (query: string) => json ? mutationResponse({ ok: false, error: "راجع بيانات البطاقة والتأكيد وأعد المحاولة.", code: query }, 422) : NextResponse.redirect(new URL(`/admin/cards?${query}`, origin), 303);
  if (value("confirm") !== "on") return redirect("error=confirmation");
  if (!uuid.test(cardId) || (mode !== "" && mode !== "disable") || (mode !== "disable" && !uuid.test(pageId))) {
    return redirect("error=assignment");
  }
  const requestKey = value("request_key");
  if (json && !uuid.test(requestKey)) return redirect("error=request");
  const { data: result, error: assignmentError } = await supabase.rpc(json ? "assign_card_once" : "assign_card", {
    ...(json ? { request_key: requestKey } : {}),
    card_id: cardId, target_page_id: mode === "disable" ? null : pageId,
    next_status: mode === "disable" ? "disabled" : "active",
    change_reason: mode === "disable" ? "deactivation" : "reassignment",
  });
  if (assignmentError) { captureOperationError(assignmentError, "admin.card_assignment"); return json ? databaseFailure(assignmentError) : redirect("error=assignment"); }
  revalidatePath("/admin/cards");
  return json ? mutationResponse({ ok: true, ...result }) : NextResponse.redirect(new URL("/admin/cards?assigned=1", origin), 303);
}
