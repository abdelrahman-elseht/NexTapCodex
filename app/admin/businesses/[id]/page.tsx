import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOwner } from "@/lib/auth/owner";
import { saveBusiness, saveSection, addSection, removeSection, publishPage, setPageActive, createBranch } from "../actions";
import { sectionKinds } from "@/lib/content";
import { SectionOrderList } from "../section-order-list";
import { SectionContentEditor } from "../section-content-editor";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

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
  const { data: business, error: businessError } = await supabase.from("businesses")
    .select("id,name,category,status").eq("id", id).maybeSingle();
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

      <section className="editor-panel" aria-labelledby="business-settings-title">
        <div className="panel-heading">
          <div><h2 id="business-settings-title">ملف النشاط</h2><p>الاسم والتصنيف والرابط والقالب الذي يراه الزائر.</p></div>
        </div>
        <form action={saveBusiness}>
          <input type="hidden" name="business_id" value={id} />
          <input type="hidden" name="page_id" value={page.id} />
          <div className="form-grid">
            <label className="field">اسم النشاط<input name="name" defaultValue={business.name} maxLength={120} required /></label>
            <label className="field">التصنيف<input name="category" defaultValue={business.category || ""} maxLength={80} /></label>
            <label className="field">رابط الصفحة
              <input name="slug" dir="ltr" autoCapitalize="none" defaultValue={page.slug} required pattern="[a-z0-9][a-z0-9-]{1,58}[a-z0-9]" />
              <small>تغيير الرابط ينشئ مساراً جديداً للصفحة، مع استمرار عمل البطاقات المرتبطة بها.</small>
            </label>
            <label className="field">القالب
              <select name="template" defaultValue={page.template}>
                <option value="cafe">مقهى ومطعم</option><option value="retail">متجر وخدمات</option><option value="professional">بسيط واحترافي</option>
              </select>
            </label>
          </div>
          <label className="inline editor-archive"><input type="checkbox" name="archive" defaultChecked={business.status === "archived"} /> أرشفة النشاط وإخفاء صفحاته وبطاقاته</label>
          <div className="panel-footer"><span className="muted">التغييرات لا تظهر للزوار قبل نشرها.</span><SubmitButton className="button secondary" pendingText="جارٍ التنفيذ...">حفظ الإعدادات</SubmitButton></div>
        </form>
      </section>

      <section className="editor-panel content-panel" aria-labelledby="content-editor-title">
        <div className="panel-heading content-panel-heading">
          <div><h2 id="content-editor-title">محتوى الصفحة</h2><p>رتّب الأقسام، عدّل بياناتها، ثم عاين المسودة قبل النشر.</p></div>
          <div className="editor-header-actions">
            <Link className="button secondary" href={"/admin/businesses/" + id + "/preview?page=" + page.id} target="_blank" rel="noreferrer">معاينة المسودة ↗</Link>
            <form action={publishPage}><input type="hidden" name="business_id" value={id} /><input type="hidden" name="page_id" value={page.id} /><SubmitButton className="button gold" pendingText="جارٍ التنفيذ...">نشر التغييرات</SubmitButton></form>
          </div>
        </div>
        <div className="section-order-toolbar"><span>ترتيب العرض</span><span className="muted">اسحب القسم أو استخدم أزرار التحريك.</span></div>
        {sectionList.length ? (
          <SectionOrderList businessId={id} pageId={page.id} sections={sectionList.map((section: any, index: number) => ({
            id: section.id,
            title: labels[section.kind] || section.title,
            children: <details className="editor-section" open={index === 0}>
              <summary><strong>{labels[section.kind] || section.kind} · {section.title}</strong><span className={"pill " + (section.enabled ? "green" : "")}>{section.enabled ? "ظاهر" : "مخفي"}</span><span className="summary-chevron" aria-hidden="true">⌄</span></summary>
              <form action={saveSection} className="section-edit-form">
                <input type="hidden" name="business_id" value={id} /><input type="hidden" name="page_id" value={page.id} /><input type="hidden" name="section_id" value={section.id} />
                <div className="form-grid">
                  <label className="field">عنوان القسم<input name="title" defaultValue={section.title} maxLength={80} /></label>
                </div>
                <SectionContentEditor initialContent={section.content as Record<string, unknown>} kind={section.kind} />
                <div className="section-form-footer">
                  <label className="inline"><input type="checkbox" name="enabled" defaultChecked={section.enabled} /> إظهار القسم</label>
                  <div className="inline"><SubmitButton className="button secondary" pendingText="جارٍ التنفيذ...">حفظ القسم</SubmitButton><ConfirmSubmitButton targetForm={"remove-section-" + section.id} className="small-button danger" dialogLabel="تأكيد" title="حذف القسم" message="هل تريد حذف هذا القسم؟ لا يمكن التراجع عن الحذف." confirmLabel="حذف القسم" cancelLabel="إلغاء" pendingText="جارٍ الحذف...">حذف القسم</ConfirmSubmitButton></div>
                </div>
              </form>
              <form action={removeSection} id={"remove-section-" + section.id}><input type="hidden" name="business_id" value={id} /><input type="hidden" name="page_id" value={page.id} /><input type="hidden" name="section_id" value={section.id} /></form>
            </details>,
          }))} />
        ) : (
          <div className="empty-state"><h3>لا توجد أقسام بعد</h3><p>ابدأ بقسم تعريفي، ثم أضف ساعات العمل والتواصل والخدمات.</p></div>
        )}
        <form action={addSection} className="add-section-form">
          <input type="hidden" name="business_id" value={id} /><input type="hidden" name="page_id" value={page.id} />
          <label className="field">إضافة قسم<select name="new_kind">{sectionKinds.map(kind => <option value={kind} key={kind}>{labels[kind] || kind}</option>)}</select></label>
          <SubmitButton className="button secondary" pendingText="جارٍ التنفيذ...">＋ إضافة قسم</SubmitButton>
        </form>
      </section>

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
