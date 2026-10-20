import Link from "next/link";
import { compileContact } from "@/lib/business/contact";
import { requireOwner } from "@/lib/auth/owner";
import { PublicSnapshot } from "@/components/business/public-snapshot";
import { loadBusinessEditorPages, type BusinessEditorPageRow } from "@/lib/business/business-editor-pages";
export const dynamic="force-dynamic";
export default async function Preview({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{page?:string}>}) {
 const {id}=await params,{page:pageId}=await searchParams,{supabase}=await requireOwner();
 const {data:pages}=await loadBusinessEditorPages(columns => supabase.from("business_pages").select(columns).eq("id",pageId||"").eq("business_id",id).order("created_at") as unknown as PromiseLike<{ data: BusinessEditorPageRow[] | null; error: { code?: string; message?: string } | null }>);
 const page=pages?.[0];
 if(!page)return <div className="form-card">لا توجد صفحة للمعاينة.</div>;
 const {data:business}=await supabase.from("businesses").select("name,category").eq("id",id).single();
 const { data: sectionRows } = await supabase.from("page_sections").select("*").eq("page_id",page.id).order("position");
 const raw:any=page;const snapshot={business:business||undefined,page:{slug:raw.slug,template:raw.template,type:raw.page_type,branchName:raw.branch_name},sections:(sectionRows||[])};
 let contact; try {contact=compileContact(raw.contact_config,snapshot);} catch { /* Invalid drafts stay private and text-only. */ }
 return <><div className="preview-bar">معاينة خاصة بالمالك · هذه المسودة غير منشورة للعامة <Link href={"/admin/businesses/"+id}>العودة للمحرر</Link></div><PublicSnapshot snapshot={{...snapshot,contact}}/></>;
}
