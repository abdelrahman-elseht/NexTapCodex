"use client";

import { useState } from "react";

export function CopyPayment({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); }
  }
  return <button type="button" className="copy-payment" onClick={copy}>{copied ? "Copied" : label}</button>;
}
