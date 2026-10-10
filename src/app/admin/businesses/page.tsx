import Link from "next/link";
import { requireOwner } from "@/lib/auth/owner";
import { ADMIN_PAGE_SIZE, cursorFilter, cursorForRow, decodePageCursor, encodePageCursor, pageUrl } from "@/lib/admin/pagination";

export const dynamic = "force-dynamic";

export default async function Businesses({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const search = (query.search || "").trim().slice(0, 80);
  const status = query.status === "active" || query.status === "archived" ? query.status : "";
  const direction = query.direction === "previous" ? "previous" : "next";
  const cursor = decodePageCursor(query.cursor);
  const { supabase } = await requireOwner();
  let request = supabase.from("businesses").select("id,name,category,status,created_at").order("created_at", { ascending: direction === "previous" }).order("id", { ascending: direction === "previous" }).limit(ADMIN_PAGE_SIZE + 1);
  if (search) request = request.ilike("name", "%" + search.replace(/[%_]/g, "") + "%");
  if (status) request = request.eq("status", status);
  if (cursor) request = request.or(cursorFilter(cursor, direction));
  const { data, error } = await request;
  let rows = data || [];
  const hasMore = rows.length > ADMIN_PAGE_SIZE;
  if (hasMore) rows = rows.slice(0, ADMIN_PAGE_SIZE);
  if (direction === "previous") rows.reverse();
  const first = rows[0];
  const last = rows[rows.length - 1];
  const filters = { search: search || undefined, status: status || undefined };
  const nextHref = hasMore && last ? pageUrl("/admin/businesses", { ...filters, cursor: encodePageCursor(cursorForRow(last)), direction: "next" }) : undefined;
  const previousHref = cursor && first ? pageUrl("/admin/businesses", { ...filters, cursor: encodePageCursor(cursorForRow(first)), direction: "previous" }) : undefined;
  return <>
    <header className="admin-title"><div><h1>الأنشطة التجارية</h1><p>إدارة الملفات والصفحات المنشورة والفروع من مكان واحد.</p></div><Link className="button gold" href="/admin/businesses/new">إضافة نشاط</Link></header>
    {error && <div className="alert" role="alert">تعذر تحميل قائمة الأنشطة. أعد المحاولة بعد قليل.</div>}
    <section className="filter-panel" aria-label="تصفية الأنشطة"><form action="/admin/businesses" method="get" className="business-filters"><label className="field">اسم النشاط<input name="search" type="search" defaultValue={search} maxLength={80} placeholder="ابحث بالاسم" dir="auto" /></label><label className="field">الحالة<select name="status" defaultValue={status}><option value="">كل الحالات</option><option value="active">نشط</option><option value="archived">مؤرشف</option></select></label><div className="inline"><button className="button">تصفية</button><Link className="button secondary" href="/admin/businesses">مسح</Link></div></form></section>
    <div className="admin-section-title"><div><h2>{rows.length} نشاط معروض</h2><p>صفحات من 25 نتيجة، مرتبة بثبات من الأحدث.</p></div></div>
    {rows.length ? <div className="table-wrap"><table><thead><tr><th>النشاط</th><th>التصنيف</th><th>أُنشئ في</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>{rows.map((business: any) => <tr key={business.id}><td><strong>{business.name}</strong></td><td>{business.category || "—"}</td><td>{new Date(business.created_at).toLocaleDateString("ar-EG")}</td><td><span className={"pill " + (business.status === "active" ? "green" : "")}>{business.status === "active" ? "نشط" : "مؤرشف"}</span></td><td><Link className="button secondary" href={"/admin/businesses/" + business.id}>فتح الإدارة</Link></td></tr>)}</tbody></table></div> : <div className="empty-state"><h2>{search || status ? "لا توجد نتائج مطابقة" : "لا توجد أنشطة بعد"}</h2><p>{search || status ? "غيّر كلمات البحث أو أزل التصفية لعرض أنشطة أخرى." : "أنشئ ملف النشاط الأول، ثم أضف الأقسام وأرسل الصفحة للمعاينة."}</p>{search || status ? <Link className="button secondary" href="/admin/businesses">مسح التصفية</Link> : <Link className="button gold" href="/admin/businesses/new">إنشاء نشاط</Link>}</div>}
    {(nextHref || previousHref || cursor) && <nav className="pagination" aria-label="تنقل قائمة الأنشطة"><Link className={previousHref ? "button secondary" : "button secondary disabled"} aria-disabled={!previousHref} href={previousHref || "/admin/businesses"}>السابق</Link><Link className="button secondary" href="/admin/businesses">الأولى</Link><Link className={nextHref ? "button secondary" : "button secondary disabled"} aria-disabled={!nextHref} href={nextHref || pageUrl("/admin/businesses", filters)}>التالي</Link></nav>}
  </>;
}
