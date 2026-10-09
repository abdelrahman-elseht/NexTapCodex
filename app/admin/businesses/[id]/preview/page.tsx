import Link from "next/link";
import { requireOwner } from "@/lib/auth/owner";
import { PublicSnapshot } from "@/components/public-snapshot";
export const dynamic="force-dynamic";
export default async function Preview({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{page?:string}>}) {
 const {id}=await params,{page:pageId}=await searchParams,{supabase}=await requireOwner();
 const {data:page}=await supabase.from("business_pages").select("id,slug,template,page_type,branch_name,businesses(name,category)").eq("id",pageId||"").eq("business_id",id).single();
 if(!page)return <div className="form-card">لا توجد صفحة للمعاينة.</div>;
 const { data: sectionRows } = await supabase.from("page_sections").select("*").eq("page_id",page.id).order("position");
 const raw:any=page;const snapshot={business:Array.isArray(raw.businesses)?raw.businesses[0]:raw.businesses,page:{slug:raw.slug,template:raw.template,type:raw.page_type,branchName:raw.branch_name},sections:(sectionRows||[])};
 return <><div className="preview-bar">معاينة خاصة بالمالك · هذه المسودة غير منشورة للعامة <Link href={"/admin/businesses/"+id}>العودة للمحرر</Link></div><PublicSnapshot snapshot={snapshot}/></>;
}
