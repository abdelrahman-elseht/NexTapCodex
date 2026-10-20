"use client";
import { useCallback, useRef, useState } from "react";
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

export function ContactPhotoEditor({ src, crop, onApply }: { src: string; crop?: ContactCrop; onApply: (crop: ContactCrop) => void }) {
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
  const rect = cropRectangle(dimensions.width || 1, dimensions.height || 1, value);
  const scale = size / rect.width;
  const clamp = (n: number) => Math.round(Math.max(0, Math.min(1000, n)));
  const update = (next: ContactCrop) => { setValue(next); setApplied(false); };
  return <fieldset className="contact-photo-editor">
    <legend>Contact photo crop</legend>
    <p id="contact-crop-help">Drag to reposition, or use the position controls. The circle approximates the Contacts avatar; appearance varies by device.</p>
    <div className="contact-crop-stage" aria-describedby="contact-crop-help" onPointerDown={event => { if (broken || !dimensions.width) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, crop: value }; }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onPointerMove={event => {
      const start = drag.current; if (!start) return;
      const maxX = (dimensions.width - rect.width) * scale, maxY = (dimensions.height - rect.height) * scale;
      update({ ...value, x: maxX ? clamp(start.crop.x - (event.clientX - start.x) / maxX * 1000) : 500, y: maxY ? clamp(start.crop.y - (event.clientY - start.y) / maxY * 1000) : 500 });
    }}>
      {!broken && <img ref={imageRef} src={src} alt="Reposition contact photo" draggable={false} onError={() => setBroken(true)} onLoad={event => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} style={{ width: dimensions.width * scale, height: dimensions.height * scale, left: -rect.left * scale, top: -rect.top * scale }} />}
      <div className="contact-crop-mask" />
    </div>
    {broken ? <p role="status">Image unavailable. Choose a valid managed image to crop. The contact can still download without a photo.</p> : <div className="contact-crop-controls">
      <label className="field">Zoom<input type="range" min={1000} max={4000} step={10} value={value.zoom} onChange={event => update({ ...value, zoom: Number(event.target.value) })} /></label>
      <label className="field">Horizontal position<input type="range" min={0} max={1000} value={value.x} onChange={event => update({ ...value, x: Number(event.target.value) })} /></label>
      <label className="field">Vertical position<input type="range" min={0} max={1000} value={value.y} onChange={event => update({ ...value, y: Number(event.target.value) })} /></label>
    </div>}
    <div className="contact-field-actions"><button type="button" className="button secondary" onClick={() => update(defaultContactCrop)}>Reset</button><button type="button" className="button" disabled={broken || !dimensions.width} onClick={() => { onApply(value); setApplied(true); }}>Apply crop</button></div>
    <p role="status">{applied ? "Crop applied to the local preview. Save draft or Publish to keep it." : "Apply the crop when ready. The original Business Logo stays unchanged."}</p>
  </fieldset>;
}
