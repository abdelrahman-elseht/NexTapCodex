"use server";
import { randomBytes, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";
import { parseSectionContent, sectionKinds, isTemplate, presetSections } from "@/lib/business/content";
import { businessSlugSchema as slugSchema } from "@/lib/business/draft";
import { captureOperationError } from "@/lib/observability/operations";
import { parseDraft as parseDraftAction, saveDraftState as saveDraftStateAction, publishDraftState as publishDraftStateAction } from "./draft-actions";

function val(fd:FormData,key:string,max=200){return String(fd.get(key)||"").trim().slice(0,max)}
import { sectionDefaults as defaults, sectionTitles } from "@/lib/business/section-defaults";
export async function parseDraft(fd: FormData) { return parseDraftAction(fd); }
export async function saveDraftState(fd: FormData) { return saveDraftStateAction(fd); }
export async function publishDraftState(fd: FormData) { return publishDraftStateAction(fd); }
export async function createBusiness(fd:FormData){
 const {supabase}=await requireOwner("edit");
 const name=val(fd,"name",120),category=val(fd,"category",80),slug=val(fd,"slug",60).toLowerCase(),template=val(fd,"template",20);
 if(name.length<1||!slugSchema.safeParse(slug).success||!isTemplate(template)) redirect("/admin/businesses/new?error=validation");
 const {data:b,error:be}=await supabase.from("businesses").insert({name,category:category||"business"}).select("id").single();
 if(be||!b) redirect("/admin/businesses/new?error=database");
 const {data:p,error:pe}=await supabase.from("business_pages").insert({business_id:b.id,slug,template}).select("id").single();
 if(pe||!p){await supabase.from("businesses").delete().eq("id",b.id);redirect("/admin/businesses/new?error=slug");}
 const presetOrder = presetSections(template);
 const orderedKinds = [...presetOrder, ...Object.keys(defaults).filter(kind => !presetOrder.includes(kind))];
 const enabledKinds = new Set(presetOrder);
 const seeds=orderedKinds.map((kind,position)=>({page_id:p.id,section_key:kind,title:sectionTitles[kind],position,kind,content:defaults[kind],enabled:enabledKinds.has(kind)}));
 const { error: sectionsError } = await supabase.from("page_sections").insert(seeds);
 if (sectionsError) {
  // Older isolated projects may still have the pre-Quick Actions CHECK
  // constraint. Keep those projects usable by storing the new section as a
  // legacy social row with an explicit editor marker; the migration upgrades
  // fresh projects to the native quick_actions kind.
  const fallbackSeeds = seeds.map(seed => seed.kind === "quick_actions"
    ? { ...seed, kind: "social", title: "الإجراءات السريعة", content: { ...(seed.content as Record<string, unknown>), _editorKind: "quick_actions" } }
    : seed);
  const { error: fallbackError } = await supabase.from("page_sections").insert(fallbackSeeds);
  if (fallbackError) {
   await supabase.from("business_pages").delete().eq("id", p.id);
   await supabase.from("businesses").delete().eq("id", b.id);
   redirect("/admin/businesses/new?error=sections");
  }
 }
 await supabase.from("audit_logs").insert({actor_id:(await supabase.auth.getClaims()).data?.claims?.sub,action:"business.create",entity_type:"business",entity_id:b.id});
 revalidatePath("/admin");redirect("/admin/businesses/"+b.id+"?created=1");
}
export async function saveBusiness(fd:FormData){
 const {supabase}=await requireOwner("edit");
 const businessId=val(fd,"business_id",50),pageId=val(fd,"page_id",50),name=val(fd,"name",120),category=val(fd,"category",80),slug=val(fd,"slug",60).toLowerCase(),template=val(fd,"template",20);
 if(!name||!slugSchema.safeParse(slug).success||!isTemplate(template)) redirect("/admin/businesses/"+businessId+"?error=validation");
 const { error } = await supabase.rpc("update_business_page", { target_business_id: businessId, target_page_id: pageId, business_name: name, business_category: category, business_status: fd.get("archive")==="on" ? "archived" : "active", page_slug: slug, page_template: template });
 if(error) redirect("/admin/businesses/"+businessId+"?error=save");
 revalidatePath("/admin");revalidatePath("/b/"+slug);redirect("/admin/businesses/"+businessId+"?saved=1");
}

export async function saveSection(fd:FormData){
 const {supabase}=await requireOwner("edit");const businessId=val(fd,"business_id",50),pageId=val(fd,"page_id",50),sectionId=val(fd,"section_id",50);
 try{
  const kind=val(fd,"kind",30);if(!sectionKinds.includes(kind as any))throw new Error("نوع القسم غير صالح.");
  const content=parseSectionContent(String(fd.get("content")||"{}"));
  const title=val(fd,"title",80);
  const {error}=await supabase.from("page_sections").update({title,kind,content,enabled:fd.get("enabled")==="on",updated_at:new Date().toISOString()}).eq("id",sectionId).eq("page_id",pageId);
  if(error)throw new Error("تعذر حفظ القسم.");
 }catch(e){captureOperationError(e, "admin.section.save");redirect("/admin/businesses/"+businessId+"?error="+encodeURIComponent(e instanceof Error?e.message:"بيانات غير صالحة"));}
 revalidatePath("/admin/businesses/"+businessId);redirect("/admin/businesses/"+businessId+"?section=saved");
}
export async function addSection(fd:FormData){
 const {supabase}=await requireOwner("edit");const businessId=val(fd,"business_id",50),pageId=val(fd,"page_id",50),kind=val(fd,"new_kind",30);
 if(!sectionKinds.includes(kind as any))redirect("/admin/businesses/"+businessId+"?error=kind");
 const {data:existing}=await supabase.from("page_sections").select("section_key,position").eq("page_id",pageId).order("position",{ascending:false}).limit(1).maybeSingle();
 let key=kind, suffix=2;
 const {data:all}=await supabase.from("page_sections").select("section_key").eq("page_id",pageId);
 while((all||[]).some((s:any)=>s.section_key===key)){key=kind+"_"+suffix++;}
 const title=kind[0].toUpperCase()+kind.slice(1);
 const {error}=await supabase.from("page_sections").insert({page_id:pageId,section_key:key,kind,title,position:(existing?.position??-1)+1,content:defaults[kind]||{},enabled:true});
 if(error)redirect("/admin/businesses/"+businessId+"?error=add");
 revalidatePath("/admin/businesses/"+businessId);redirect("/admin/businesses/"+businessId+"?section=added");
}
export async function removeSection(fd:FormData){
 const {supabase}=await requireOwner("edit");const businessId=val(fd,"business_id",50),pageId=val(fd,"page_id",50),sectionId=val(fd,"section_id",50);
 const {error}=await supabase.from("page_sections").delete().eq("id",sectionId).eq("page_id",pageId);
 if(error)redirect("/admin/businesses/"+businessId+"?error=remove");
 revalidatePath("/admin/businesses/"+businessId);redirect("/admin/businesses/"+businessId+"?section=removed");
}
export async function reorderSections(fd:FormData){
 const {supabase}=await requireOwner("edit");
 const businessId=val(fd,"business_id",50),pageId=val(fd,"page_id",50);
 const orderedSectionIds=fd.getAll("ordered_section_ids").map(String);
 if(!pageId||orderedSectionIds.length===0)redirect("/admin/businesses/"+businessId+"?error=reorder");
 const {error}=await supabase.rpc("reorder_page_sections",{target_page_id:pageId,ordered_section_ids:orderedSectionIds});
 if(error)redirect("/admin/businesses/"+businessId+"?error=reorder");
 revalidatePath("/admin/businesses/"+businessId);revalidatePath("/admin/businesses/"+businessId+"/preview");
 redirect("/admin/businesses/"+businessId+"?sections=reordered");
}
export async function publishPage(fd:FormData){
 const {supabase}=await requireOwner("publish");const businessId=val(fd,"business_id",50),pageId=val(fd,"page_id",50);
 const {error}=await supabase.rpc("publish_page",{target_page_id:pageId});
 if(error)redirect("/admin/businesses/"+businessId+"?error=publish");
 revalidatePath("/b/[slug]","page");revalidatePath("/admin/businesses/"+businessId);redirect("/admin/businesses/"+businessId+"?published=1");
}
export async function setPageActive(fd:FormData){
 const {supabase}=await requireOwner("publish");const businessId=val(fd,"business_id",50),pageId=val(fd,"page_id",50),active=fd.get("active")==="true";
 const {error}=await supabase.from("business_pages").update({is_active:active,updated_at:new Date().toISOString()}).eq("id",pageId);
 if(error)redirect("/admin/businesses/"+businessId+"?error=status");
 revalidatePath("/admin/businesses/"+businessId);redirect("/admin/businesses/"+businessId);
}
export async function createBranch(fd:FormData){
 const {supabase}=await requireOwner("edit");const businessId=val(fd,"business_id",50),parentId=val(fd,"parent_page_id",50),slug=val(fd,"slug",60).toLowerCase(),branchName=val(fd,"branch_name",100);
 if(!slugSchema.safeParse(slug).success||!branchName)redirect("/admin/businesses/"+businessId+"?error=branch");
 const { error } = await supabase.rpc("create_admin_page", { request_key: randomUUID(), details: { businessId, parentId, slug, branchName }, seeds: [{ kind:"hero", title:branchName, enabled:true, content:defaults.hero }, { kind:"contact", title:"تواصل معنا", enabled:true, content:defaults.contact }] });
 if(error)redirect("/admin/businesses/"+businessId+"?error=branch");
 revalidatePath("/admin/businesses/"+businessId);redirect("/admin/businesses/"+businessId+"?branch=created");
}
export async function createBatch(fd:FormData){
 const {supabase}=await requireOwner("inventory");
 const name=String(fd.get("name")||"").trim();
 const quantity=Number(fd.get("quantity"));
 const requestKey=String(fd.get("idempotency_key")||"");
 if(name.length<1||name.length>100||/[\u0000-\u001f\u007f]/.test(name))redirect("/admin/cards?error=name");
 if(!Number.isInteger(quantity)||quantity<1||quantity>1000)redirect("/admin/cards?error=quantity");
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey))redirect("/admin/cards?error=request");
 const tokens=Array.from({length:quantity},()=>randomBytes(24).toString("base64url"));
 const {data:batch,error}=await supabase.rpc("create_card_batch",{batch_name:name,card_quantity:quantity,request_key:requestKey,card_tokens:tokens});
 if(error||!batch?.id)redirect("/admin/cards?error=batch");
 revalidatePath("/admin/cards");
 redirect("/admin/cards/batches/"+batch.id+"?created=1");
}
