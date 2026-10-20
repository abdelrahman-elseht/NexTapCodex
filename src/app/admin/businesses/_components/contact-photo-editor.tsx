"use client";
import { useCallback, useId, useRef, useState } from "react";
import { imageCropRectangle } from "@/lib/media/image-edit";
import { cropRectangle, defaultContactCrop, type ContactCrop } from "@/lib/business/contact-crop";

export function ContactAvatar({ src, crop = defaultContactCrop, size = 96 }: { src: string; crop?: ContactCrop; size?: number }) {
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [broken, setBroken] = useState(false);
  // Cached images can finish before hydration attaches the load handler.
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth) setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
  }, []);
  const rect = cropRectangle(dimensions.width, dimensions.height, crop);
  const scale = size / rect.width;
  return <div className="contact-avatar" style={{ width: size, height: size }} aria-label="Contact photo preview">{!broken && <img ref={imageRef} src={src} alt="Contact photo" draggable={false} onError={() => setBroken(true)} onLoad={event => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} style={{ width: dimensions.width * scale, height: dimensions.height * scale, left: -rect.left * scale, top: -rect.top * scale }} />}{broken && <span>Photo unavailable</span>}</div>;
}

export function ContactPhotoEditor({ src, crop, onApply, subject = "Contact photo", circular = true, aspect = 1, onAspectChange, busy = false }: { src: string; crop?: ContactCrop; onApply: (crop: ContactCrop) => void; subject?: string; circular?: boolean; aspect?: number; onAspectChange?: (aspect: number) => void; busy?: boolean }) {
  const helpId = useId();
  const [value, setValue] = useState(crop || defaultContactCrop);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [broken, setBroken] = useState(false);
  // Cached images can finish before hydration attaches the load handler.
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth) setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
  }, []);
  const [applied, setApplied] = useState(false);
  const drag = useRef<{ x: number; y: number; crop: ContactCrop } | null>(null);
  const size = 240;
  const rect = imageCropRectangle(dimensions.width || 1, dimensions.height || 1, value, aspect);
  const scale = size / rect.width;
  const clamp = (n: number) => Math.round(Math.max(0, Math.min(1000, n)));
  const update = (next: ContactCrop) => { setValue(next); setApplied(false); };
  return <fieldset className="contact-photo-editor">
    <legend>{subject} crop</legend>
    <p id={helpId}>Drag to reposition, or use the position controls. {subject === "Contact photo" ? "The circle approximates the Contacts avatar; appearance varies by device." : circular ? "The circle shows the visible logo." : "Choose a crop shape for this image."}</p>
    <div className="contact-crop-stage" style={{ height: size / aspect }} aria-describedby={helpId} onPointerDown={event => { if (busy || broken || !dimensions.width) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, crop: value }; }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onPointerMove={event => {
      const start = drag.current; if (!start) return;
      const maxX = (dimensions.width - rect.width) * scale, maxY = (dimensions.height - rect.height) * scale;
      update({ ...value, x: maxX ? clamp(start.crop.x - (event.clientX - start.x) / maxX * 1000) : 500, y: maxY ? clamp(start.crop.y - (event.clientY - start.y) / maxY * 1000) : 500 });
    }}>
      {!broken && <img ref={imageRef} src={src} alt={`Reposition ${subject.toLowerCase()}`} draggable={false} onError={() => setBroken(true)} onLoad={event => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} style={{ width: dimensions.width * scale, height: dimensions.height * scale, left: -rect.left * scale, top: -rect.top * scale }} />}
      <div className={`contact-crop-mask${circular ? "" : " rectangular"}`} />
    </div>
    {broken ? <p role="status">Image unavailable. Replace the image URL or upload another image to crop.</p> : <div className="contact-crop-controls">
      {onAspectChange && <label className="field">Crop shape<select value={aspect} disabled={busy} onChange={event => { onAspectChange(Number(event.target.value)); setApplied(false); }}><option value={1}>Square</option><option value={4 / 3}>Landscape (4:3)</option><option value={16 / 9}>Wide (16:9)</option><option value={3 / 4}>Portrait (3:4)</option>{![1, 4 / 3, 16 / 9, 3 / 4].includes(aspect) && <option value={aspect}>Original proportions</option>}</select></label>}
      <label className="field">Zoom<input type="range" min={1000} max={4000} step={10} value={value.zoom} onChange={event => update({ ...value, zoom: Number(event.target.value) })} /></label>
      <label className="field">Horizontal position<input type="range" min={0} max={1000} value={value.x} onChange={event => update({ ...value, x: Number(event.target.value) })} /></label>
      <label className="field">Vertical position<input type="range" min={0} max={1000} value={value.y} onChange={event => update({ ...value, y: Number(event.target.value) })} /></label>
    </div>}
    <div className="contact-field-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => update(defaultContactCrop)}>Reset</button><button type="button" className="button" disabled={busy || broken || !dimensions.width} onClick={() => { onApply(value); setApplied(true); }}>{busy ? "Applying crop…" : "Apply crop"}</button></div>
    <p role="status">{subject === "Contact photo" ? applied ? "Crop applied to the local preview. Save draft or Publish to keep it." : "Apply the crop when ready. The original Business Logo stays unchanged." : "Apply updates this draft. Save draft or Publish to keep it. The original image stays unchanged."}</p>
  </fieldset>;
}
