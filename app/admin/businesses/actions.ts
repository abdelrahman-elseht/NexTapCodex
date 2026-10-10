"use server";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";
import { parseSectionContent, sectionKinds, isTemplate, presetSections } from "@/lib/content";
import { destinationStrategyFor, normalizeEgyptianPhone, normalizeInstagram, normalizeProviderValue, normalizeSafeUrl, type ProviderId } from "@/lib/providers";
import { z } from "zod";

const slugSchema=z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?[a-z0-9]$/,"استخدم أحرفاً صغيرة وأرقاماً وشرطات فقط.");
function val(fd:FormData,key:string,max=200){return String(fd.get(key)||"").trim().slice(0,max)}
const defaults:Record<string,unknown>={
 hero:{tagline:"",description:"",coverUrl:"",logoUrl:"",color:"#7a2028",language:"en",ctaLabel:"",ctaUrl:""},
 about:{description:""},hours:{items:[]},contact:{phone:"",whatsapp:"",email:"",address:"",mapsUrl:""},
 quick_actions:{items:[]},social:{items:[]},payments:{items:[]},links:{items:[]},services:{items:[]},gallery:{items:[]},reviews:{url:""},branch:{items:[]}
};
export async function createBusiness(fd:FormData){
 const {supabase}=await requireOwner();
 const name=val(fd,"name",120),category=val(fd,"category",80),slug=val(fd,"slug",60).toLowerCase(),template=val(fd,"template",20);
 if(name.length<1||!slugSchema.safeParse(slug).success||!isTemplate(template)) redirect("/admin/businesses/new?error=validation");
 const {data:b,error:be}=await supabase.from("businesses").insert({name,category:category||"business"}).select("id").single();
 if(be||!b) redirect("/admin/businesses/new?error=database");
 const {data:p,error:pe}=await supabase.from("business_pages").insert({business_id:b.id,slug,template}).select("id").single();
 if(pe||!p){await supabase.from("businesses").delete().eq("id",b.id);redirect("/admin/businesses/new?error=slug");}
 const presetOrder = presetSections(template);
 const orderedKinds = [...presetOrder, ...Object.keys(defaults).filter(kind => !presetOrder.includes(kind))];
 const enabledKinds = new Set(presetOrder);
 const seeds=orderedKinds.map((kind,position)=>({page_id:p.id,section_key:kind,title:kind==="hero"?"الرئيسية":kind==="about"?"عن النشاط":kind==="hours"?"مواعيد العمل":kind==="contact"?"تواصل معنا":kind==="quick_actions"?"الإجراءات السريعة":kind==="social"?"تابعنا":kind==="payments"?"طرق الدفع":kind==="links"?"روابط مهمة":kind==="services"?"الخدمات":kind==="gallery"?"معرض الصور":kind==="reviews"?"آراء العملاء":"الفروع",position,kind,content:defaults[kind],enabled:enabledKinds.has(kind)}));
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
 const {supabase}=await requireOwner();
 const businessId=val(fd,"business_id",50),pageId=val(fd,"page_id",50),name=val(fd,"name",120),category=val(fd,"category",80),slug=val(fd,"slug",60).toLowerCase(),template=val(fd,"template",20);
 if(!name||!slugSchema.safeParse(slug).success||!isTemplate(template)) redirect("/admin/businesses/"+businessId+"?error=validation");
 const {error:be}=await supabase.from("businesses").update({name,category,status:fd.get("archive")==="on"?"archived":"active",updated_at:new Date().toISOString()}).eq("id",businessId);
 const {error:pe}=await supabase.from("business_pages").update({slug,template,updated_at:new Date().toISOString()}).eq("id",pageId);
 if(be||pe) redirect("/admin/businesses/"+businessId+"?error=save");
 revalidatePath("/admin");revalidatePath("/b/"+slug);redirect("/admin/businesses/"+businessId+"?saved=1");
}

type DraftSection = { id?: string; section_key?: string; key: string; kind: string; title: string; position: number; enabled: boolean; content: Record<string, unknown> };
type DraftProviderProfile = { value?: string; url?: string; destinationStrategy?: string };
function parseDraft(fd: FormData) {
 const raw = String(fd.get("draft") || "{}");
 const parsed = JSON.parse(raw) as { businessId?: string; pageId?: string; name?: string; category?: string; slug?: string; template?: string; archived?: boolean; sections?: DraftSection[]; providerProfiles?: Record<string, DraftProviderProfile> };
 const name = String(parsed.name || "").trim().slice(0, 120);
 const category = String(parsed.category || "business").trim().slice(0, 80) || "business";
 const slug = String(parsed.slug || "").trim().toLowerCase();
 const template = String(parsed.template || "professional");
 if (!parsed.businessId || !parsed.pageId || !name || !slugSchema.safeParse(slug).success || !isTemplate(template)) throw new Error("Check the business name, slug and template.");
 const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
 if (!sections.some(section => section.kind === "hero")) throw new Error("A page needs a hero section.");
 const cleanSections = sections.map((section, index) => {
   if (!section || !sectionKinds.includes(section.kind as any)) throw new Error("Unsupported section type.");
   const key = String(section.section_key || section.key || section.kind).toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40) || `section_${index + 1}`;
   const content = section.content && typeof section.content === "object" ? cleanSectionContent(section.content as Record<string, unknown>) : {};
   // Run the same URL/item checks used by the legacy section form.
   parseSectionContent(JSON.stringify(content));
   return { key, kind: section.kind, title: String(section.title || section.kind).trim().slice(0, 80), position: index, enabled: Boolean(section.enabled), content };
 });
 const providerProfiles = Object.fromEntries(Object.entries(parsed.providerProfiles || {}).slice(0, 40).map(([provider, profile]) => [provider.slice(0, 40), {
   value: String(profile?.value || "").trim().slice(0, 500) || undefined,
   url: String(profile?.url || "").trim().slice(0, 2048) || undefined,
   destinationStrategy: destinationStrategyFor(provider, profile?.destinationStrategy, profile?.url),
 }]));
 return { businessId: parsed.businessId, pageId: parsed.pageId, name, category, slug, template, archived: Boolean(parsed.archived), sections: cleanSections, providerProfiles };
}

function cleanSectionContent(content: Record<string, unknown>): Record<string, unknown> {
 const next: Record<string, unknown> = { ...content };
 for (const [key, value] of Object.entries(next)) {
  if (!Array.isArray(value)) continue;
  next[key] = value.filter(raw => {
   if (!raw || typeof raw !== "object") return false;
   const item = raw as Record<string, unknown>;
   // Empty rows are editor placeholders; omit them from the persisted snapshot.
    return [item.label, item.url, item.value, item.provider, item.icon].some(part => typeof part === "string" && part.trim());
  }).map(raw => {
   const item = raw as Record<string, unknown>;
   const provider = typeof item.provider === "string" ? item.provider.trim().slice(0, 40) : undefined;
   const label = String(item.label || "").trim().slice(0, 80);
   const valueText = String(item.value || "").trim().slice(0, 500);
   const url = String(item.url || "").trim().slice(0, 2048);
   if (provider === "call" || provider === "phone") {
    if (valueText && !normalizeEgyptianPhone(valueText)) throw new Error("Use a valid Egyptian phone number for this action.");
   } else if (provider === "whatsapp") {
    if (valueText && !normalizeEgyptianPhone(valueText) && !normalizeSafeUrl(url)) throw new Error("Use a valid WhatsApp number or destination URL.");
   } else if (provider === "instagram") {
    if (valueText && !normalizeInstagram(valueText)) throw new Error("Use a valid Instagram handle or URL.");
   } else if (["facebook","tiktok","youtube","snapchat","x","linkedin","telegram","website","maps","reviews","booking","order","location","menu","custom"].includes(provider || "")) {
    if (url && !normalizeSafeUrl(url) && !(provider === "custom" && url.startsWith("/") && !url.startsWith("//") && !url.includes(".."))) throw new Error("Use a complete https:// destination URL.");
   } else if (provider === "instapay" && valueText && !normalizeProviderValue("instapay" as ProviderId, valueText)) {
    throw new Error("Use an InstaPay ID such as name@provider.");
   } else if (provider === "vodafone" && valueText && !normalizeEgyptianPhone(valueText)) {
    throw new Error("Use a valid Egyptian wallet number for Vodafone Cash.");
   }
    const destinationStrategy = destinationStrategyFor(provider, typeof item.destinationStrategy === "string" ? item.destinationStrategy : undefined, url);
    return { label, value: valueText, url, alt: typeof item.alt === "string" ? item.alt.trim().slice(0, 200) : undefined, provider, destinationStrategy, profileOverride: item.profileOverride === true, enabled: item.enabled !== false, icon: typeof item.icon === "string" ? item.icon.trim().slice(0, 40) : undefined };
  });
 }
 return next;
}

async function persistDraft(supabase: Awaited<ReturnType<typeof requireOwner>>["supabase"], draft: ReturnType<typeof parseDraft>) {
 const payload = {
  target_business_id: draft.businessId,
  target_page_id: draft.pageId,
  business_name: draft.name,
  business_category: draft.category,
  business_status: draft.archived ? "archived" : "active",
  page_slug: draft.slug,
  page_template: draft.template,
  section_rows: draft.sections.map(section => ({ section_key: section.key, kind: section.kind, title: section.title, position: section.position, enabled: section.enabled, content: section.content })),
  target_provider_profiles: draft.providerProfiles,
 };
 let { error } = await supabase.rpc("save_page_draft", payload);
 // Older isolated projects do not yet expose the provider profile argument;
 // section-level resolved values keep those projects fully compatible.
 if (error && /target_provider_profiles|function .*save_page_draft|does not exist/i.test(error.message || "")) {
  const legacyPayload = { ...payload };
  delete (legacyPayload as Record<string, unknown>).target_provider_profiles;
  ({ error } = await supabase.rpc("save_page_draft", legacyPayload));
 }
 // Retry against an older isolated schema whose CHECK constraint predates
 // quick_actions. The marker is normalized back into Quick Actions in the
 // editor and public renderer, so the owner never loses the intended section.
 if (error?.code === "23514" || /page_sections|quick_actions|kind.check/i.test(error?.message || "")) {
  const legacyRows = draft.sections.map(section => section.kind === "quick_actions"
   ? { section_key: section.key, kind: "social", title: "الإجراءات السريعة", position: section.position, enabled: section.enabled, content: { ...section.content, _editorKind: "quick_actions" } }
   : { section_key: section.key, kind: section.kind, title: section.title, position: section.position, enabled: section.enabled, content: section.content });
  ({ error } = await supabase.rpc("save_page_draft", { ...payload, section_rows: legacyRows }));
 }
 if (error) throw new Error(error.message || "Could not save draft.");
 // A verification/network failure must never delete a committed draft.
 const { data: savedRows, error: verifyError } = await supabase.from("page_sections").select("section_key,kind,content,position").eq("page_id", draft.pageId).order("position");
 if (verifyError || !savedRows || savedRows.length !== draft.sections.length || savedRows.some((row, index) => row.section_key !== draft.sections[index].key || row.position !== index)) {
  throw new Error("Could not verify the saved draft. Your edits are preserved; retry Save draft.");
 }
}

/** Persist a complete local editor draft without redirecting or publishing it. */
export async function saveDraftState(fd: FormData): Promise<{ ok: boolean; error?: string }> {
 try {
  const { supabase } = await requireOwner();
  const draft = parseDraft(fd);
  await persistDraft(supabase, draft);
  revalidatePath("/admin/businesses/" + draft.businessId);
  revalidatePath("/admin/businesses/" + draft.businessId + "/preview");
  return { ok: true };
 } catch (error) {
  return { ok: false, error: error instanceof Error ? error.message : "Could not save draft." };
 }
}

/** Save the local draft and publish the validated snapshot in one explicit action. */
export async function publishDraftState(fd: FormData): Promise<{ ok: boolean; error?: string; version?: number }> {
 try {
  const { supabase } = await requireOwner();
  const draft = parseDraft(fd);
  await persistDraft(supabase, draft);
  const { data, error } = await supabase.rpc("publish_page", { target_page_id: draft.pageId });
  if (error) throw new Error("Could not publish this page.");
  revalidatePath("/b/[slug]", "page");
  revalidatePath("/admin/businesses/" + draft.businessId);
  return { ok: true, version: typeof data?.version === "number" ? data.version : undefined };
 } catch (error) {
  return { ok: false, error: error instanceof Error ? error.message : "Could not publish this page." };
 }
}
export async function saveSection(fd:FormData){
 const {supabase}=await requireOwner();const businessId=val(fd,"business_id",50),pageId=val(fd,"page_id",50),sectionId=val(fd,"section_id",50);
 try{
  const kind=val(fd,"kind",30);if(!sectionKinds.includes(kind as any))throw new Error("نوع القسم غير صالح.");
  const content=parseSectionContent(String(fd.get("content")||"{}"));
  const title=val(fd,"title",80);
  const {error}=await supabase.from("page_sections").update({title,kind,content,enabled:fd.get("enabled")==="on",updated_at:new Date().toISOString()}).eq("id",sectionId).eq("page_id",pageId);
  if(error)throw new Error("تعذر حفظ القسم.");
 }catch(e){redirect("/admin/businesses/"+businessId+"?error="+encodeURIComponent(e instanceof Error?e.message:"بيانات غير صالحة"));}
 revalidatePath("/admin/businesses/"+businessId);redirect("/admin/businesses/"+businessId+"?section=saved");
}
export async function addSection(fd:FormData){
 const {supabase}=await requireOwner();const businessId=val(fd,"business_id",50),pageId=val(fd,"page_id",50),kind=val(fd,"new_kind",30);
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
 const {supabase}=await requireOwner();const businessId=val(fd,"business_id",50),pageId=val(fd,"page_id",50),sectionId=val(fd,"section_id",50);
 const {error}=await supabase.from("page_sections").delete().eq("id",sectionId).eq("page_id",pageId);
 if(error)redirect("/admin/businesses/"+businessId+"?error=remove");
 revalidatePath("/admin/businesses/"+businessId);redirect("/admin/businesses/"+businessId+"?section=removed");
}
export async function reorderSections(fd:FormData){
 const {supabase}=await requireOwner();
 const businessId=val(fd,"business_id",50),pageId=val(fd,"page_id",50);
 const orderedSectionIds=fd.getAll("ordered_section_ids").map(String);
 if(!pageId||orderedSectionIds.length===0)redirect("/admin/businesses/"+businessId+"?error=reorder");
 const {error}=await supabase.rpc("reorder_page_sections",{target_page_id:pageId,ordered_section_ids:orderedSectionIds});
 if(error)redirect("/admin/businesses/"+businessId+"?error=reorder");
 revalidatePath("/admin/businesses/"+businessId);revalidatePath("/admin/businesses/"+businessId+"/preview");
 redirect("/admin/businesses/"+businessId+"?sections=reordered");
}
export async function publishPage(fd:FormData){
 const {supabase}=await requireOwner();const businessId=val(fd,"business_id",50),pageId=val(fd,"page_id",50);
 const {error}=await supabase.rpc("publish_page",{target_page_id:pageId});
 if(error)redirect("/admin/businesses/"+businessId+"?error=publish");
 revalidatePath("/b/[slug]","page");revalidatePath("/admin/businesses/"+businessId);redirect("/admin/businesses/"+businessId+"?published=1");
}
export async function setPageActive(fd:FormData){
 const {supabase}=await requireOwner();const businessId=val(fd,"business_id",50),pageId=val(fd,"page_id",50),active=fd.get("active")==="true";
 const {error}=await supabase.from("business_pages").update({is_active:active,updated_at:new Date().toISOString()}).eq("id",pageId);
 if(error)redirect("/admin/businesses/"+businessId+"?error=status");
 revalidatePath("/admin/businesses/"+businessId);redirect("/admin/businesses/"+businessId);
}
export async function createBranch(fd:FormData){
 const {supabase}=await requireOwner();const businessId=val(fd,"business_id",50),parentId=val(fd,"parent_page_id",50),slug=val(fd,"slug",60).toLowerCase(),branchName=val(fd,"branch_name",100);
 if(!slugSchema.safeParse(slug).success||!branchName)redirect("/admin/businesses/"+businessId+"?error=branch");
 const {data:parent}=await supabase.from("business_pages").select("template").eq("id",parentId).single();
 const {data:page,error}=await supabase.from("business_pages").insert({business_id:businessId,parent_page_id:parentId,page_type:"branch",branch_name:branchName,slug,template:parent?.template||"professional"}).select("id").single();
 if(error||!page)redirect("/admin/businesses/"+businessId+"?error=branch");
 await supabase.from("page_sections").insert([{page_id:page.id,section_key:"hero",kind:"hero",title:branchName,position:0,content:defaults.hero},{page_id:page.id,section_key:"contact",kind:"contact",title:"تواصل معنا",position:1,content:defaults.contact}]);
 revalidatePath("/admin/businesses/"+businessId);redirect("/admin/businesses/"+businessId+"?branch=created");
}
export async function createBatch(fd:FormData){
 const {supabase}=await requireOwner();
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
export async function assignCard(fd:FormData){
 const {supabase}=await requireOwner();const cardId=val(fd,"card_id",50),pageId=val(fd,"page_id",50),mode=val(fd,"mode",20),businessId=val(fd,"business_id",50);
 if(fd.get("confirm")!=="on")redirect("/admin/cards?error=confirmation");
 const nextStatus=mode==="disable"?"disabled":"active";
 const {error}=await supabase.rpc("assign_card",{card_id:cardId,target_page_id:mode==="disable"?null:pageId,next_status:nextStatus,change_reason:mode==="disable"?"deactivation":"reassignment"});
 if(error)redirect("/admin/cards?error=assignment");
 revalidatePath("/admin/cards");redirect("/admin/cards?assigned=1"+(businessId?"&business="+businessId:""));
}
