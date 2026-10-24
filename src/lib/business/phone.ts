/** Dialing safety only: never infer a country, carrier, or subscriber length. */
export const phoneTypes = ["mobile", "landline", "work", "other"] as const;
export type PhoneType = typeof phoneTypes[number];

export function dialablePhone(value: string): string {
  if (!value || /[^+0-9*# ().-]/.test(value)) return "";
  const number = value.replace(/[ ().-]/g, "");
  return /^\+?[0-9*#]+$/.test(number) && /[0-9]/.test(number) ? number : "";
}

export function telephoneHref(value: string): string {
  const number = dialablePhone(value);
  return number ? `tel:${number.replace(/#/g, "%23")}` : "";
}

export function vcardPhoneType(type?: PhoneType): string {
  return type === "mobile" ? "CELL" : type === "other" ? "VOICE" : "WORK,VOICE";
}
