"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

export default function SentryDiagnostics() {
  const [status, setStatus] = useState("ready");

  async function sendClientError() {
    setStatus("sending");
    const eventId = Sentry.captureException(new Error("NexTap controlled client verification error"), {
      tags: { verification: "client", surface: "sentry-diagnostics" },
    });
    await Sentry.flush(2000);
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
