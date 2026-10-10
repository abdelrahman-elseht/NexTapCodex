import { beforeEach, expect, it, vi } from "vitest";
import sharp from "sharp";
const mocks = vi.hoisted(() => ({ owner: vi.fn(), business: vi.fn(), store: vi.fn() }));
vi.mock("@/lib/auth/owner", () => ({ requireOwner: mocks.owner }));
vi.mock("@/lib/media/store", () => ({ storeManagedImage: mocks.store }));
import { POST } from "../app/api/admin/media/route";
const businessId = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks(); mocks.owner.mockResolvedValue({ userId: "owner", supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.business }) }) }) } });
  mocks.business.mockResolvedValue({ data: { id: businessId }, error: null }); mocks.store.mockResolvedValue({ url: "https://fixture/image.webp" });
});
async function request(bytes?: Uint8Array, id = businessId) {
  const fd = new FormData(); fd.set("businessId", id); fd.set("role", "photo");
  fd.set("file", new Blob([new Uint8Array(bytes || await sharp({ create: { width: 20, height: 20, channels: 3, background: "red" } }).png().toBuffer())], { type: "text/plain" }), "fake.txt");
  return new Request("http://localhost/api/admin/media", { method: "POST", body: fd, headers: { origin: "http://localhost" } });
}
it("denies anonymous owner redirects without uploading", async () => {
  mocks.owner.mockRejectedValue({ digest: "NEXT_REDIRECT;replace;/login;307;" });
  expect((await POST(await request())).status).toBe(401); expect(mocks.store).not.toHaveBeenCalled();
});
it("denies inaccessible businesses and cross-origin uploads", async () => {
  mocks.business.mockResolvedValue({ data: null, error: null });
  expect((await POST(await request())).status).toBe(403);
  expect((await POST(new Request("http://localhost/api/admin/media", { method: "POST", headers: { origin: "https://other.test" } }))).status).toBe(403);
  expect(mocks.store).not.toHaveBeenCalled();
});
it("authoritatively decodes despite fake MIME and filename, rejects corrupt input", async () => {
  expect((await POST(await request())).status).toBe(200);
  expect(mocks.store.mock.calls[0][3].width).toBe(20);
  expect((await POST(await request(new Uint8Array([1, 2, 3])))).status).toBe(422);
});
it("bounds chunked bodies and rejects oversized declared requests", async () => {
  const bytes = new Uint8Array(3 * 1024 * 1024 + 32769);
  const chunked = new Request("http://localhost/api/admin/media", { method: "POST", body: bytes });
  expect((await POST(chunked)).status).toBe(413);
  expect((await POST(new Request("http://localhost/api/admin/media", { method: "POST", headers: { "content-length": String(bytes.length) } }))).status).toBe(413);
  expect(mocks.store).not.toHaveBeenCalled();
});
