import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ publicDownload: vi.fn(), privateDownload: vi.fn(), claims: vi.fn() }));
vi.mock("@/lib/media/read-object", () => ({ readManagedObject: async (_path: string, max: number, client?: unknown) => { const result = await (client ? mocks.privateDownload : mocks.publicDownload)(); return result.data && result.data.size <= max ? new Uint8Array(await result.data.arrayBuffer()) : undefined; } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.claims }, storage: { from: () => ({ download: mocks.privateDownload }) } }) }));
import { GET } from "@/app/api/media/[...path]/route";
import { mediaDisplayUrl, isOptimizableImage, managedMediaPath } from "@/lib/media/urls";
const path = "00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000003.webp";
const request = (assetPath = path) => GET(new Request(`http://localhost/api/media/${assetPath}`), { params: Promise.resolve({ path: assetPath.split("/") }) });
beforeEach(() => { vi.clearAllMocks(); mocks.publicDownload.mockResolvedValue({ error: {} }); mocks.privateDownload.mockResolvedValue({ error: {} }); mocks.claims.mockResolvedValue({ data: null }); });
it("denies anonymous draft reads without attempting a privileged download", async () => {
 const r = await request(); expect(r.status).toBe(404); expect(r.headers.get("cache-control")).toContain("no-store"); expect(mocks.privateDownload).not.toHaveBeenCalled();
});
it("serves authorized draft bytes privately and denies a revoked admission", async () => {
 mocks.claims.mockResolvedValue({ data: { claims: { sub: "internal" } } });
 mocks.privateDownload.mockResolvedValueOnce({ data: new Blob(["draft"]) });
 const r = await request(); expect(r.status).toBe(200); expect(await r.text()).toBe("draft"); expect(r.headers.get("cache-control")).toBe("private, no-store");
 expect((await request()).status).toBe(404);
});
it("serves published bytes with bounded public caching and no owner lookup", async () => {
 mocks.publicDownload.mockResolvedValue({ data: new Blob(["published"]) });
 const r = await request(); expect(r.status).toBe(200); expect(r.headers.get("cache-control")).toBe("public, max-age=60, must-revalidate"); expect(mocks.claims).not.toHaveBeenCalled();
});
it("maps only configured managed rasters and excludes private routes from optimization", () => {
 const origin="https://fixture.supabase.co";
 expect(mediaDisplayUrl(`${origin}/storage/v1/object/public/business-media/${path}`,origin)).toBe(`/api/media/${path}`);
 expect(mediaDisplayUrl(`https://foreign.test/storage/v1/object/public/business-media/${path}`,origin)).toContain("foreign.test");
 expect(isOptimizableImage(`/api/media/${path}`)).toBe(false);
 const avifPath = path.replace(/\.webp$/, ".avif");
 expect(managedMediaPath.test(avifPath)).toBe(true);
 expect(isOptimizableImage(`${origin}/storage/v1/object/public/business-media/${avifPath}`, origin)).toBe(true);
});
it("serves AVIF bytes with the matching content type", async () => {
 const avifPath = path.replace(/\.webp$/, ".avif");
 mocks.publicDownload.mockResolvedValue({ data: new Blob(["avif"]) });
 const response = await request(avifPath);
 expect(response.status).toBe(200);
 expect(response.headers.get("content-type")).toBe("image/avif");
});
it("rejects traversal, SVG and oversized responses", async () => {
 for (const invalid of [["..","secret"],["icon.svg"]]) expect((await GET(new Request("http://localhost/api/media/invalid"),{params:Promise.resolve({path:invalid})})).status).toBe(404);
 expect(mocks.publicDownload).not.toHaveBeenCalled();
 mocks.publicDownload.mockResolvedValue({data:new Blob([new Uint8Array(5*1024*1024+1)])}); expect((await request()).status).toBe(404);
});
