import Link from "next/link";
import { createBusiness } from "../actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { templatePresets } from "@/lib/business/content";

export default async function NewBusiness({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <>
      <header className="admin-title">
        <div><h1>إضافة نشاط جديد</h1><p>أنشئ ملف النشاط وصفحته، ثم أكمل المحتوى في محرر الأقسام.</p></div>
        <Link className="button secondary" href="/admin/businesses">العودة إلى الأنشطة</Link>
      </header>

      {error && <div className="alert" role="alert">
        {error === "slug" ? "هذا الرابط مستخدم بالفعل. اختر رابطاً آخر." : "تعذر إنشاء النشاط. راجع الحقول المطلوبة وحاول مرة أخرى."}
      </div>}

      <form action={createBusiness} className="editor-panel create-business-form">
        <div className="panel-heading">
          <div><h2>بيانات النشاط</h2><p>تظهر هذه المعلومات في صفحة النشاط وعلى لوحة الإدارة.</p></div>
        </div>
        <div className="form-grid">
          <label className="field">اسم النشاط
            <input name="name" required maxLength={120} autoComplete="organization" placeholder="مثال: قهوة ومزاج" />
          </label>
          <label className="field">التصنيف
            <input name="category" maxLength={80} placeholder="مقهى، متجر، خدمات..." />
          </label>
          <label className="field">رابط الصفحة
            <input name="slug" aria-label="رابط الصفحة" required pattern="[a-z0-9][a-z0-9-]{1,58}[a-z0-9]" dir="ltr" autoCapitalize="none" spellCheck={false} placeholder="coffee-and-mood" />
            <small>سيكون الرابط /b/coffee-and-mood. استخدم أحرفاً إنجليزية صغيرة وأرقاماً وشرطة.</small>
          </label>
        </div>

        <fieldset className="template-fieldset">
          <legend>اختر نقطة البداية</legend>
          <div className="template-choice-grid template-choice-grid-four">
            {templatePresets.map((preset, index) => <label className="template-choice" key={preset.value}>
              <input type="radio" name="template" value={preset.value} defaultChecked={index === 0} />
              <span className="template-choice-copy"><strong>{preset.label}</strong><small>{preset.description}</small></span>
            </label>)}
          </div>
        </fieldset>

        <div className="create-business-footer">
          <p className="form-help">يمكنك معاينة المسودة قبل النشر. لن تظهر الصفحة للزوار قبل تفعيلها ونشرها.</p>
          <SubmitButton className="button gold" pendingText="جارٍ التنفيذ...">إنشاء النشاط والصفحة</SubmitButton>
        </div>
      </form>
    </>
  );
}
