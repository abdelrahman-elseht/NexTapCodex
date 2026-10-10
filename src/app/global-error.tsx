"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { surface: "global.error" } });
  }, [error]);
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
