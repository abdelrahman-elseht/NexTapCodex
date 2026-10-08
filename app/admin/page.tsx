import Link from "next/link";
import { requireOwner } from "@/lib/auth/owner";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const { supabase } = await requireOwner();
  const [businesses, cards, pages] = await Promise.all([
    supabase.from("businesses").select("id,name,category,status,created_at").order("created_at", { ascending: false }).limit(6),
    supabase.from("cards").select("id", { count: "exact", head: true }),
    supabase.from("business_pages").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);
  const rows = businesses.data || [];

  return (
    <>
      <header className="admin-title">
        <div><h1>لوحة التحكم</h1><p>نظرة سريعة على الأنشطة والصفحات والبطاقات التي يديرها فريقك.</p></div>
        <Link className="button gold" href="/admin/businesses/new">إضافة نشاط</Link>
      </header>

      <section className="stats" aria-label="ملخص التشغيل">
        <div className="stat"><span>الأنشطة التجارية</span><strong>{rows.length}</strong></div>
        <div className="stat"><span>البطاقات المسجلة</span><strong>{cards.count || 0}</strong></div>
        <div className="stat"><span>الصفحات النشطة</span><strong>{pages.count || 0}</strong></div>
      </section>

      <section className="dashboard-tools" aria-label="اختصارات">
        <Link href="/admin/businesses"><strong>إدارة الأنشطة</strong><span>الملفات والصفحات والفروع</span></Link>
        <Link href="/admin/cards"><strong>مخزون البطاقات</strong><span>التعيين والتفعيل والتصدير</span></Link>
      </section>

      <div className="admin-section-title">
        <div><h2>أحدث الأنشطة</h2><p>انتقل مباشرة إلى إعدادات الصفحة أو افتح القائمة الكاملة.</p></div>
        <Link className="small-button" href="/admin/businesses">كل الأنشطة</Link>
      </div>

      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>النشاط</th><th>التصنيف</th><th>الحالة</th><th>الإجراء</th></tr></thead>
            <tbody>{rows.map((business: any) => (
              <tr key={business.id}>
                <td><strong>{business.name}</strong></td>
                <td>{business.category || "—"}</td>
                <td><span className={"pill " + (business.status === "active" ? "green" : "")}>{business.status === "active" ? "نشط" : "مؤرشف"}</span></td>
                <td><Link className="button secondary" href={"/admin/businesses/" + business.id}>إدارة الصفحة</Link></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <h2>ابدأ بإضافة أول نشاط</h2>
          <p>بعد حفظ الاسم والتصنيف، ستُنشأ صفحة يمكنك إضافة محتواها ثم معاينتها ونشرها.</p>
          <Link className="button gold" href="/admin/businesses/new">إنشاء نشاط</Link>
        </div>
      )}
    </>
  );
}
