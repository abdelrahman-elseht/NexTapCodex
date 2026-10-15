"use client";

import { useEffect, useRef, useState } from "react";

type Event = { id: string; old_status: string; new_status: string; reason: string; created_at: string };

export function CardHistory({ cardId, count }: { cardId: string; count?: number }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const details = useRef<HTMLDetailsElement>(null);
  const reload = useRef<() => void>(() => {});
  const inFlight = useRef(false), refreshQueued = useRef(false);
  useEffect(() => { reload.current = () => { if (details.current?.open) void load(true); else setLoaded(false); }; });
  useEffect(() => {
    const changed = (event: globalThis.Event) => { if ((event as CustomEvent).detail?.cardId === cardId) reload.current(); };
    window.addEventListener("admin:mutation", changed);
    return () => window.removeEventListener("admin:mutation", changed);
  }, [cardId]);
  async function load(reset = false) {
    if (inFlight.current) { if (reset) refreshQueued.current = true; return; }
    inFlight.current = true;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/cards/${cardId}/history${!reset && cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "تعذر تحميل السجل.");
      setEvents((current) => reset ? body.events : [...current, ...body.events]);
      setCursor(body.nextCursor || null); setHasMore(Boolean(body.nextCursor)); setLoaded(true);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل السجل."); }
    finally {
      inFlight.current = false; setLoading(false);
      if (refreshQueued.current) { refreshQueued.current = false; void load(true); }
    }
  }
  return <details ref={details} className="card-audit-history" onToggle={(event) => { if (event.currentTarget.open && !loaded) void load(true); }}>
    <summary>سجل التغييرات ({count ?? "…"})</summary>
    {loading && <p role="status">جار تحميل السجل…</p>}
    {error && <div role="alert"><p>{error}</p><button type="button" className="small-button" onClick={() => void load(!loaded)}>إعادة المحاولة</button></div>}
    {loaded && !events.length && !error && <p>لا توجد تغييرات مسجلة.</p>}
    {events.map((event) => <div key={event.id} dir="auto">{event.reason}: {event.old_status} ← {event.new_status}<br /><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString("ar-EG")}</time></div>)}
    {hasMore && <button type="button" className="small-button" onClick={() => void load(false)} disabled={loading}>تحميل المزيد</button>}
  </details>;
}
