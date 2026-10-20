import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ rpc }) }));
import { contactResponse, downloadContact, readContactPhoto } from "@/lib/business/contact-download";
const contact = { version: 1 as const, enabled: true as const, displayName: "Synthetic QA", organization: "QA", primaryPhone: "+201012345678", fields: [] };
const path = "00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000003.contact.jpg";
beforeEach(() => { vi.restoreAllMocks(); rpc.mockReset(); });
describe("fresh public contact responses", () => {
  it.each([false, true])("checks current publication for GET/HEAD (HEAD=%s)", async head => {
    rpc.mockResolvedValue({ data: { contact }, error: null });
    const response = await downloadContact({ slug: "synthetic-qa" }, head);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/vcard; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('inline; filename="business-contact.vcf"');
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(await response.text()).toMatch(head ? /^$/ : /^BEGIN:VCARD\r\nVERSION:3.0/);
    expect(rpc).toHaveBeenCalledWith("get_published_page", { page_slug: "synthetic-qa" });
  });
  it("keeps a forced attachment fallback available", async () => {
    expect((await contactResponse(contact, false, true)).headers.get("content-disposition")).toBe('attachment; filename="business-contact.vcf"');
  });
  it("never reuses a successful response after disable or card reassignment", async () => {
    rpc.mockResolvedValueOnce({ data: contact }).mockResolvedValueOnce({ data: null });
    const identity = { token: "c".repeat(40) };
    expect((await downloadContact(identity)).status).toBe(200);
    const denied = await downloadContact(identity);
    expect(denied.status).toBe(404); expect(await denied.text()).toBe("Not found");
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith("get_card_contact", { card_token: identity.token });
  });
  it.each([null, {}, { contact: { ...contact, enabled: false } }, { contact: { ...contact, version: 2 } }])("denies old, missing and disabled contacts", async data => {
    rpc.mockResolvedValue({ data });
    expect((await downloadContact({ slug: "synthetic-qa" })).status).toBe(404);
  });
  it("returns generic dependency errors with no HEAD body", async () => {
    rpc.mockResolvedValue({ error: { message: "sensitive" } });
    const get = await downloadContact({ slug: "synthetic-qa" });
    expect(get.status).toBe(503); expect(await get.text()).toBe("Service unavailable");
    expect(await (await downloadContact({ slug: "synthetic-qa" }, true)).text()).toBe("");
  });
  it("rejects malformed identities before database access", async () => {
    expect((await downloadContact({ token: "invalid" })).status).toBe(404);
    expect((await downloadContact({ slug: "../../draft" })).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });
});
describe("bounded immutable photo fetch", () => {
  it("never fetches arbitrary URLs or traversal", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    expect(await readContactPhoto("https://attacker.test/image.jpg")).toBeUndefined();
    expect(await readContactPhoto("../private.jpg")).toBeUndefined(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("falls back to text for missing, oversized or invalid media", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    for (const response of [new Response(null, { status: 404 }), new Response("bad"), new Response(new Uint8Array(201 * 1024))]) {
      fetcher.mockResolvedValueOnce(response); expect(await readContactPhoto(path)).toBeUndefined();
    }
  });
  it("reads an approved JPEG with a request deadline and no shared cache", async () => {
    const bytes = new Uint8Array([255, 216, 255, 217]);
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(bytes));
    expect(await readContactPhoto(path)).toEqual(Buffer.from(bytes));
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: "no-store", redirect: "error" });
    expect(fetcher.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
