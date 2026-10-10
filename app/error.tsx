"use client";

import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { BrandLogo } from "@/components/brand-logo";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { surface: "public.error" } });
  }, [error]);
  return (
    <main className="status-screen">
      <section className="status-card error-panel" aria-labelledby="error-title" role="alert">
        <BrandLogo />
        <div className="error-mark" aria-hidden="true">!</div>
        <h1 id="error-title">تعذر إكمال الطلب</h1>
        <p>حدثت مشكلة مؤقتة. أعد المحاولة، أو انتقل إلى الصفحة الرئيسية.</p>
        <div className="error-actions">
          <button className="button" type="button" onClick={reset}>إعادة المحاولة</button>
          <Link className="button secondary" href="/">العودة للرئيسية</Link>
        </div>
      </section>
    </main>
  );
}
