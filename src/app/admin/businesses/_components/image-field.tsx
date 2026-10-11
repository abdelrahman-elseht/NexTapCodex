"use client";
import { useEffect, useId, useRef, useState } from "react";
import { prepareImage } from "@/lib/media/prepare";
import type { ImageRole } from "@/lib/media/limits";

export type UploadTracker = (key: string, pending: boolean) => void;
export function ImageField({ businessId, label, value, alt, role = "photo", onChange, onAltChange, track }: {
  businessId: string; label: string; value: string; alt: string; role?: ImageRole;
  onChange: (url: string) => void; onAltChange: (alt: string) => void; track: UploadTracker;
}) {
  const id = useId(); const xhr = useRef<XMLHttpRequest | null>(null); const attempt = useRef(0);
  const callbacks = useRef({ onChange, track }); callbacks.current = { onChange, track };
  const [file, setFile] = useState<File | null>(null); const [pending, setPending] = useState(false);
  const [status, setStatus] = useState(""); const [error, setError] = useState(""); const [progress, setProgress] = useState(0);
  const [broken, setBroken] = useState("");
  useEffect(() => () => { attempt.current++; xhr.current?.abort(); callbacks.current.track(id, false); }, [id]);
  function cancel() { attempt.current++; xhr.current?.abort(); xhr.current = null; setPending(false); callbacks.current.track(id, false); setStatus("Upload cancelled. Choose a file or retry."); }
  async function upload(selected: File) {
    cancel(); const token = ++attempt.current;
    setFile(selected); setPending(true); track(id, true); setError(""); setProgress(0); setStatus("Preparing image…");
    try {
      const prepared = await prepareImage(selected, role);
      if (token !== attempt.current) return;
      const form = new FormData(); form.set("businessId", businessId); form.set("role", role); form.set("alt", alt); form.set("file", prepared, "image");
      const result = await new Promise<{ url: string }>((resolve, reject) => {
        const request = new XMLHttpRequest(); xhr.current = request;
        request.open("POST", "/api/admin/media");
        request.upload.onprogress = event => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
        request.onload = () => {
          let data; try { data = JSON.parse(request.responseText); } catch { reject(new Error("Upload failed. Retry.")); return; }
          if (request.status >= 200 && request.status < 300 && typeof data.url === "string") resolve(data);
          else reject(new Error(data.error || "Upload failed. Retry."));
        };
        request.onerror = () => reject(new Error("Connection failed. Retry the image upload."));
        request.onabort = () => reject(new Error("Upload cancelled."));
        setStatus("Uploading image…"); request.send(form);
      });
      if (token !== attempt.current) return;
      callbacks.current.onChange(result.url); setFile(null); setStatus("Image uploaded to this draft. Save to keep the change.");
    } catch (error) {
      if (token !== attempt.current) return;
      setError(error instanceof Error ? error.message : "Upload failed. Retry."); setStatus("");
    } finally {
      if (token === attempt.current) { xhr.current = null; setPending(false); callbacks.current.track(id, false); }
    }
  }
  return <fieldset className="image-field">
    <legend>{label}</legend>
    <label className="field">{label} URL<input dir="ltr" value={value} onChange={event => onChange(event.target.value)} disabled={pending} /></label>
    <label className="field">{label} alt text<input value={alt} maxLength={200} onChange={event => onAltChange(event.target.value)} /></label>
    {value && <div className="upload-preview">{broken === value ? <span>Image unavailable. Replace the URL or upload another image.</span> : <img src={value} alt={alt || `${label} preview`} width={240} height={120} onError={() => setBroken(value)} />}</div>}
    <label className="field">Upload {label.toLowerCase()}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={event => { const chosen = event.target.files?.[0]; event.target.value = ""; if (chosen) void upload(chosen); }} /></label>
    <small>Still JPEG, PNG or WebP. Up to 5 MiB per image. Uploaded images are publicly readable by URL.</small>
    {pending && <progress max={100} value={progress} aria-label={`${label} upload progress`} />}
    {status && <p role="status">{status}</p>}{error && <p role="alert" className="field-error">{error}</p>}
    <div className="image-field-actions">
      {pending && <button type="button" className="small-button" onClick={cancel}>Cancel upload</button>}
      {!pending && file && <button type="button" className="small-button" onClick={() => void upload(file)}>Retry {label.toLowerCase()} upload</button>}
      {value && <button type="button" className="small-button" disabled={pending} onClick={() => { onChange(""); setStatus("Image removed from this draft."); }}>Remove {label.toLowerCase()}</button>}
    </div>
  </fieldset>;
}
