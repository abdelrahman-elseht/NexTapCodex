import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOwner } from "@/lib/auth/owner";
import { setPageActive, createBranch } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { BusinessEditor } from "../business-editor";

const labels: Record<string, string> = {
  hero: "الرئيسية", about: "عن النشاط", hours: "مواعيد العمل", contact: "التواصل والموقع",
  social: "الشبكات الاجتماعية", payments: "طرق الدفع", links: "روابط إضافية", services: "الخدمات",
  gallery: "معرض الصور", reviews: "التقييمات", branch: "الفروع",
};

export default async function EditBusiness({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase } = await requireOwner();
  let { data: business, error: businessError } = await supabase.from("businesses")
    .select("id,name,category,status,provider_profiles").eq("id", id).maybeSingle();
  if (businessError && /provider_profiles|column|schema cache/i.test(businessError.message || "")) {
    const fallback = await supabase.from("businesses").select("id,name,category,status").eq("id", id).maybeSingle();
    business = fallback.data ? { ...fallback.data, provider_profiles: null } : null;
    businessError = fallback.error;
  }
  if (businessError) return <section className="editor-panel error-panel" role="alert"><span className="panel-kicker">تعذر تحميل البيانات</span><h1>لم نتمكن من فتح النشاط</h1><p>حدثت مشكلة أثناء تحميل بيانات لوحة التحكم. أعد المحاولة أو ارجع إلى قائمة الأنشطة.</p><Link className="button secondary" href="/admin">العودة إلى لوحة التحكم</Link></section>;
  if (!business) notFound();

  const { data: pages, error: pagesError } = await supabase.from("business_pages")
    .select("id,slug,template,page_type,branch_name,is_active,published_snapshot_id")
    .eq("business_id", id).order("created_at");
  if (pagesError) return <section className="editor-panel error-panel" role="alert"><span className="panel-kicker">تعذر تحميل البيانات</span><h1>لم نتمكن من تحميل صفحات النشاط</h1><p>أعد المحاولة أو ارجع إلى قائمة الأنشطة.</p><Link className="button secondary" href="/admin">العودة إلى لوحة التحكم</Link></section>;
  const page = pages?.[0];
  if (!page) return <section className="editor-panel error-panel" role="alert"><span className="panel-kicker">صفحة غير موجودة</span><h1>لا توجد صفحة لهذا النشاط بعد</h1><p>يمكنك العودة إلى القائمة ومراجعة النشاط.</p><Link className="button secondary" href="/admin/businesses">قائمة الأنشطة</Link></section>;

  const { data: sections, error: sectionError } = await supabase.from("page_sections")
    .select("*").eq("page_id", page.id).order("position");
  const sectionList = sections || [];
  const activeSectionCount = sectionList.filter(section => section.enabled).length;

  return (
    <>
      <header className="business-editor-header">
        <div>
          <Link href="/admin/businesses" className="editor-back">← قائمة الأنشطة</Link>
          <span className="eyebrow">{business.category || "نشاط تجاري"}</span>
          <h1>إدارة {business.name}</h1>
          <p>المسودة والحالة وروابط الصفحة في مكان واحد.</p>
        </div>
        <div className="editor-header-actions">
          <Link className="button secondary" href={"/admin/businesses/" + id + "/preview?page=" + page.id}>معاينة المسودة</Link>
          <Link className="button secondary" href={"/b/" + page.slug} target="_blank" rel="noreferrer">فتح الصفحة العامة ↗</Link>
          <Link className="button secondary" href={"/admin/cards?business=" + id}>بطاقات النشاط</Link>
        </div>
      </header>

      <section className="editor-progress" aria-label="حالة الصفحة">
        <div><span>الأقسام الظاهرة</span><strong>{activeSectionCount} / {sectionList.length}</strong></div>
        <div><span>حالة الصفحة</span><strong className={page.is_active ? "text-green" : "text-red"}>{page.is_active ? "نشطة" : "متوقفة"}</strong></div>
        <div><span>المعرّف العام</span><strong dir="ltr">/b/{page.slug}</strong></div>
      </section>

      {query.error && <div className="alert" role="alert">تعذر إتمام العملية. راجع البيانات وحاول مرة أخرى.</div>}
      {query.published && <div className="alert success" role="status">تم نشر نسخة جديدة من الصفحة.</div>}
      {query.sections === "reordered" && <div className="alert success" role="status">تم حفظ ترتيب الأقسام.</div>}
      {sectionError && <div className="alert" role="alert">تعذر تحميل أقسام الصفحة.</div>}

      <BusinessEditor
        business={{ id: business.id, name: business.name, category: business.category || "", status: business.status, providerProfiles: (business as any).provider_profiles || {} }}
        page={{ id: page.id, slug: page.slug, template: page.template, is_active: page.is_active }}
  sections={sectionList.map((section: any) => ({ id: section.id, section_key: section.section_key, kind: section.content?._editorKind === "quick_actions" && section.kind === "social" ? "quick_actions" : section.kind, title: section.content?._editorKind === "quick_actions" && section.kind === "social" ? "الإجراءات السريعة" : section.title, position: section.position, enabled: section.enabled, content: section.content as Record<string, unknown> }))}
      />

      <section className="editor-panel compact-panel">
        <div><span className="panel-kicker">الظهور للزوار</span><h2>حالة الصفحة</h2><p>{page.is_active ? "الصفحة نشطة ومتاحة للزوار." : "الصفحة متوقفة ولن تظهر للزوار."}</p></div>
        <form action={setPageActive} className="inline">
          <input type="hidden" name="business_id" value={id} /><input type="hidden" name="page_id" value={page.id} /><input type="hidden" name="active" value={page.is_active ? "false" : "true"} />
          <span className={"pill " + (page.is_active ? "green" : "red")}>{page.is_active ? "نشطة" : "متوقفة"}</span><SubmitButton className="button secondary" pendingText="جارٍ التنفيذ...">{page.is_active ? "إيقاف الصفحة" : "تفعيل الصفحة"}</SubmitButton>
        </form>
      </section>

      <section className="editor-panel compact-panel branch-panel">
        <div><span className="panel-kicker">التوسع</span><h2>الفروع</h2><p>أنشئ صفحة مستقلة لكل فرع ضمن النشاط.</p></div>
        <div className="branch-list">
          <form action={createBranch} className="branch-form">
            <input type="hidden" name="business_id" value={id} /><input type="hidden" name="parent_page_id" value={page.id} />
            <div className="form-grid">
              <label className="field">اسم الفرع<input name="branch_name" required maxLength={100} /></label>
              <label className="field">رابط الفرع<input name="slug" required dir="ltr" autoCapitalize="none" pattern="[a-z0-9][a-z0-9-]{1,58}[a-z0-9]" /></label>
            </div>
            <SubmitButton className="button secondary" pendingText="جارٍ التنفيذ...">إنشاء صفحة الفرع</SubmitButton>
          </form>
          {(pages || []).filter((item: any) => item.page_type === "branch").map((item: any) => (
            <p key={item.id}><Link href={"/admin/businesses/" + id + "/preview?page=" + item.id}>{item.branch_name || item.slug} · /b/{item.slug}</Link></p>
          ))}
        </div>
      </section>
    </>
  );
}
