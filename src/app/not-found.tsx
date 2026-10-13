import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";

export default function NotFound() {
  return (
    <main className="status-screen">
      <section className="status-card error-panel" aria-labelledby="not-found-title">
        <BrandLogo />
        <div className="error-mark" aria-hidden="true">404</div>
        <h1 id="not-found-title">هذه الصفحة غير موجودة</h1>
        <p>قد يكون الرابط قديماً أو كُتب بطريقة غير صحيحة. يمكنك العودة إلى NexTap أو استكشاف نموذج الصفحة.</p>
        <div className="error-actions">
          <Link className="button" href="/">العودة للرئيسية</Link>
          <Link className="button secondary" href="/demo">استكشاف النموذج</Link>
        </div>
      </section>
    </main>
  );
}
