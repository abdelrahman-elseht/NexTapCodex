"use client";
import { createContext, useContext, useEffect, useRef, useState, useTransition, type FormHTMLAttributes, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { acquireMutation, useMutationLocks } from "@/components/admin/mutation-locks";

type MutationState = { pending: boolean; completed: number; error: string };
const Context = createContext<MutationState | null>(null);
export const useMutationState = () => useContext(Context);

/** A promise owns pending state. Inputs and the request key survive failures. */
export function MutationForm({ action, children, resourceKeys = [], ...props }: Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & { action: string; children: ReactNode; resourceKeys?: string[] }) {
  const router = useRouter();
  const locked = useRef(false), requestKey = useRef(""), previousPayload = useRef("");
  const [pending, setPending] = useState(false), [refreshing, startTransition] = useTransition();
  const [error, setError] = useState(""), [completed, setCompleted] = useState(0);
  const resourceBusy = useMutationLocks(resourceKeys);
  return <Context.Provider value={{ pending: pending || refreshing || resourceBusy, completed, error }}>
    <form {...props} action={action} method="post" aria-busy={pending || refreshing} onSubmit={async event => {
      event.preventDefault();
      if (locked.current) return;
      const release = acquireMutation(resourceKeys); if (!release) return;
      const form = event.currentTarget, data = new FormData(form);
      const payload = JSON.stringify([...data.entries()].filter(([key]) => key !== "request_key" && key !== "idempotency_key"));
      // A changed payload is a new intent; unchanged retries retain the key.
      if (!requestKey.current || payload !== previousPayload.current) requestKey.current = crypto.randomUUID();
      previousPayload.current = payload;
      data.set("request_key", requestKey.current); data.set("idempotency_key", requestKey.current);
      locked.current = true; setPending(true); setError("");
      try {
        const response = await fetch(action, { method: "POST", headers: { Accept: "application/json" }, body: data, redirect: "error" });
        const result = await response.json();
        if (!response.ok || result.ok !== true) throw new Error(result.error || "تعذر تنفيذ العملية. بياناتك محفوظة هنا؛ أعد المحاولة.");
        // A confirmed success ends this intent. A later action with identical
        // fields (for example reactivation after disable) must execute again.
        requestKey.current = "";
        setCompleted(value => value + 1);
        window.dispatchEvent(new CustomEvent("admin:mutation", { detail: { cardId: data.get("card_id") } }));
        startTransition(() => {
          if (typeof result.nextHref === "string" && result.nextHref.startsWith("/admin/") && !result.nextHref.startsWith("//")) router.push(result.nextHref);
          else router.refresh();
        });
      } catch (e) { setError(e instanceof Error ? e.message : "تعذر الاتصال. أعد المحاولة بنفس البيانات للتحقق من النتيجة."); }
      finally { locked.current = false; setPending(false); release(); }
    }}>
      {children}
      {error && <p role="alert" className="notice">{error}</p>}
      {completed > 0 && !error && <p role="status" className="mutation-result">تم حفظ التغيير.</p>}
    </form>
  </Context.Provider>;
}

export function FilterForm({ action, children, ...props }: Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & { action: string }) {
  const router = useRouter(); const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null), query = useSearchParams().toString();
  useEffect(() => {
    const params = new URLSearchParams(query);
    form.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[name],select[name]").forEach(input => { input.value = params.get(input.name) || ""; });
  }, [query]);
  return <form ref={form} {...props} action={action} method="get" aria-busy={pending} onSubmit={event => {
    event.preventDefault(); const params = new URLSearchParams();
    new FormData(event.currentTarget).forEach((value, key) => { if (typeof value === "string" && value) params.set(key, value); });
    startTransition(() => router.push(`${action}?${params}`, { scroll: false }));
  }}>{children}{pending && <span role="status">جارٍ تحميل النتائج…</span>}</form>;
}
