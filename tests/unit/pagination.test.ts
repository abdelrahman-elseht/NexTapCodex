import { describe, expect, it } from "vitest";
import { cursorFilter, decodePageCursor, encodePageCursor, pageUrl } from "@/lib/admin/pagination";

describe("admin keyset pagination", () => {
  const cursor = { createdAt: "2026-01-02T03:04:05.000Z", id: "11111111-1111-4111-8111-111111111111" };

  it("round trips a cursor and creates directional predicates", () => {
    expect(decodePageCursor(encodePageCursor(cursor))).toEqual(cursor);
    expect(cursorFilter(cursor, "next")).toContain("created_at.lt.2026-01-02T03:04:05.000Z");
    expect(cursorFilter(cursor, "previous")).toContain("created_at.gt.");
  });

  it("rejects malformed and unsafe cursors", () => {
    expect(decodePageCursor("not-a-cursor")).toBeNull();
    expect(decodePageCursor(encodePageCursor({ createdAt: "bad", id: cursor.id }))).toBeNull();
    expect(decodePageCursor(encodePageCursor({ createdAt: cursor.createdAt, id: "not-an-id" }))).toBeNull();
  });

  it("preserves filters while changing only the cursor", () => {
    expect(pageUrl("/admin/businesses", { search: "cafe", status: "active", cursor: "abc" }))
      .toBe("/admin/businesses?search=cafe&status=active&cursor=abc");
  });
});
