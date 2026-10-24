export const sectionTextDefaults: Record<string, { eyebrow: string; description: string }> = {
  social: { eyebrow: "STAY CONNECTED", description: "Follow us for updates, offers and more." },
  payments: { eyebrow: "PAY YOUR WAY", description: "Choose an option provided by the business." },
  hours: { eyebrow: "OPENING HOURS", description: "Great coffee, every day." },
  contact: { eyebrow: "LOCATE US & DIRECTIONS", description: "" },
  about: { eyebrow: "ABOUT", description: "" },
};

export function sectionText(content: Record<string, unknown>, kind: string, field: "eyebrow" | "description" | "badge") {
  if (typeof content[field] === "string") {
    // About body copy is intentionally multiline; preserve it for the public
    // pre-line renderer instead of trimming meaningful whitespace.
    if (kind === "about" && field === "description") return content[field] as string;
    return (content[field] as string).trim();
  }
  if (field === "badge") return "";
  return sectionTextDefaults[kind]?.[field] ?? (field === "eyebrow" && !["hero", "gallery", "quick_actions"].includes(kind) ? kind.toUpperCase() : "");
}
