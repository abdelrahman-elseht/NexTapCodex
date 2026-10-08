"use server";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/owner";
import { parseSectionContent, sectionKinds, templates } from "@/lib/content";
import { z } from "zod";

const slugSchema=z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?[a-z0-9]$/,"استخدم أحرفاً صغيرة وأرقاماً وشرطات فقط.");
function val(fd:FormData,key:string,max=200){return String(fd.get(key)||"").trim().slice(0,max)}
const defaults:Record<string,unknown>={
 hero:{tagline:"",description:"",coverUrl:"",logoUrl:"",color:"#bb9659",language:"ar"},
 about:{description:""},hours:{items:[]},contact:{phone:"",whatsapp:"",email:"",address:"",mapsUrl:""},
 social:{items:[]},payments:{items:[]},links:{items:[]},services:{items:[]},gallery:{items:[]},reviews:{url:""},branch:{items:[]}
};
export async function createBusiness(fd:FormData){
 const {supabase}=await requireOwner();
 const name=val(fd,"name",120),category=val(fd,"category",80),slug=val(fd,"slug",60).toLowerCase(),template=val(fd,"template",20);
 if(name.length<1||!slugSchema.safeParse(slug).success||!templates.includes(template as any)) redirect("/admin/businesses/new?error=validation");
 const {data:b,error:be}=await supabase.from("businesses").insert({name,category:category||"business"}).select("id").single();
 if(be||!b) redirect("/admin/businesses/new?error=database");
 const {data:p,error:pe}=await supabase.from("business_pages").insert({business_id:b.id,slug,template}).select("id").single();
 if(pe||!p){await supabase.from("businesses").delete().eq("id",b.id);redirect("/admin/businesses/new?error=slug");}
 const seeds=Object.entries(defaults).map(([kind,content],position)=>({page_id:p.id,section_key:kind,title:kind==="hero"?"الرئيسية":kind==="about"?"عن النشاط":kind==="hours"?"مواعيد العمل":kind==="contact"?"تواصل معنا":kind==="social"?"تابعنا":kind==="payments"?"طرق الدفع":kind==="links"?"روابط مهمة":kind==="services"?"الخدمات":kind==="gallery"?"معرض الصور":kind==="reviews"?"آراء العملاء":"الفروع",position,kind,content,enabled:kind!=="branch"}));
 await supabase.from("page_sections").insert(seeds);
 await supabase.from("audit_logs").insert({actor_id:(await supabase.auth.getClaims()).data?.claims?.sub,action:"business.create",entity_type:"business",entity_id:b.id});
 revalidatePath("/admin");redirect("/admin/businesses/"+b.id+"?created=1");
}
export async function saveBusiness(fd:FormData){
 const {supabase}=await requireOwner();
 const businessId=val(fd,"business_id",50),pageId=val(fd,"page_id",50),name=val(fd,"name",120),category=val(fd,"category",80),slug=val(fd,"slug",60).toLowerCase(),template=val(fd,"template",20);
 if(!name||!slugSchema.safeParse(slug).success||!templates.includes(template as any)) redirect("/admin/businesses/"+businessId+"?error=validation");
 const {error:be}=await supabase.from("businesses").update({name,category,status:fd.get("archive")==="on"?"archived":"active",updated_at:new Date().toISOString()}).eq("id",businessId);
 const {error:pe}=await supabase.from("business_pages").update({slug,template,updated_at:new Date().toISOString()}).eq("id",pageId);
 if(be||pe) redirect("/admin/businesses/"+businessId+"?error=save");
 revalidatePath("/admin");revalidatePath("/b/"+slug);redirect("/admin/businesses/"+businessId+"?saved=1");
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
