import Link from "next/link";
import { requireOwner } from "@/lib/auth/owner";
export default async function AdminHome() {
  const {supabase}=await requireOwner();
  const [businesses,cards,pages]=await Promise.all([
    supabase.from("businesses").select("id,name,category,status,created_at").order("created_at",{ascending:false}),
    supabase.from("cards").select("id,status",{count:"exact",head:true}),
    supabase.from("business_pages").select("id,is_active",{count:"exact",head:true})
  ]);
  const rows=businesses.data||[];
  return <><div className="admin-title"><div><span className="eyebrow">مساحة المالك</span><h1>لوحة التحكم</h1></div><Link className="button gold" href="/admin/businesses/new">+ نشاط جديد</Link></div>
    <section className="stats"><div className="stat"><span>الأنشطة</span><strong>{rows.length}</strong></div><div className="stat"><span>البطاقات</span><strong>{cards.count||0}</strong></div><div className="stat"><span>الصفحات النشطة</span><strong>{pages.count||0}</strong></div></section>
    <h2>الأنشطة التجارية</h2>{rows.length?<div className="table-wrap"><table><thead><tr><th>النشاط</th><th>التصنيف</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>{rows.map((b:any)=><tr key={b.id}><td><strong>{b.name}</strong></td><td>{b.category}</td><td><span className={"pill "+(b.status==="active"?"green":"")}>{b.status==="active"?"نشط":"مؤرشف"}</span></td><td><Link className="button secondary" href={"/admin/businesses/"+b.id}>إدارة الصفحة</Link></td></tr>)}</tbody></table></div>:<div className="form-card"><p>لا توجد أنشطة بعد. أضف نشاطك الأول لبدء إنشاء صفحته وبطاقاته.</p><Link className="button" href="/admin/businesses/new">إضافة نشاط</Link></div>}</>;
}