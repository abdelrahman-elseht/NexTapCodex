import { beforeEach, expect, it, vi } from "vitest";
const { claims, lookup } = vi.hoisted(() => ({ claims: vi.fn(), lookup: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: claims }, from: (table: string) => {
  const query = { select: () => query, eq: () => query, maybeSingle: () => lookup(table) }; return query;
} }) }));
import { POST } from "@/app/api/admin/businesses/contact-preview/route";
const draft = { pageId: "page", businessId: "business", name: "QA", sections: [], contact: { enabled: true, displayName: "QA", organization: "QA", primaryPhone: "01012345678", fields: [] } };
function request(value: unknown = draft, origin = "http://127.0.0.1:3137") {
  const form = new FormData(); form.set("draft", JSON.stringify(value));
  return new Request("http://127.0.0.1:3137/api/admin/businesses/contact-preview", { method: "POST", headers: { origin }, body: form });
}
beforeEach(() => { claims.mockReset().mockResolvedValue({ data: { claims: { sub: "owner" } } }); lookup.mockReset().mockImplementation(table => Promise.resolve({ data: table === "owner_users" ? { user_id: "owner" } : table === "business_pages" ? { id: "page", branch_name: "Branch" } : null })); });
it("requires same-origin owner authorization", async () => {
  expect((await POST(request(draft, "https://attacker.test"))).status).toBe(404);
  expect(claims).not.toHaveBeenCalled();
  claims.mockResolvedValueOnce({ data: null });
  expect((await POST(request())).status).toBe(404);
  lookup.mockResolvedValueOnce({ data: null });
  expect((await POST(request())).status).toBe(404);
});
it("rejects a page outside the selected business and foreign media", async () => {
  lookup.mockImplementation(table => Promise.resolve({ data: table === "owner_users" ? { user_id: "owner" } : null }));
  expect((await POST(request())).status).toBe(404);
  lookup.mockImplementation(table => Promise.resolve({ data: table === "owner_users" ? { user_id: "owner" } : table === "business_pages" ? { id: "page" } : null }));
  expect((await POST(request({ ...draft, contact: { ...draft.contact, photoAssetId: "00000000-0000-4000-8000-000000000001" } }))).status).toBe(400);
});
it("privately previews unsaved branch values without a publication write", async () => {
  const response = await POST(request({ ...draft, contact: { ...draft.contact, nameFromPage: true } }));
  expect(response.status).toBe(200); expect(await response.text()).toContain("FN:Branch");
  expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
});
it("accepts the browser Host origin when Next reconstructs a localhost URL", async () => {
  const original = request();
  original.headers.set("host", "127.0.0.1:3137");
  const proxied = new Request("http://localhost:3137/api/admin/businesses/contact-preview", original);
  expect((await POST(proxied)).status).toBe(200);
  proxied.headers.set("origin", "https://attacker.test");
  expect((await POST(proxied)).status).toBe(404);
});
it("bounds the actual body even without a content-length header", async () => {
  expect((await POST(request({ padding: "x".repeat(257 * 1024) }))).status).toBe(404);
});
