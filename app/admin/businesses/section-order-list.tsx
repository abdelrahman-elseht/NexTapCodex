"use client";

import { useState, type ReactNode } from "react";
import { reorderSections } from "./actions";

type Section = { id: string; title: string; children: ReactNode };

export function SectionOrderList({ businessId, pageId, sections }: { businessId: string; pageId: string; sections: Section[] }) {
  const [ids, setIds] = useState(sections.map(section => section.id));
  const [dragging, setDragging] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const byId = new Map(sections.map(section => [section.id, section]));

  function move(id: string, offset: number) {
    const at = ids.indexOf(id), to = at + offset;
    if (at < 0 || to < 0 || to >= ids.length) return;
    const next = [...ids];
    next.splice(at, 1);
    next.splice(to, 0, id);
    setIds(next);
    setMessage(`${byId.get(id)?.title} moved to position ${to + 1} of ${ids.length}. Save order to publish this arrangement.`);
  }

  function drop(targetId: string) {
    if (!dragging || dragging === targetId) return;
    const next = [...ids];
    next.splice(next.indexOf(dragging), 1);
    next.splice(next.indexOf(targetId), 0, dragging);
    setIds(next);
    setMessage(`${byId.get(dragging)?.title} moved. Save order to persist the new arrangement.`);
    setDragging(null);
  }

  return <>
    <div className="section-order-toolbar">
      <div><strong>Page sections</strong><p className="muted">Drag to arrange sections, or use the move buttons. Save order to keep your changes.</p></div>
      <form action={reorderSections} id="section-order-form">
        <input type="hidden" name="business_id" value={businessId}/>
        <input type="hidden" name="page_id" value={pageId}/>
        {ids.map(id => <input key={id} type="hidden" name="ordered_section_ids" value={id}/>)}
        <button className="button gold" type="submit">Save order</button>
      </form>
    </div>
    <p className="sr-only" role="status" aria-live="polite">{message}</p>
    <ol className="section-order-list" aria-label="Page sections in display order">
      {ids.map((id, index) => {
        const section = byId.get(id)!;
        return <li key={id} draggable onDragStart={() => setDragging(id)} onDragOver={event => event.preventDefault()} onDrop={() => drop(id)} onDragEnd={() => setDragging(null)} className={dragging === id ? "is-dragging" : ""}>
          <div className="section-order-handle" aria-label={`Section ${index + 1}: ${section.title}`}>
            <span className="section-grip" aria-hidden="true">⠿</span><span className="section-number">{String(index + 1).padStart(2, "0")}</span>
            <div className="section-order-buttons">
              <button type="button" className="small-button" aria-label={`Move ${section.title} up`} disabled={index === 0} onClick={() => move(id, -1)}>↑</button>
              <button type="button" className="small-button" aria-label={`Move ${section.title} down`} disabled={index === ids.length - 1} onClick={() => move(id, 1)}>↓</button>
            </div>
          </div>
          <div className="section-order-content">{section.children}</div>
        </li>;
      })}
    </ol>
  </>;
}
