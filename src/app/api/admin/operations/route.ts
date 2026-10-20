import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { authorizeMutation, databaseFailure, mutationResponse, uuidPattern, boundedForm } from "@/lib/admin/mutation";
import { isTemplate, presetSections } from "@/lib/business/content";

import { sectionDefaults as defaults, sectionTitles as titles } from "@/lib/business/section-defaults";
export async function POST(request: Request) {
  const auth = await authorizeMutation(request); if (auth.response) return auth.response;
  if (Number(request.headers.get("content-length")) > 16384) return mutationResponse({ ok: false, error: "Request too large" }, 413);
  let fd; try { fd = await boundedForm(request); } catch { return mutationResponse({ ok: false, error: "Invalid form" }, 400); }
  const value = (key: string) => String(fd.get(key) || "").trim();
  const mode = value("mode"), key = value("request_key"), name = value("name"), slug = value("slug");
  const invalid = () => mutationResponse({ ok: false, error: "راجع الحقول المطلوبة. لم يتم حفظ التغيير." }, 422);
  if (!uuidPattern.test(key)) return invalid();
  if (mode === "batch") {
    const quantity = Number(value("quantity"));
    if (!name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name) || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000) return invalid();
    const { data, error } = await auth.supabase.rpc("create_card_batch", { batch_name: name, card_quantity: quantity, request_key: key, card_tokens: Array.from({ length: quantity }, () => randomBytes(24).toString("base64url")) });
    if (error) return databaseFailure(error);
    revalidatePath("/admin/cards");
    return mutationResponse({ ok: true, nextHref: `/admin/cards/batches/${data.id}?created=1` });
  }
  const businessId = value("business_id"), pageId = value("page_id");
  if (mode === "page-state") {
    if (!uuidPattern.test(businessId) || !uuidPattern.test(pageId) || !["true", "false"].includes(value("active"))) return invalid();
    const { data, error } = await auth.supabase.from("business_pages").update({ is_active: value("active") === "true", updated_at: new Date().toISOString() }).eq("id", pageId).eq("business_id", businessId).select("id").maybeSingle();
    if (error) return databaseFailure(error);
    if (!data) return databaseFailure({ code: "P0002" });
    revalidatePath(`/admin/businesses/${businessId}`); revalidatePath("/b/[slug]", "page");
    return mutationResponse({ ok: true });
  }
  if (!["business", "branch"].includes(mode) || !/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)) return invalid();
  let details, kinds: string[], enabled: Set<string>;
  if (mode === "business") {
    const template = value("template"), category = value("category");
    if (!name || name.length > 120 || category.length > 80 || !isTemplate(template)) return invalid();
    details = { name, category, slug, template }; enabled = new Set(presetSections(template));
    kinds = [...enabled, ...Object.keys(defaults).filter(kind => !enabled.has(kind))];
  } else {
    const parentId = value("parent_page_id"), branchName = value("branch_name");
    if (!uuidPattern.test(businessId) || !uuidPattern.test(parentId) || !branchName || branchName.length > 100) return invalid();
    details = { businessId, parentId, branchName, slug }; kinds = ["hero", "contact"]; enabled = new Set(kinds);
  }
  const seeds = kinds.map(kind => ({ kind, title: titles[kind], content: defaults[kind], enabled: enabled.has(kind) }));
  const { data, error } = await auth.supabase.rpc("create_admin_page", { request_key: key, details, seeds });
  if (error) return databaseFailure(error);
  revalidatePath("/admin"); revalidatePath(`/admin/businesses/${data.businessId}`);
  return mutationResponse({ ok: true, ...(mode === "business" ? { nextHref: `/admin/businesses/${data.businessId}?created=1` } : {}) });
}
