import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ rpc }) }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }));

describe("public publication resolver", () => {
  beforeEach(() => rpc.mockReset());

  it("resolves the live pointer, then reads the immutable snapshot", async () => {
    rpc.mockResolvedValueOnce({ data: { publicationId: "11111111-1111-4111-8111-111111111111", version: 2 }, error: null });
    rpc.mockResolvedValueOnce({ data: { publicationId: "11111111-1111-4111-8111-111111111111", version: 2, sections: [] }, error: null });
    const { getPublicPublication } = await import("../../src/lib/business/public-publication");
    await expect(getPublicPublication("cairo-shop")).resolves.toMatchObject({ version: 2 });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["get_publication_pointer", "get_publication_snapshot"]);
  });

  it("falls back to the existing live RPC when the snapshot read misses", async () => {
    rpc.mockResolvedValueOnce({ data: { publicationId: "11111111-1111-4111-8111-111111111111" }, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: new Error("cache fill failed") });
    rpc.mockResolvedValueOnce({ data: { publicationId: "11111111-1111-4111-8111-111111111111", version: 1 }, error: null });
    const { getPublicPublication } = await import("../../src/lib/business/public-publication");
    await expect(getPublicPublication("fallback-shop")).resolves.toMatchObject({ version: 1 });
    expect(rpc.mock.calls[2][0]).toBe("get_published_page");
  });

  it("does not attempt a snapshot read when the live pointer is absent", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    const { getPublicPublication } = await import("../../src/lib/business/public-publication");
    await expect(getPublicPublication("disabled-shop")).resolves.toBeNull();
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["get_publication_pointer", "get_published_page"]);
  });
});
