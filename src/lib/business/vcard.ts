import { contactPhone, contactWeb, contactNote, contactConfigSchema, type ContactProjection } from "./contact";
import { dialablePhone, vcardPhoneType } from "./phone";
const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
/** Fold by UTF-8 octets, including the continuation space, without splitting code points. */
export function foldVCardLine(value: string) {
  let line = "", length = 0; const lines: string[] = [];
  for (const character of value) {
    const count = Buffer.byteLength(character, "utf8");
    if (length + count > 75) { lines.push(line); line = " "; length = 1; }
    line += character; length += count;
  }
  lines.push(line); return lines.join("\r\n");
}
export function serializeVCard(contact: ContactProjection, photo?: Uint8Array) {
  if (contact.version !== 1 || !contact.enabled || !contact.displayName.trim() || !contactPhone(contact.primaryPhone)) throw new Error("Invalid contact.");
  // Revalidate persisted projections before emitting any wire properties.
  contactConfigSchema.parse({ enabled: true, displayName: contact.displayName, organization: contact.organization, primaryPhone: contact.primaryPhone, primaryPhoneType: contact.primaryPhoneType, fields: contact.fields.map((field, i) => ({ ...field, id: String(i), enabled: true })) });
  const primaryPhone = dialablePhone(contact.primaryPhone);
  const phones = new Set([primaryPhone]);
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${escape(contact.displayName)}`, "N:;;;;", `ORG:${escape(contact.organization || contact.displayName)}`, `TEL;TYPE=${vcardPhoneType(contact.primaryPhoneType)}:${primaryPhone}`];
  const notes: string[] = [];
  const urls = new Set<string>();
  for (const field of contact.fields) {
    if (/[\u0000-\u0008\u000b-\u001f\u007f]/.test(field.value)) throw new Error("Invalid contact text.");
    if (field.kind === "phone") { const phone = dialablePhone(field.value); if (!phone) throw new Error("Invalid phone."); if (!phones.has(phone)) { phones.add(phone); lines.push(`TEL;TYPE=${vcardPhoneType(field.phoneType)}:${phone}`); } }
    else if (field.kind === "email") { if (field.value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) throw new Error("Invalid email."); lines.push(`EMAIL;TYPE=INTERNET:${escape(field.value)}`); }
    else if (["website", "social", "whatsapp"].includes(field.kind) || (["custom", "notes", "hours"].includes(field.kind) && contactWeb(field.value))) {
      if (!contactWeb(field.value)) throw new Error("Invalid URL.");
      if (!urls.has(field.value)) { lines.push(urlLine(field)); urls.add(field.value); }
    }
    else if (field.kind === "address") lines.push(`ADR;TYPE=WORK:;;${escape(field.value)};;;;`);
    else if (["hours", "notes", "custom"].includes(field.kind)) {
      const note = contactNote(field.value);
      for (const value of note.urls) if (!urls.has(value)) { lines.push(urlLine({ label: field.label, value })); urls.add(value); }
      if (note.text) notes.push(`${field.label || field.kind}: ${note.text}`);
    }
    else throw new Error("Unsupported contact property.");
  }
  const note = notes.join("\n");
  if (note.length > 8000 || Buffer.byteLength(note) > 32768) throw new Error("Contact notes too large.");
  if (note) lines.push(`NOTE:${escape(note)}`);
  if (photo && photo.length <= 200 * 1024) lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${Buffer.from(photo).toString("base64")}`);
  lines.push("END:VCARD");
  const result = lines.map(foldVCardLine).join("\r\n") + "\r\n";
  if (Buffer.byteLength(result) > 300 * 1024) throw new Error("Contact exceeds download limit.");
  return result;
}

function urlLine(field: { label: string; value: string }) {
  const label = field.label.trim().replace(/[^A-Za-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return label ? `URL;TYPE=${label}:${escape(field.value)}` : `URL:${escape(field.value)}`;
}
