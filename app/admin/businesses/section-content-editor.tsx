"use client";

import { useState } from "react";
import { sectionKinds } from "@/lib/content";

type Content = Record<string, unknown>;
type Item = { label: string; value: string; url: string; provider?: string; enabled?: boolean; icon?: string };
const labels: Record<string, string> = {
  hero: "الرئيسية", about: "عن النشاط", hours: "مواعيد العمل", contact: "التواصل والموقع", quick_actions: "الإجراءات السريعة",
  social: "الشبكات الاجتماعية", payments: "طرق الدفع", links: "روابط إضافية", services: "الخدمات",
  gallery: "معرض الصور", reviews: "التقييمات", branch: "الفروع",
};
const itemKinds = ["hours", "quick_actions", "social", "payments", "links", "services", "gallery", "branch"];
const defaults: Record<string, Content> = {
  hero: { tagline: "", description: "", coverUrl: "", logoUrl: "", color: "#bb9659", language: "ar" },
  about: { description: "" }, hours: { items: [] },
  contact: { phone: "", whatsapp: "", email: "", address: "", mapsUrl: "" },
  social: { items: [] }, payments: { items: [] }, links: { items: [] }, services: { items: [] },
  gallery: { items: [] }, reviews: { url: "" }, branch: { items: [] },
};

function normalizeItems(value: unknown): Item[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    return [{
      label: typeof record.label === "string" ? record.label : "",
      value: typeof record.value === "string" ? record.value : "",
      url: typeof record.url === "string" ? record.url : "",
      provider: typeof record.provider === "string" ? record.provider : undefined,
      enabled: record.enabled !== false,
      icon: typeof record.icon === "string" ? record.icon : undefined,
    }];
  }).slice(0, 100);
}

export function SectionContentEditor({ initialContent, kind: initialKind }: { initialContent: Content; kind: string }) {
  const [kind, setKind] = useState(initialKind);
  const [base, setBase] = useState<Content>(() => Object.fromEntries(Object.entries(initialContent).filter(([key]) => key !== "items")));
  const [items, setItems] = useState<Item[]>(() => normalizeItems(initialContent.items));
  const [mode, setMode] = useState<"items" | "json">(() =>
    ["hero", "contact", "about", "reviews"].includes(initialKind) || Array.isArray(initialContent.items) ? "items" : "json",
  );
  const [raw, setRaw] = useState(() => JSON.stringify(initialContent, null, 2));
  const [parseError, setParseError] = useState("");

  function updateItem(index: number, key: keyof Item, value: string | boolean) {
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }
  function addItem() {
    setItems(current => current.length >= 100 ? current : [...current, { label: "", value: "", url: "", enabled: true }]);
  }
  function removeItem(index: number) {
    setItems(current => current.filter((_, itemIndex) => itemIndex !== index));
  }
  function updateField(key: string, value: string) {
    setBase(current => ({ ...current, [key]: value }));
  }
  function changeKind(nextKind: string) {
    setKind(nextKind);
    const next = defaults[nextKind] || {};
    setBase(Object.fromEntries(Object.entries(next).filter(([key]) => key !== "items")));
    setItems(normalizeItems(next.items));
    setRaw(JSON.stringify(next, null, 2));
    setMode(["hero", "contact", "about", "reviews"].includes(nextKind) || itemKinds.includes(nextKind) ? "items" : "json");
    setParseError("");
  }
  function getContent() {
    return JSON.stringify({ ...base, ...(itemKinds.includes(kind) ? { items } : {}) });
  }
  function showJson() {
    setParseError("");
    setRaw(getContent());
    setMode("json");
  }
  function showItems() {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setParseError("يجب أن يكون المحتوى كائن JSON.");
        return;
      }
      const record = parsed as Content;
      setItems(normalizeItems(record.items));
      setBase(Object.fromEntries(Object.entries(record).filter(([key]) => key !== "items")));
      setParseError("");
      setMode("items");
    } catch {
      setParseError("أصلح صيغة JSON قبل العودة إلى محرر المحتوى.");
    }
  }

  const kindHelp: Record<string, string> = {
    hours: "اكتب اليوم أو الفترة في الاسم، ومواعيدها في القيمة.",
    payments: "أضف InstaPay أو Vodafone Cash أو تحويلاً بنكياً. NexTap لا يعالج المدفوعات.",
    social: "ضع اسم الحساب والرابط الكامل للملف الاجتماعي.",
    gallery: "أضف وصف الصورة ورابطها الآمن.",
  };
  const help = kindHelp[kind] || "أضف تسمية وقيمة اختيارية ورابطاً خارجياً عند الحاجة. الحد الأقصى 100 عنصر.";

  return (
    <div className="section-content-editor">
      <label className="field section-kind-field">نوع القسم
        <select name="kind" value={kind} onChange={event => changeKind(event.target.value)}>
          {sectionKinds.filter(sectionKind => sectionKind !== "reviews").map(sectionKind => <option value={sectionKind} key={sectionKind}>{labels[sectionKind] || sectionKind}</option>)}
        </select>
      </label>
      <div className="content-mode-switch" role="group" aria-label="طريقة تحرير المحتوى">
        <button type="button" className={mode === "items" ? "selected" : ""} aria-pressed={mode === "items"} onClick={showItems}>محرر الحقول</button>
        <button type="button" className={mode === "json" ? "selected" : ""} aria-pressed={mode === "json"} onClick={showJson}>JSON متقدم</button>
      </div>

      {mode === "items" ? (
        <>
          {(kind === "hero" || kind === "contact" || kind === "about" || kind === "reviews") && (
            <div className="form-grid content-fields">
              {kind === "hero" && <>
                <label className="field">لغة الصفحة
                  <select value={typeof base.language === "string" ? base.language : "ar"} onChange={event => updateField("language", event.target.value)}>
                    <option value="ar">العربية · RTL</option><option value="en">English · LTR</option>
                  </select>
                </label>
                <label className="field">اللون المميز
                  <span className="color-field"><input type="color" value={typeof base.color === "string" && /^#[0-9a-f]{6}$/i.test(base.color) ? base.color : "#bd8b37"} onChange={event => updateField("color", event.target.value)} /><input value={typeof base.color === "string" ? base.color : ""} dir="ltr" maxLength={7} onChange={event => updateField("color", event.target.value)} /></span>
                </label>
                <label className="field content-field-wide">عبارة قصيرة<input value={typeof base.tagline === "string" ? base.tagline : ""} dir="auto" maxLength={180} onChange={event => updateField("tagline", event.target.value)} /></label>
                <label className="field content-field-wide">وصف الصفحة<textarea value={typeof base.description === "string" ? base.description : ""} dir="auto" maxLength={1200} rows={3} onChange={event => updateField("description", event.target.value)} /></label>
                <label className="field content-field-wide">رابط صورة الغلاف<input value={typeof base.coverUrl === "string" ? base.coverUrl : ""} dir="ltr" inputMode="url" placeholder="https://" maxLength={2048} onChange={event => updateField("coverUrl", event.target.value)} /></label>
                <label className="field content-field-wide">رابط الشعار أو الصورة الشخصية<input value={typeof base.logoUrl === "string" ? base.logoUrl : ""} dir="ltr" inputMode="url" placeholder="https://" maxLength={2048} onChange={event => updateField("logoUrl", event.target.value)} /></label>
              </>}

              {kind === "contact" && <>
                <label className="field">رقم الاتصال<input value={typeof base.phone === "string" ? base.phone : ""} dir="ltr" inputMode="tel" autoComplete="tel" maxLength={40} onChange={event => updateField("phone", event.target.value)} /></label>
                <label className="field">واتساب (رقم دولي أو رابط)<input value={typeof base.whatsapp === "string" ? base.whatsapp : ""} dir="ltr" inputMode="tel" placeholder="2010..." maxLength={2048} onChange={event => updateField("whatsapp", event.target.value)} /></label>
                <label className="field">البريد الإلكتروني<input value={typeof base.email === "string" ? base.email : ""} dir="ltr" inputMode="email" autoComplete="email" maxLength={254} onChange={event => updateField("email", event.target.value)} /></label>
                <label className="field">العنوان<input value={typeof base.address === "string" ? base.address : ""} dir="auto" maxLength={300} onChange={event => updateField("address", event.target.value)} /></label>
                <label className="field content-field-wide">رابط الخرائط<input value={typeof base.mapsUrl === "string" ? base.mapsUrl : ""} dir="ltr" inputMode="url" placeholder="https://" maxLength={2048} onChange={event => updateField("mapsUrl", event.target.value)} /></label>
              </>}

              {kind === "about" && <label className="field content-field-wide">نبذة عن النشاط<textarea value={typeof base.description === "string" ? base.description : ""} dir="auto" maxLength={1200} rows={5} onChange={event => updateField("description", event.target.value)} /></label>}
              {kind === "reviews" && <label className="field content-field-wide">رابط تقييم Google<input value={typeof base.url === "string" ? base.url : ""} dir="ltr" inputMode="url" placeholder="https://" maxLength={2048} onChange={event => updateField("url", event.target.value)} /></label>}
            </div>
          )}

          {itemKinds.includes(kind) && (
            <>
              <p className="items-editor-help">{help}</p>
              <div className="editable-items">
                {items.map((item, index) => (
                  <fieldset className="editable-item" key={index}>
                    <legend>العنصر {index + 1}</legend>
                    <button className="small-button danger remove-item" type="button" onClick={() => removeItem(index)} aria-label={"حذف العنصر " + (index + 1)}>حذف</button>
                    <div className="form-grid">
                      <label className="field">الاسم<input required maxLength={80} value={item.label} dir="auto" onChange={event => updateItem(index, "label", event.target.value)} /></label>
                      <label className="field">القيمة أو التفاصيل<input maxLength={500} value={item.value} dir="auto" onChange={event => updateItem(index, "value", event.target.value)} /></label>
                      <label className="field item-url-field">الرابط (اختياري)<input maxLength={2048} value={item.url} dir="ltr" inputMode="url" placeholder="https://" onChange={event => updateItem(index, "url", event.target.value)} /></label>
                    </div>
                  </fieldset>
                ))}
              </div>
              {items.length === 0 && <p className="empty-items">لا توجد عناصر بعد. أضف أول عنصر لعرضه في صفحة النشاط.</p>}
              <button className="small-button add-item" type="button" onClick={addItem} disabled={items.length >= 100}>＋ إضافة عنصر</button>
            </>
          )}
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="content" value={getContent()} />
        </>
      ) : (
        <>
          <input type="hidden" name="kind" value={kind} />
          <label className="field json-content-field">محتوى القسم
            <textarea name="content" value={raw} onChange={event => setRaw(event.target.value)} dir="ltr" spellCheck={false} rows={10} />
            <small>أدخل كائن JSON صالحاً. يدعم كل قسم حتى 100 عنصر.</small>
          </label>
          {parseError && <p className="alert" role="alert">{parseError}</p>}
        </>
      )}
    </div>
  );
}
