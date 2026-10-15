import { revalidatePath } from "next/cache";
import { authorizeMutation, boundedJson, databaseFailure, mutationResponse, uuidPattern } from "@/lib/admin/mutation";

export async function POST(request: Request) {
  const auth = await authorizeMutation(request);
  if (auth.response) return auth.response;
  let body;
  try { body = await boundedJson(request); } catch { return mutationResponse({ ok: false, error: "Invalid request" }, 400); }
  if (!body || typeof body !== "object") return mutationResponse({ ok: false, error: "Invalid request" }, 400);
  let operation;
  if (body.mode === "preview") {
    const ids = body.cardIds, batch = body.batchId;
    if ((batch == null) === (ids == null) || (batch != null && (typeof batch !== "string" || !uuidPattern.test(batch))) ||
      (ids != null && (!Array.isArray(ids) || ids.length < 1 || ids.length > 1000 || ids.some(id => typeof id !== "string" || !uuidPattern.test(id))))) {
      return mutationResponse({ ok: false, error: "Invalid deletion scope" }, 422);
    }
    operation = await auth.supabase.rpc("preview_card_deletion", { card_ids: ids ? [...new Set(ids)] : null, batch_id: batch || null });
  } else if (body.mode === "commit" && typeof body.operationId === "string" && uuidPattern.test(body.operationId) && body.acknowledged === true &&
    (body.batchCode == null || (typeof body.batchCode === "string" && body.batchCode.length <= 80))) {
    operation = await auth.supabase.rpc("commit_card_deletion", { operation_id: body.operationId, acknowledged: true, impact_acknowledged: body.impactAcknowledged === true, batch_code: body.batchCode ?? null });
  } else return mutationResponse({ ok: false, error: "Confirmation required" }, 422);
  if (operation.error) return databaseFailure(operation.error);
  if (body.mode === "commit") revalidatePath("/admin/cards");
  return mutationResponse({ ok: true, ...operation.data });
}
