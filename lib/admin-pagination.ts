export const ADMIN_PAGE_SIZE = 25;

export type PageCursor = { createdAt: string; id: string };

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function encodePageCursor(cursor: PageCursor) {
  return toBase64Url(JSON.stringify(cursor));
}

export function decodePageCursor(value: string | undefined): PageCursor | null {
  if (!value || value.length > 300) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(value)) as Partial<PageCursor>;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") return null;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.id)) return null;
    if (!Number.isFinite(Date.parse(parsed.createdAt)) || new Date(parsed.createdAt).toISOString() !== parsed.createdAt) return null;
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

export function cursorFilter(cursor: PageCursor, direction: "next" | "previous") {
  const op = direction === "next" ? "lt" : "gt";
  return `created_at.${op}.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.${op}.${cursor.id})`;
}

export function pageUrl(path: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const encoded = query.toString();
  return encoded ? `${path}?${encoded}` : path;
}

export function cursorForRow(row: { created_at: string; id: string }): PageCursor {
  return { createdAt: row.created_at, id: row.id };
}
