import { DeleteInventory } from "../../_components/inventory-controls";
import { readBatchSnapshot } from "@/lib/cards/batch-snapshot";
﻿import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { qrSvg, cardUrls, getCardOrigin } from "@/lib/cards/card-manufacturing";
import { requireOwner } from "@/lib/auth/owner";

export const dynamic = "force-dynamic";

export default async function ManufacturingBatchPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const requestOrigin = getCardOrigin(undefined, await headers());
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { supabase } = await requireOwner();
  const snapshot = await readBatchSnapshot(supabase, id);
  if (!snapshot) notFound();
  const { batch, cards } = snapshot;

  const preview = cards[0];
  const previewSvg = preview ? await qrSvg(cardUrls(preview.token, requestOrigin).qrUrl) : "";
  const counts = cards.reduce<Record<string, number>>((result, card) => {
    result[card.status] = (result[card.status] || 0) + 1;
    return result;
  }, {});

  return (
    <>
      {created && <div className="alert success" role="status">تم إنشاء الدفعة. راجع عينة QR والملفات قبل إرسالها للطباعة.</div>}
      <header className="business-editor-header">
        <div>
          <Link className="editor-back" href="/admin/cards">← العودة إلى البطاقات</Link>
          <span className="panel-kicker" dir="ltr">{batch.batch_code}</span>
          <h1>{batch.name}</h1>
          <p>{new Date(batch.created_at).toLocaleString("ar-EG")} · متبقٍ {cards.length} من {batch.quantity} بطاقة أصلية</p>
        </div>
        <div className="editor-header-actions"><DeleteInventory batchId={batch.id} />
          {cards.length > 0 ? <>
          <a className="button gold" href={"/admin/cards/batches/" + batch.id + "/manufacturing.zip"}>تنزيل حزمة التصنيع</a>
          <a className="button secondary" href={"/admin/cards/export?batch=" + batch.id}>تنزيل CSV</a>
          </> : <button className="button" disabled>لا توجد بطاقات للتنزيل</button>}
        </div>
      </header>

      <section className="stats" aria-label="ملخص حالة الدفعة">
        <div className="stat"><strong>{cards.length}</strong><span>البطاقات المتبقية</span></div>
        <div className="stat"><strong>{counts.unassigned || 0}</strong><span>غير معيّنة</span></div>
        <div className="stat"><strong>{(counts.active || 0) + (counts.disabled || 0) + (counts.replaced || 0)}</strong><span>لها حالة تشغيلية أخرى</span></div>
      </section>

      {preview ? <section id="preview" className="editor-panel batch-preview" aria-labelledby="qr-preview-title">
        <h2 id="qr-preview-title">عينة رمز QR</h2>
        <div className="qr-preview" dangerouslySetInnerHTML={{ __html: previewSvg }} />
        <div className="qr-preview-details">
          <p><strong dir="ltr">{preview.serial}</strong></p>
          <p className="encoded-url" dir="ltr">{cardUrls(preview.token, requestOrigin).qrUrl}</p>
          <p className="muted">استخدم ملف SVG الذي يحمل هذا الرقم التسلسلي عند مطابقة عينة الطباعة. الروابط والمعرّفات ثابتة عند إعادة التنزيل.</p>
        </div>
      </section> : <p className="notice" role="status">الدفعة فارغة. لا توجد بطاقات متبقية للتصدير.</p>}

      <section className="editor-panel printer-notes" aria-labelledby="printer-notes-title">
        <div className="panel-heading"><div><span className="panel-kicker">مراجعة قبل الإرسال</span><h2 id="printer-notes-title">التجهيز للطباعة والترميز</h2></div></div>
        <div className="printer-notes-grid">
          <div><h3>قبل الطباعة</h3><ul>
            <li>افتح qr-index.html من ملف ZIP لمطابقة كل QR مع الرقم التسلسلي والرابط.</li>
            <li>اطلب من المطبعة متطلبات ملفات البيانات المتغيرة والمقاس النهائي للرمز والـ bleed والمنطقة الآمنة.</li>
            <li>اطبع ورقة اختبار عالية التباين، مع مساحة QR البيضاء كاملة ومن دون قص أو شعار فوق الرمز.</li>
            <li>افحص خمس عينات على جهاز حقيقي، بينها أول وآخر رقم تسلسلي، وطابق الرابط مع manifest.csv.</li>
          </ul></div>
          <div><h3>بعد ترميز NFC</h3><ul>
            <li>لا تفترض أن المطبعة ترمّز NFC إلا إذا كان ذلك ضمن الاتفاق.</li>
            <li>المس عينات فعلية بجهاز يدعم NFC، وطابق بياناتها مع nfc-encoding.csv.</li>
            <li>تحقق من QR وNFC على البطاقة نفسها؛ فنجاح المسح لا يؤكد صحة الترميز.</li>
          </ul></div>
        </div>
      </section>
    </>
  );
}
