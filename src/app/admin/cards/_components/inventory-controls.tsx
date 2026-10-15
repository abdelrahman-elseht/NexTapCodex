"use client";
import { createContext, useContext, useId, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { acquireMutation, useMutationLocks } from "@/components/admin/mutation-locks";
import { useAdminFeedback } from "@/components/admin/feedback";

type Selection = { ids: string[]; toggle: (id: string) => void; remove: (ids: string[]) => void };
const SelectionContext = createContext<Selection | null>(null);
export function InventorySelection({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  return <SelectionContext.Provider value={{ ids, toggle: id => setIds(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 1000 ? [...current, id] : current), remove: removed => setIds(current => current.filter(id => !removed.includes(id))) }}>{children}</SelectionContext.Provider>;
}
export function CardSelection({ id, serial }: { id: string; serial: string }) {
  const selection = useContext(SelectionContext);
  return <label className="card-selection"><input type="checkbox" checked={selection?.ids.includes(id) || false} onChange={() => selection?.toggle(id)} aria-label={`تحديد ${serial}`} /><span>تحديد</span></label>;
}
export function SelectedCardDeletion() {
  const selection = useContext(SelectionContext);
  if (!selection?.ids.length) return null;
  return <div className="inventory-selection" role="region" aria-label="البطاقات المحددة"><strong>{selection.ids.length} بطاقة محددة (قد تشمل صفحات أخرى)</strong><button type="button" className="button secondary" onClick={() => selection.remove(selection.ids)}>مسح التحديد</button><DeleteInventory cardIds={selection.ids} /></div>;
}
type Preview = { operationId: string; batchId: string | null; batchCode: string | null; count: number; assignedCount: number; activeCount: number; expiresAt: string; cards: { id: string; serial: string; status: string; assigned: boolean }[] };
export function DeleteInventory({ cardIds, batchId }: { cardIds?: string[]; batchId?: string }) {
  const selection = useContext(SelectionContext), router = useRouter(), pathname = usePathname();
  const announce = useAdminFeedback();
  const query = useSearchParams();
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null), cancel = useRef<HTMLButtonElement>(null), busy = useRef(false);
  const titleId = useId();
  const [preview, setPreview] = useState<Preview | null>(null), [pending, setPending] = useState(false), [error, setError] = useState("");
  const [ack, setAck] = useState(false), [impact, setImpact] = useState(false), [code, setCode] = useState("");
  const keys = (preview?.cards.map(card => card.id) || cardIds || []).map(id => `card:${id}`);
  const resourceBusy = useMutationLocks(keys);
  async function request(body: object) {
    const response = await fetch("/api/admin/cards/deletion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), redirect: "error" });
    const result = await response.json();
    if (!response.ok || result.ok !== true) {
      if (response.status === 409 || response.status === 404) setPreview(null);
      throw new Error(result.error || "تعذر الحذف. لم يتم تأكيد النتيجة؛ أعد المحاولة.");
    }
    return result;
  }
  async function loadPreview() {
    if (busy.current) return; busy.current = true; setPending(true); setError(""); setPreview(null); setAck(false); setImpact(false); setCode("");
    dialog.current?.showModal(); cancel.current?.focus();
    try { setPreview(await request({ mode: "preview", cardIds, batchId })); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر الاتصال. أعد المحاولة."); }
    finally { busy.current = false; setPending(false); }
  }
  function close() { if (busy.current) return; dialog.current?.close(); trigger.current?.focus(); }
  async function commit() {
    if (!preview || busy.current) return;
    const release = acquireMutation(keys); if (!release) return;
    busy.current = true; setPending(true); setError("");
    try {
      const result = await request({ mode: "commit", operationId: preview.operationId, acknowledged: ack, impactAcknowledged: impact, batchCode: code || null });
      selection?.remove(preview.cards.map(card => card.id));
      dialog.current?.close();
      announce(`تم حذف ${result.deletedCards} بطاقة نهائياً.`);
      if (result.deletedBatchId && pathname.includes(`/batches/${result.deletedBatchId}`)) router.push("/admin/cards", { scroll: false });
      else if (result.deletedBatchId && query.get("batch") === result.deletedBatchId) {
        const next = new URLSearchParams(query.toString());
        for (const key of ["batch", "cursor", "direction"]) next.delete(key);
        router.replace(`${pathname}?${next}`, { scroll: false });
      }
      else router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر الاتصال. أعد المحاولة للتحقق من نفس العملية."); }
    finally { busy.current = false; setPending(false); release(); }
  }
  return <>
    <button ref={trigger} type="button" className="small-button danger" disabled={pending || resourceBusy} onClick={() => void loadPreview()}>{batchId ? "حذف الدفعة نهائياً" : cardIds?.length === 1 ? "حذف البطاقة نهائياً" : "حذف المحدد نهائياً"}</button>
    <dialog ref={dialog} className="confirm-dialog inventory-delete-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }}>
      <h2 id={titleId}>تأكيد الحذف النهائي</h2>
      <p>ستتوقف روابط QR وNFC لهذه البطاقات. لن تُحذف صفحات النشاط. تخلّص من البطاقات المطبوعة والملفات القديمة؛ لا يمكن سحب النسخ التي سبق تنزيلها.</p>
      {pending && <p role="status">جارٍ التحقق والتنفيذ…</p>}
      {error && <p role="alert" className="notice">{error}</p>}
      {preview && <>
        <p><strong>{preview.count} بطاقة · {preview.activeCount} مفعّلة · {preview.assignedCount} معيّنة</strong>{preview.batchCode && <span dir="ltr"> · {preview.batchCode}</span>}</p>
        <ul className="deletion-card-list">{preview.cards.map(card => <li key={card.id}><bdi>{card.serial}</bdi> · {card.status}{card.assigned ? " · معيّنة" : ""}</li>)}</ul>
        <label className="deletion-ack"><input type="checkbox" checked={ack} disabled={pending} onChange={event => setAck(event.target.checked)} />أوافق على حذف البطاقات وسجل تعيينها نهائياً.</label>
        {(preview.assignedCount > 0 || preview.activeCount > 0) && <label className="deletion-ack"><input type="checkbox" checked={impact} disabled={pending} onChange={event => setImpact(event.target.checked)} />أفهم أن البطاقات المفعّلة أو المعيّنة لن تفتح النشاط بعد الحذف.</label>}
        {preview.batchCode && <label className="field">اكتب رمز الدفعة للتأكيد<input dir="ltr" autoComplete="off" value={code} disabled={pending} onChange={event => setCode(event.target.value)} /></label>}
      </>}
      <div className="confirm-dialog-actions">
        <button ref={cancel} type="button" className="button secondary" disabled={pending} onClick={close}>إلغاء</button>
        {!preview ? <button type="button" className="button" disabled={pending} onClick={() => void loadPreview()}>مراجعة التأكيد مجدداً</button> : <button type="button" className="button danger-confirm" disabled={pending || resourceBusy || !ack || ((preview.assignedCount > 0 || preview.activeCount > 0) && !impact) || Boolean(preview.batchCode && code !== preview.batchCode)} onClick={() => void commit()}>حذف نهائي</button>}
      </div>
    </dialog>
  </>;
}
