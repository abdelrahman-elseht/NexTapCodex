import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default async function UnavailableCard({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  const content = state === "unassigned"
    ? { title: "البطاقة في انتظار التفعيل", detail: "لم يربط فريق النشاط هذه البطاقة بصفحة منشورة بعد. جرّب مرة أخرى لاحقاً." }
    : state === "inactive"
      ? { title: "الصفحة غير متاحة حالياً", detail: "أوقف فريق النشاط هذه الصفحة مؤقتاً. تواصل معهم مباشرة إذا كنت بحاجة إلى مساعدة." }
      : { title: "تعذر العثور على هذه البطاقة", detail: "تحقق من الرمز الموجود على البطاقة أو اطلب من فريق النشاط رابطاً محدثاً." };

  return (
    <main className="status-screen">
      <section className="status-card error-panel" aria-labelledby="card-state-title">
        <BrandLogo />
        <span className="eyebrow">NexTap · بطاقة أعمال</span>
        <h1 id="card-state-title">{content.title}</h1>
        <p>{content.detail}</p>
        <div className="error-actions">
          <Link className="button" href="/">العودة إلى NexTap</Link>
          <Link className="button secondary" href="/demo">عرض نموذج الصفحة</Link>
        </div>
      </section>
    </main>
  );
}
