"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function PaymentAction({ value, provider, mode = "copy", accessibleLabel, className = "", children, language = "en" }: {
  value: string;
  provider: string;
  mode?: "copy" | "instructions";
  accessibleLabel: string;
  className?: string;
  children: React.ReactNode;
  language?: "ar" | "en";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const ar = language === "ar";
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  async function activate() {
    // The recipient is never rendered. Only an intentional clipboard action uses it.
    setOpen(true);
    setCopyState("idle");
    if (mode !== "copy" || !value) return;
    try { await navigator.clipboard.writeText(value); setCopyState("copied"); }
    catch { setCopyState("failed"); }
  }
  const guidance = provider === "instapay"
    ? (ar ? "افتح تطبيق InstaPay الرسمي، واختر إرسال الأموال إلى عنوان الدفع IPA. أدخل المبلغ وتحقق من المستفيد ثم أكمل التحويل في التطبيق." : "Open the official InstaPay app and choose Send Money to a Payment Address (IPA). Enter the amount, verify the beneficiary, and complete the transfer in the app.")
    : provider === "vodafone"
      ? (ar ? "اطلب *9*7# واختر تحويل الأموال. أدخل رقم المستفيد والمبلغ، ثم أكمل التحويل في خدمة Vodafone Cash الرسمية." : "Dial *9*7# and choose money transfer. Enter the recipient number and amount, then complete the transfer in the official Vodafone Cash flow.")
      : provider === "etisalat"
        ? (ar ? "افتح خدمة e& money الرسمية (محفظة اتصالات كاش). أدخل رقم المستفيد والمبلغ، وتحقق من بياناته ثم أكمل التحويل داخل المحفظة." : "Open the official e& money wallet (Etisalat Cash). Enter the recipient's mobile number and amount, verify the recipient, then complete the transfer in the wallet.")
        : provider === "orange"
          ? (ar ? "افتح خدمة Orange Cash الرسمية (محفظة موبينيل سابقًا). اطلب #7115# أو استخدم تطبيق Max it، واختر تحويل الأموال، ثم أدخل رقم المستفيد والمبلغ وتحقق من بياناته قبل إتمام التحويل." : "Open the official Orange Cash wallet (formerly Mobinil). Use the Max it app or dial #7115#, choose money transfer, enter the recipient's mobile number and amount, verify the recipient, then complete the transfer.")
          : (ar ? "اطلب من النشاط تعليمات التحويل وبيانات المستفيد، وتحقق منها ثم أكمل التحويل في تطبيق البنك الرسمي." : "Ask the business for transfer instructions and recipient details. Verify them and complete the transfer in your bank's official app.");
  return <>
    <button type="button" className={className} onClick={activate} aria-label={accessibleLabel} aria-haspopup="dialog">{children}</button>
    {open && createPortal(<dialog ref={dialog} className="payment-instructions-dialog" aria-labelledby={headingId} dir={ar ? "rtl" : "ltr"} lang={language} onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <h2 id={headingId}>{ar ? "تعليمات الدفع" : "Payment instructions"}</h2>
      <p role="status">{copyState === "copied" ? (ar ? "تم نسخ بيانات المستفيد. الصقها في خدمة الدفع الرسمية." : "Recipient details copied. Paste them into the official payment service.") : copyState === "failed" ? (ar ? "تعذر نسخ بيانات المستفيد. اطلبها مباشرة من النشاط." : "Could not copy recipient details. Ask the business for them directly.") : mode === "copy" && value ? (ar ? "جارٍ نسخ بيانات المستفيد." : "Copying recipient details...") : (ar ? "اطلب بيانات المستفيد مباشرة من النشاط." : "Ask the business for recipient details directly.")}</p>
      <p>{guidance}</p>
      <p>{ar ? "NexTap لا ينفذ المدفوعات أو يؤكدها." : "NexTap does not submit or confirm payments."}</p>
      <button type="button" className="button secondary" autoFocus onClick={() => dialog.current?.close()}>{ar ? "إغلاق" : "Close"}</button>
    </dialog>, document.body)}
  </>;
}
