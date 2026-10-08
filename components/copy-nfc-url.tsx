"use client";

import { useState } from "react";

export function CopyNfcUrl({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/c/${token}?via=nfc`;

  async function copyUrl() {
    const url = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("انسخ رابط NFC والصقه في تطبيق كتابة البطاقة:", url);
    }
  }

  return (
    <div className="inline">
      <a className="small-button secondary" href={path} target="_blank" rel="noreferrer">
        اختبار الرابط
      </a>
      <button className="small-button" type="button" onClick={copyUrl}>
        {copied ? "تم النسخ" : "نسخ رابط NFC"}
      </button>
    </div>
  );
}
