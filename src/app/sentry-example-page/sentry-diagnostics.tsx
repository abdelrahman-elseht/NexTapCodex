"use client";

import { captureClientException } from "@/lib/observability/client";
import { useState } from "react";

export default function SentryDiagnostics() {
  const [status, setStatus] = useState("ready");

  async function sendClientError() {
    setStatus("sending");
    const eventId = await captureClientException(new Error("NexTap controlled client verification error"), {
      tags: { verification: "client", surface: "sentry-diagnostics" },
    });
    setStatus(eventId ? "sent" : "disabled");
  }

  return (
    <main className="status-screen">
      <section className="status-card" aria-labelledby="sentry-test-title">
        <h1 id="sentry-test-title">Sentry diagnostics</h1>
        <p>Safe staging-only checks for client and server error delivery.</p>
        <button className="button gold" type="button" onClick={sendClientError} disabled={status === "sending"}>
          Send controlled client error
        </button>
        <p role="status" aria-live="polite">Client status: {status}</p>
      </section>
    </main>
  );
}
