"use client";

import Link from "next/link";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
