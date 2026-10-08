"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <main className="status-screen">
          <section className="status-card error-panel" role="alert">
            <div className="error-mark" aria-hidden="true">!</div>
            <h1>تعذر فتح NexTap</h1>
            <p>حدثت مشكلة غير متوقعة. أعد المحاولة أو ارجع إلى الصفحة الرئيسية لاحقاً.</p>
            <div className="error-actions">
              <button className="button" type="button" onClick={reset}>إعادة المحاولة</button>
              <a className="button secondary" href="/">العودة للرئيسية</a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
