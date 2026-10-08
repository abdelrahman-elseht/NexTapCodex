import Link from "next/link";
import { requireOwner } from "@/lib/auth/owner";
import { saveBusiness, saveSection, addSection, removeSection, publishPage, setPageActive, createBranch } from "../actions";
import { sectionKinds } from "@/lib/content";
import { SectionOrderList } from "../section-order-list";

const labels: Record<string, string> = {
  hero: "الرئيسية", about: "عن النشاط", hours: "مواعيد العمل", contact: "التواصل والموقع",
  social: "الشبكات الاجتماعية", payments: "طرق الدفع", links: "روابط إضافية", services: "الخدمات",
  gallery: "معرض الصور", reviews: "التقييمات", branch: "الفروع",
};

export default async function EditBusiness({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase } = await requireOwner();
  const { data: business, error: businessError } = await supabase.from("businesses").select("id,name,category,status").eq("id", id).maybeSingle();
  if (businessError) return <section className="editor-panel" role="alert"><span className="panel-kicker">تعذر تحميل البيانات</span><h1>لم نتمكن من فتح النشاط</h1><p className="muted">حدثت مشكلة أثناء تحميل بيانات لوحة التحكم. أعد المحاولة أو ارجع إلى قائمة الأنشطة.</p><Link className="button secondary" href="/admin">العودة إلى لوحة التحكم</Link></section>;
  if (!business) return <section className="editor-panel" role="alert"><span className="panel-kicker">النشاط غير موجود</span><h1>لم يتم العثور على هذا النشاط</h1><p className="muted">قد يكون الرابط قديماً، أو لا يملك حسابك صلاحية الوصول إليه.</p><Link className="button secondary" href="/admin">العودة إلى لوحة التحكم</Link></section>;
  const { data: pages, error: pagesError } = await supabase.from("business_pages").select("*").eq("business_id", id).order("page_type");
  if (pagesError) return <section className="editor-panel" role="alert"><span className="panel-kicker">تعذر تحميل البيانات</span><h1>لم نتمكن من تحميل صفحات النشاط</h1><p className="muted">أعد المحاولة أو ارجع إلى قائمة الأنشطة.</p><Link className="button secondary" href="/admin">العودة إلى لوحة التحكم</Link></section>;
  const page = (pages || []).find((item: any) => item.page_type === "main") || pages?.[0];
  if (!page) return <section className="editor-panel" role="alert"><span className="panel-kicker">صفحة غير موجودة</span><h1>لا توجد صفحة لهذا النشاط بعد</h1><p className="muted">ارجع إلى قائمة الأنشطة أو أعد تحميل الصفحة.</p><Link className="button secondary" href="/admin">العودة إلى لوحة التحكم</Link></section>;
  const { data: sections, error: sectionError } = await supabase.from("page_sections").select("*").eq("page_id", page.id).order("position");
  const sectionList = sections || [];

  return <>
    <header className="business-editor-header">
      <div><Link href="/admin" className="editor-back">← لوحة التحكم</Link><span className="eyebrow">{business.category}</span><h1>إدارة {business.name}</h1><p className="muted">تحديث صفحة النشاط ومحتواها وترتيب أقسامها.</p></div>
      <div className="editor-header-actions"><Link className="button secondary" href={`/b/${page.slug}`} target="_blank">فتح الصفحة العامة ↗</Link><Link className="button secondary" href={`/admin/cards?business=${id}`}>بطاقات النشاط</Link></div>
    </header>
    {query.error && <div className="alert" role="alert">تعذر إتمام العملية. راجع البيانات وحاول مرة أخرى.</div>}
    {query.published && <div className="alert success" role="status">تم نشر نسخة جديدة من الصفحة.</div>}
    {query.sections === "reordered" && <div className="alert success" role="status">تم حفظ ترتيب الأقسام.</div>}
    {sectionError && <div className="alert" role="alert">تعذر تحميل أقسام الصفحة.</div>}

    <section className="editor-panel" aria-labelledby="business-settings-title">
      <div className="panel-heading"><div><span className="panel-kicker">إعدادات النشاط</span><h2 id="business-settings-title">الملف والصفحة</h2><p>الاسم والتصنيف والرابط والقالب الذي يظهر للزوار.</p></div><span className="panel-icon" aria-hidden="true">✦</span></div>
      <form action={saveBusiness}>
        <input type="hidden" name="business_id" value={id}/><input type="hidden" name="page_id" value={page.id}/>
        <div className="form-grid"><label className="field">اسم النشاط<input name="name" defaultValue={business.name} maxLength={120} required/></label><label className="field">التصنيف<input name="category" defaultValue={business.category} maxLength={80}/></label><label className="field">رابط الصفحة<input name="slug" dir="ltr" defaultValue={page.slug} required pattern="[a-z0-9][a-z0-9-]{1,58}[a-z0-9]"/></label><label className="field">القالب<select name="template" defaultValue={page.template}><option value="cafe">مقهى ومطعم</option><option value="retail">متجر وخدمات</option><option value="professional">بسيط واحترافي</option></select></label></div>
        <label className="inline editor-archive"><input type="checkbox" name="archive" defaultChecked={business.status === "archived"}/> أرشفة النشاط وإخفاء صفحاته وبطاقاته</label>
        <div className="panel-footer"><span className="muted">التغييرات لا تظهر للزوار قبل نشرها.</span><button className="button secondary">حفظ الإعدادات</button></div>
      </form>
    </section>

    <section className="editor-panel content-panel" aria-labelledby="content-editor-title">
      <div className="panel-heading"><div><span className="panel-kicker">محتوى الصفحة</span><h2 id="content-editor-title">الأقسام وترتيبها</h2><p>اسحب الأقسام لتغيير موضعها، أو استخدم أزرار التحريك. احفظ الترتيب ثم انشر التغييرات.</p></div><div className="editor-header-actions"><Link className="button secondary" href={`/admin/businesses/${id}/preview?page=${page.id}`} target="_blank">معاينة المسودة ↗</Link><form action={publishPage}><input type="hidden" name="business_id" value={id}/><input type="hidden" name="page_id" value={page.id}/><button className="button gold">نشر التغييرات</button></form></div></div>
      <SectionOrderList businessId={id} pageId={page.id} sections={sectionList.map((section: any, index: number) => ({ id: section.id, title: labels[section.kind] || section.title, children: <details className="editor-section" open={index === 0}>
        <summary><strong>{labels[section.kind] || section.kind} · {section.title}</strong><span className={`pill ${section.enabled ? "green" : ""}`}>{section.enabled ? "ظاهر" : "مخفي"}</span><span className="summary-chevron" aria-hidden="true">⌄</span></summary>
        <form action={saveSection} className="section-edit-form"><input type="hidden" name="business_id" value={id}/><input type="hidden" name="page_id" value={page.id}/><input type="hidden" name="section_id" value={section.id}/>
          <div className="form-grid"><label className="field">عنوان القسم<input name="title" defaultValue={section.title} maxLength={80}/></label><label className="field">نوع المحتوى<select name="kind" defaultValue={section.kind}>{sectionKinds.map(kind => <option value={kind} key={kind}>{labels[kind] || kind}</option>)}</select></label></div>
          <label className="field">المحتوى (JSON)<textarea name="content" defaultValue={JSON.stringify(section.content, null, 2)} dir="ltr" spellCheck={false}/><small>استخدم روابط آمنة وعناوين واضحة.</small></label>
          <div className="section-form-footer"><label className="inline"><input type="checkbox" name="enabled" defaultChecked={section.enabled}/> إظهار القسم</label><div className="inline"><button className="button secondary">حفظ القسم</button><button className="small-button danger" type="submit" form={`remove-section-${section.id}`}>حذف القسم</button></div></div>
        </form>
        <form action={removeSection} id={`remove-section-${section.id}`}><input type="hidden" name="business_id" value={id}/><input type="hidden" name="page_id" value={page.id}/><input type="hidden" name="section_id" value={section.id}/></form>
      </details> }))}/>
      <form action={addSection} className="add-section-form"><input type="hidden" name="business_id" value={id}/><input type="hidden" name="page_id" value={page.id}/><label className="field">إضافة قسم<select name="new_kind">{sectionKinds.map(kind => <option value={kind} key={kind}>{labels[kind] || kind}</option>)}</select></label><button className="button secondary">＋ إضافة قسم</button></form>
    </section>

    <section className="editor-panel compact-panel"><div><span className="panel-kicker">حالة الظهور</span><h2>نشر الصفحة</h2><p className="muted">{page.is_active ? "صفحتك مفعّلة ومتاحة للزوار." : "الصفحة متوقفة ولن تظهر للزوار."}</p></div><form action={setPageActive} className="inline"><input type="hidden" name="business_id" value={id}/><input type="hidden" name="page_id" value={page.id}/><input type="hidden" name="active" value={page.is_active ? "false" : "true"}/><span className={`pill ${page.is_active ? "green" : "red"}`}>{page.is_active ? "نشطة" : "متوقفة"}</span><button className="button secondary">{page.is_active ? "إيقاف الصفحة" : "تفعيل الصفحة"}</button></form></section>

    <section className="editor-panel compact-panel"><div className="panel-heading"><div><span className="panel-kicker">التوسع</span><h2>صفحة فرع جديد</h2><p>أنشئ صفحة مستقلة ضمن نشاطك الحالي.</p></div></div><form action={createBranch} className="branch-form"><input type="hidden" name="business_id" value={id}/><input type="hidden" name="parent_page_id" value={page.id}/><div className="form-grid"><label className="field">اسم الفرع<input name="branch_name" required maxLength={100}/></label><label className="field">رابط الفرع<input name="slug" required dir="ltr" pattern="[a-z0-9][a-z0-9-]{1,58}[a-z0-9]"/></label></div><button className="button secondary">إنشاء صفحة الفرع</button></form>{(pages || []).filter((item: any) => item.page_type === "branch").map((item: any) => <p key={item.id}><Link href={`/admin/businesses/${id}/preview?page=${item.id}`}>{item.branch_name} · /b/{item.slug}</Link></p>)}</section>
  </>;
}
