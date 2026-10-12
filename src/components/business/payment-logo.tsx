"use client";

import { useEffect, useRef, useState } from "react";
import type { LocalWalletProvider } from "@/lib/business/providers";

export function PaymentLogo({ provider }: { provider: LocalWalletProvider }) {
  const sources = provider === "etisalat"
    ? []
    : provider === "orange"
      ? ["/icons/payment/orange.svg"]
      : [`/icons/payment/${provider}.svg`, `/icons/payment/${provider}.png`];
  const [sourceIndex, setSourceIndex] = useState(0);
  const image = useRef<HTMLImageElement>(null);
  const source = sources[sourceIndex];
  useEffect(() => {
    // A preload may fail before hydration attaches the error handler.
    if (image.current?.complete && image.current.naturalWidth === 0) {
      setSourceIndex(sourceIndex + 1);
    }
  }, [source, sourceIndex]);
  if (!source) {
    if (provider === "etisalat") return <span className="payment-logo-wordmark payment-logo-wordmark-etisalat" aria-hidden="true">e&amp;</span>;
    const fallback = provider === "instapay" ? "IP" : provider === "vodafone" ? "V" : "O";
    return <span className={`payment-logo-fallback payment-logo-fallback-${provider}`} aria-hidden="true">{fallback}</span>;
  }
  return <img key={source} ref={image} className="payment-logo-image" src={source} onError={() => setSourceIndex(sourceIndex + 1)} alt="" width={36} height={36} />;
}
