import { imageEditSchema, type ImageEdit } from "@/lib/media/image-edit";
import { resolveProviderItem, type ProviderProfile } from "./providers";
import type { PhoneType } from "./phone";

export type EditorItem = {
  id: string;
  label: string;
  value: string;
  url: string;
  subtitle?: string;
  badge?: string;
  alt?: string;
  imageEdit?: ImageEdit;
  provider?: string;
  enabled?: boolean;
  icon?: string;
  phoneType?: PhoneType;
  destinationStrategy?: string;
  profileOverride?: boolean;
  actions?: EditorItem[];
};

export function createEditorItem(provider?: string): EditorItem {
  return { id: crypto.randomUUID(), label: "", value: "", url: "", enabled: true, ...(provider ? { provider } : {}), ...(["phone", "call"].includes(provider || "") ? { phoneType: "mobile" as const } : {}) };
}

// Upgrade legacy JSON once at the section boundary. IDs survive edits, moves and saves.
// Hours and images are local content, never a source of provider destinations.
export function normalizeEditorItems(value: unknown, kind: string, scope: string): EditorItem[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  return value.slice(0, 100).flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const text = (key: string) => typeof item[key] === "string" ? item[key] as string : "";
    let id = text("id") || `${scope}-item-${index}`;
    while (used.has(id)) id += `-${index}`;
    used.add(id);
    const local = kind === "hours" || kind === "gallery";
    return [{
      id, label: text("label"), value: text("value"), url: kind === "hours" ? "" : text("url"),
      ...(kind === "gallery" ? { imageEdit: imageEditSchema.safeParse(item.imageEdit).data } : {}),
      subtitle: text("subtitle"), badge: text("badge"), alt: text("alt"), enabled: item.enabled !== false,
      provider: local ? undefined : text("provider") || undefined,
      phoneType: ["mobile", "landline", "work", "other"].includes(text("phoneType")) ? text("phoneType") as PhoneType : undefined,
      icon: local ? undefined : text("icon") || undefined,
      destinationStrategy: local ? undefined : text("destinationStrategy") || undefined,
      profileOverride: local || item.profileOverride === true,
      ...(kind === "services" ? { actions: normalizeEditorItems(item.actions, "quick_actions", id) } : {}),
    }];
  });
}

export function resolveSectionItems(items: EditorItem[], kind: string, profiles: Record<string, ProviderProfile>) {
  if (kind === "hours" || kind === "gallery") return items;
  return items.map(item => ({ ...resolveProviderItem(item, profiles), ...(item.actions ? {
    actions: item.actions.map(action => resolveProviderItem(action, profiles)),
  } : {}) }));
}

// Copy the resolved destination, never an inherited mutable account reference.
export function duplicateEditorItem(item: EditorItem): EditorItem {
  return { ...item, id: crypto.randomUUID(), profileOverride: true, ...(item.actions ? { actions: item.actions.map(duplicateEditorItem) } : {}) };
}
