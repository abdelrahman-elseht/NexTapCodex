import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ prepare: vi.fn(), upload: vi.fn(), remove: vi.fn(), insert: vi.fn(), publicUrl: vi.fn() }));
vi.mock("@/lib/media/contact-photo", () => ({ prepareContactPhoto: mocks.prepare }));
import { storeManagedImage } from "@/lib/media/store";
import type { SupabaseClient } from "@supabase/supabase-js";

const image = { bytes: Buffer.from([1, 2]), size: 2, width: 2, height: 1 };
function client() {
  return { storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove, getPublicUrl: mocks.publicUrl }) }, from: () => ({ insert: mocks.insert }) } as unknown as SupabaseClient;
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.prepare.mockResolvedValue(new Uint8Array([3, 4]));
  mocks.upload.mockResolvedValue({ error: null }); mocks.remove.mockResolvedValue({ error: null });
  mocks.insert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "asset" }, error: null }) }) });
  mocks.publicUrl.mockReturnValue({ data: { publicUrl: "https://fixture.supabase.co/object/public/business-media/path.webp" } });
});
it("cleans up the original if the required contact derivative cannot be written", async () => {
  mocks.upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: new Error("derivative failed") });
  await expect(storeManagedImage(client(), "owner", "business", image, "Cover")).rejects.toThrow("Could not register the image");
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.remove).toHaveBeenCalledWith(expect.arrayContaining([expect.stringMatching(/\.webp$/), expect.stringMatching(/\.contact\.jpg$/)]));
});
it("cleans up both objects if metadata registration fails", async () => {
  mocks.insert.mockReturnValue({ select: () => ({ single: async () => ({ data: null, error: new Error("metadata failed") }) }) });
  await expect(storeManagedImage(client(), "owner", "business", image, "Cover")).rejects.toThrow("Could not register the image");
  expect(mocks.upload).toHaveBeenCalledTimes(2);
  expect(mocks.remove).toHaveBeenCalledWith(expect.arrayContaining([expect.stringMatching(/\.webp$/), expect.stringMatching(/\.contact\.jpg$/)]));
});
it("returns the immutable managed path after both derivatives and metadata commit", async () => {
  await expect(storeManagedImage(client(), "owner", "business", image, "Cover")).resolves.toMatchObject({ url: "https://fixture.supabase.co/object/public/business-media/path.webp", photoAssetId: "asset", width: 2, height: 1 });
  expect(mocks.remove).not.toHaveBeenCalled();
});
