import { describe, expect, it } from "vitest";
import { encodePageCursor } from "../../src/lib/admin/pagination";
import { parseCardInventoryQuery } from "../../src/lib/admin/card-inventory";

const id = "11111111-1111-4111-8111-111111111111";
const validCursor = encodePageCursor({ createdAt: "2026-01-02T03:04:05.000Z", id });

describe("admin card inventory query parsing", () => {
  it("uses safe defaults when filters are omitted or blank", () => {
    expect(parseCardInventoryQuery({ search: "", status: "", batch: "", page_id: "" })).toMatchObject({
      searchText: "",
      searchIsSafe: true,
      search: "",
      status: "",
      batchId: "",
      pageId: "",
      pageSearch: "",
      batchDirection: "next",
      batchCursor: null,
      direction: "next",
      cursor: null,
    });
  });

  it("keeps valid filters and decodes both pagination cursors", () => {
    const filters = parseCardInventoryQuery({
      search: " NT-123 ",
      status: "active",
      batch: id,
      page_id: id,
      page_search: " Cairo ",
      batch_cursor: validCursor,
      batch_direction: "previous",
      cursor: validCursor,
      direction: "previous",
    });

    expect(filters).toMatchObject({
      searchText: "NT-123",
      searchIsSafe: true,
      search: "NT-123",
      status: "active",
      batchId: id,
      pageId: id,
      pageSearch: "Cairo",
      batchDirection: "previous",
      direction: "previous",
      batchCursor: { createdAt: "2026-01-02T03:04:05.000Z", id },
      cursor: { createdAt: "2026-01-02T03:04:05.000Z", id },
    });
  });

  it("drops unsafe filters and malformed cursors before they reach PostgREST", () => {
    expect(parseCardInventoryQuery({
      search: "serial%,token",
      status: "unknown",
      batch: "not-a-uuid",
      page_id: "not-a-uuid",
      batch_cursor: "invalid",
      cursor: "invalid",
      batch_direction: "sideways",
      direction: "sideways",
    })).toMatchObject({
      searchText: "serial%,token",
      searchIsSafe: false,
      search: "",
      status: "",
      batchId: "",
      pageId: "",
      batchCursor: null,
      cursor: null,
      batchDirection: "next",
      direction: "next",
    });
  });

  it("caps raw search lengths while retaining the validated display value", () => {
    const filters = parseCardInventoryQuery({ search: "x".repeat(100), page_search: "y".repeat(100) });
    expect(filters.searchText).toHaveLength(64);
    expect(filters.search).toHaveLength(64);
    expect(filters.pageSearch).toHaveLength(80);
  });
});
