import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default function AccessDenied() {
  return (
    <main className="status-screen">
      <section className="status-card error-panel" aria-labelledby="access-title">
        <BrandLogo />
        <div className="error-mark" aria-hidden="true">403</div>
        <h1 id="access-title">هذه المساحة مخصصة لفريق NexTap</h1>
        <p>الحساب الحالي لا يملك صلاحية الدخول إلى لوحة الإدارة. إذا كنت عضواً في الفريق، تواصل مع مسؤول NexTap.</p>
        <div className="error-actions">
          <Link className="button" href="/login">تسجيل الدخول بحساب آخر</Link>
          <Link className="button secondary" href="/">العودة للرئيسية</Link>
        </div>
      </section>
    </main>
  );
}
