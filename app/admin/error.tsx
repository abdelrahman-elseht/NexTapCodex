"use client";

import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { surface: "admin.error" } });
  }, [error]);
  return (
    <section className="editor-panel error-panel" role="alert">
      <div className="error-mark" aria-hidden="true">!</div>
      <h1>تعذر تحميل مساحة الإدارة</h1>
      <p>لم تكتمل هذه الخطوة. أعد المحاولة، أو ارجع إلى لوحة التحكم.</p>
      <div className="error-actions">
        <button className="button" type="button" onClick={reset}>إعادة المحاولة</button>
        <Link className="button secondary" href="/admin">لوحة التحكم</Link>
      </div>
    </section>
  );
}
