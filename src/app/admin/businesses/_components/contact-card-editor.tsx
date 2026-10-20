"use client";
import { phoneTypes, dialablePhone } from "@/lib/business/phone";
import { contactKinds, compileContact, contactBindingAllowed, type ContactConfig } from "@/lib/business/contact";
import { ImageField, type UploadTracker } from "./image-field";
import { contactPhotoUrl } from "@/lib/business/contact-crop";
import { ContactPhotoEditor } from "./contact-photo-editor";

type Section = { section_key?: string; key?: string; kind: string; enabled: boolean; content: Record<string, unknown> };
export function ContactCardEditor({ config, onChange, name, branchName, sections, businessId, track, onDownload }: {
  config: ContactConfig; onChange: (config: ContactConfig) => void; name: string; branchName?: string; sections: Section[];
  businessId: string; track: UploadTracker; onDownload: () => void;
}) {
  let validation = "";
  try { compileContact(config, { business: { name }, page: { branchName }, sections }); } catch (error) { validation = error instanceof Error ? error.message : "Check contact fields."; }
  const fieldError = (field: ContactConfig["fields"][number]) => {
    if (!config.enabled || !field.enabled) return "";
    try { compileContact({ ...config, fields: [field] }, { business: { name }, page: { branchName }, sections }); return ""; }
    catch (error) { const message = error instanceof Error ? error.message : "Check this field."; return /Display name:|Primary phone:/.test(message) ? "" : message; }
  };
  const patch = (value: Partial<ContactConfig>) => onChange({ ...config, ...value });
  const photoUrl = contactPhotoUrl(config, sections);
  const updateField = (id: string, value: Partial<ContactConfig["fields"][number]>) => patch({ fields: config.fields.map(field => field.id === id ? { ...field, ...value } : field) });
  const bindings = sections.filter(section => section.enabled && section.kind !== "gallery").flatMap(section => {
    const sectionKey = section.section_key || section.key || "";
    const candidates: { label: string; isPhone?: boolean; binding: NonNullable<ContactConfig["fields"][number]["binding"]> }[] = [];
    for (const property of ["phone", "email", "address"] as const) if (section.kind !== "payments" && typeof section.content[property] === "string" && section.content[property]) candidates.push({ label: `${sectionKey}: ${property}`, isPhone: property === "phone", binding: { sectionKey, property } });
    if (Array.isArray(section.content.items)) for (const item of section.content.items.flatMap(item => [item, ...(item.enabled !== false && Array.isArray(item.actions) ? item.actions : [])])) {
      if (!item.id || item.enabled === false) continue;
      for (const property of ["value", "url"] as const) if (item[property] && contactBindingAllowed(item, property) && (section.kind !== "payments" || item.provider === "instapay")) candidates.push({ label: `${sectionKey}: ${item.label || item.provider || item.id} (${property})`, isPhone: property === "value" && ["phone", "call"].includes(item.provider) && Boolean(dialablePhone(item.value)), binding: { sectionKey, itemId: item.id, property } });
    }
    return candidates;
  });
  return <details className="contact-card-editor editor-panel" open>
    <summary><strong>Add to Contacts</strong></summary>
    <p>Choose the details visitors can import. Only Publish changes the public contact card.</p>
    <label className="toggle-control"><input type="checkbox" checked={config.enabled} onChange={event => patch({ enabled: event.target.checked })} />Enable contact download</label>
    <label className="toggle-control"><input type="checkbox" checked={config.showDownloadLink !== false} onChange={event => patch({ showDownloadLink: event.target.checked })} />Show Download Contact Link</label>
    <div className="form-grid">
      <label className="field">Display name<input maxLength={2000} value={config.displayName} disabled={config.nameFromPage} onChange={event => patch({ displayName: event.target.value })} /></label>
      <label className="toggle-control"><input type="checkbox" checked={config.nameFromPage} onChange={event => patch({ nameFromPage: event.target.checked })} />Use this page’s name ({branchName || name})</label>
      <label className="field">Organization<input maxLength={2000} value={config.organization} onChange={event => patch({ organization: event.target.value })} /></label>
      <label className="field">Primary phone<input dir="ltr" inputMode="tel" maxLength={100} value={config.primaryPhone} disabled={config.phoneFromPage || Boolean(config.primaryPhoneBinding || config.primaryPhoneFieldId)} onChange={event => patch({ primaryPhone: event.target.value })} /></label>
      <label className="toggle-control"><input type="checkbox" checked={config.phoneFromPage} onChange={event => patch({ phoneFromPage: event.target.checked, primaryPhoneBinding: undefined, primaryPhoneFieldId: undefined })} />Use this page’s Find us phone</label>
      <label className="field">Primary phone source<select value={config.primaryPhoneFieldId ? `field:${config.primaryPhoneFieldId}` : config.primaryPhoneBinding ? JSON.stringify(config.primaryPhoneBinding) : ""} onChange={event => patch({ primaryPhoneFieldId: event.target.value.startsWith("field:") ? event.target.value.slice(6) : undefined, primaryPhoneBinding: event.target.value && !event.target.value.startsWith("field:") ? JSON.parse(event.target.value) : undefined, phoneFromPage: false })}><option value="">Explicit phone / Find us</option>{config.fields.filter(field => field.enabled && field.kind === "phone").map(field => <option key={field.id} value={`field:${field.id}`}>Contact: {field.label || field.value || "Phone"}</option>)}{config.primaryPhoneFieldId && !config.fields.some(field => field.id === config.primaryPhoneFieldId && field.enabled && field.kind === "phone") && <option value={`field:${config.primaryPhoneFieldId}`}>Unavailable contact phone — repair or override</option>}{config.primaryPhoneBinding && !bindings.some(option => JSON.stringify(option.binding) === JSON.stringify(config.primaryPhoneBinding)) && <option value={JSON.stringify(config.primaryPhoneBinding)}>Unavailable phone — repair or override</option>}{bindings.filter(option => option.isPhone).map(option => <option key={JSON.stringify(option.binding)} value={JSON.stringify(option.binding)}>{option.label}</option>)}</select></label>
      <label className="field">Primary phone type<select disabled={Boolean(config.primaryPhoneBinding || config.primaryPhoneFieldId)} value={config.primaryPhoneBinding || config.primaryPhoneFieldId ? "" : config.primaryPhoneType || "work"} onChange={event => patch({ primaryPhoneType: event.target.value as typeof phoneTypes[number] })}>{(config.primaryPhoneBinding || config.primaryPhoneFieldId) && <option value="">Use saved phone type</option>}{phoneTypes.map(type => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}</select></label>
      <p className="field-wide">{config.photoUrl || config.photoAssetId ? "Using a custom Contact Photo. Remove it to restore the Business Logo." : "The Business Logo is used automatically. No second upload is needed."} Only managed images from this business can be included in a contact file; other images produce a text-only contact.</p>
      <ImageField businessId={businessId} label="Custom Contact Photo" role="logo" value={config.photoUrl} alt="Contact photo" onAltChange={() => {}} onChange={photoUrl => patch({ photoUrl, photoAssetId: undefined, photoCrop: undefined })} onAsset={(photoUrl, photoAssetId) => patch({ photoUrl, photoAssetId, photoCrop: undefined })} track={track} />
      {photoUrl && <ContactPhotoEditor key={photoUrl} src={photoUrl} crop={config.photoCrop} onApply={photoCrop => patch({ photoCrop })} />}
    </div>
    <div className="contact-field-list">{config.fields.map((field, index) => <fieldset key={field.id} className="contact-field-row">
      <legend>Contact field {index + 1}</legend>
      <div className="form-grid">
        <label className="field">Type<select value={field.kind} onChange={event => updateField(field.id, { kind: event.target.value as typeof field.kind })}>{contactKinds.map(kind => <option key={kind}>{kind}</option>)}</select></label>
        {field.kind === "phone" && <label className="field">Phone type<select value={field.phoneType || (field.binding ? "" : "work")} onChange={event => updateField(field.id, { phoneType: event.target.value ? event.target.value as typeof phoneTypes[number] : undefined })}>{field.binding && <option value="">Use saved phone type</option>}{phoneTypes.map(type => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}</select></label>}
        <label className="field">Label<input maxLength={100} value={field.label} onChange={event => updateField(field.id, { label: event.target.value })} /></label>
        <label className="field">Value source<select value={field.binding ? JSON.stringify(field.binding) : ""} onChange={event => updateField(field.id, { binding: event.target.value ? JSON.parse(event.target.value) : undefined })}><option value="">Explicit value</option>{field.binding && !bindings.some(option => JSON.stringify(option.binding) === JSON.stringify(field.binding)) && <option value={JSON.stringify(field.binding)}>Unavailable binding — repair or override</option>}{bindings.map(option => <option key={JSON.stringify(option.binding)} value={JSON.stringify(option.binding)}>{option.label}</option>)}</select></label>
        <label className="field">Value<textarea rows={2} maxLength={2000} disabled={Boolean(field.binding)} value={field.value} onChange={event => updateField(field.id, { value: event.target.value })} /></label>
      </div>
      {fieldError(field) && <p className="alert" role="alert">{fieldError(field)}</p>}
      <div className="contact-field-actions"><label className="toggle-control"><input type="checkbox" checked={field.enabled} onChange={event => updateField(field.id, { enabled: event.target.checked })} />Include in contact</label>{[-1, 1].map(offset => <button className="button secondary" type="button" key={offset} disabled={index + offset < 0 || index + offset >= config.fields.length} aria-label={`Move contact field ${index + 1} ${offset < 0 ? "up" : "down"}`} onClick={() => { const fields = [...config.fields]; [fields[index], fields[index + offset]] = [fields[index + offset], fields[index]]; patch({ fields }); }}>{offset < 0 ? "Move up" : "Move down"}</button>)}<button type="button" className="button secondary" onClick={() => patch({ fields: config.fields.filter(item => item.id !== field.id) })}>Remove field</button></div>
    </fieldset>)}</div>
    <div className="contact-field-actions"><button type="button" className="button secondary" disabled={config.fields.length >= 30} onClick={() => patch({ fields: [...config.fields, { id: crypto.randomUUID(), kind: "phone", label: "", value: "", enabled: true }] })}>Add contact field</button><button type="button" className="button secondary" disabled={!config.enabled || Boolean(validation)} onClick={onDownload}>Test contact download</button><span>{config.fields.length}/30 optional fields</span></div>
    {validation && <p className="alert" role="alert">{validation}</p>}
    <p className="muted">Your device asks you to confirm import. Cancel or repeat import in your Contacts app; downloading does not silently save or synchronize contacts.</p>
  </details>;
}
