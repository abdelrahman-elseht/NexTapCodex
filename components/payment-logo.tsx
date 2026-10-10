"use client";

import { useEffect, useRef, useState } from "react";

export function PaymentLogo({ provider }: { provider: "instapay" | "vodafone" }) {
  const sources = [`/icons/payment/${provider}.svg`, `/icons/payment/${provider}.png`];
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
    return <span className={`payment-logo-fallback payment-logo-fallback-${provider}`} aria-hidden="true">{provider === "instapay" ? "IP" : "V"}</span>;
  }
  return <img key={source} ref={image} src={source} onError={() => setSourceIndex(sourceIndex + 1)} alt="" width={36} height={36} />;
}
