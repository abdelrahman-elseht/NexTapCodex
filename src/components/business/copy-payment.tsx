"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildWalletUssdCode, dialerHref } from "@/lib/business/wallet-ussd";
import { PaymentLogo } from "@/components/business/payment-logo";

function WalletPaymentAction({ value, provider, accessibleLabel, className, children, language }: Omit<Parameters<typeof PaymentAction>[0], "mode">) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const ar = language === "ar";
  const code = buildWalletUssdCode(provider, value, amount);
  const enabled = process.env.NEXT_PUBLIC_WALLET_USSD_ENABLED === "true";
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setStatus(ar ? "تم نسخ الرمز." : "Full code copied.");
    } catch {
      setStatus(ar ? "تعذر النسخ. حدد الرمز وانسخه يدويًا." : "Copy was blocked. Select the code and copy it manually.");
    }
  }
  return <>
    <button type="button" className={className} onClick={() => { setOpen(true); setAmount(""); setStatus(""); }} aria-label={accessibleLabel} aria-haspopup="dialog">{children}</button>
    {open && createPortal(<dialog ref={dialog} className="payment-instructions-dialog wallet-payment-dialog" aria-labelledby={headingId} dir={ar ? "rtl" : "ltr"} lang={language} onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="wallet-payment-brand"><PaymentLogo provider={provider as "vodafone" | "etisalat" | "orange"} /><h2 id={headingId}>{provider === "vodafone" ? "Vodafone Cash" : provider === "orange" ? "Orange Cash" : "e& money"}</h2></div>
      <p>{ar ? "أدخل المبلغ بالجنيه المصري. تحقّق من المستفيد قبل إتمام أي تحويل." : "Enter an amount in EGP. Verify the recipient before completing any transfer."}</p>
      <label className="field">{ar ? "المبلغ (جنيه مصري)" : "Amount (EGP)"}<input autoFocus type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} /></label>
      {!enabled && <p role="status">{ar ? "هذه الصيغة التجريبية غير مفعلة على هذا الموقع." : "Experimental dialing formats are disabled on this deployment."}</p>}
      {enabled && code && <><label className="field">{ar ? "رمز التحويل" : "Full code"}<code className="wallet-code" dir="ltr">{code}</code></label><p>{ar ? "قد لا يدعم جهازك فتح طالب الاتصال. استخدم النسخ كبديل." : "Your device may not support dialer handoff. Use copy as a fallback."}</p><div className="wallet-payment-actions"><a className="button primary" href={dialerHref(code)}>{ar ? "فتح لوحة الاتصال" : "Open Dialer"}</a><button className="button secondary" type="button" onClick={() => void copyCode()}>{ar ? "نسخ الرمز كاملًا" : "Copy Full Code"}</button></div></>}
      {enabled && !code && <p role="alert">{ar ? "أدخل مبلغًا صحيحًا أكبر من صفر." : "Enter a valid amount greater than zero."}</p>}
      <p role="status" aria-live="polite">{status}</p><p>{ar ? "لن تطلب NexTap رمز PIN أو كلمة مرور لمرة واحدة، ولن تؤكد الدفع." : "NexTap never asks for a PIN or OTP and does not confirm payments."}</p>
      <button type="button" className="button secondary" onClick={() => dialog.current?.close()}>{ar ? "إغلاق" : "Close"}</button>
    </dialog>, document.body)}
  </>;
}

function PaymentInstructionsAction({ value, provider, mode = "copy", accessibleLabel, className = "", children, language = "en" }: {
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

export function PaymentAction(props: Parameters<typeof PaymentInstructionsAction>[0]) {
  if (props.provider !== "instapay" && ["vodafone", "etisalat", "orange"].includes(props.provider)) {
    return <WalletPaymentAction {...props} />;
  }
  return <PaymentInstructionsAction {...props} />;
}
