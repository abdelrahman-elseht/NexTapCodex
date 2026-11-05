import { beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
const captureOperationError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ rpc }) }));
vi.mock("@/lib/observability/operations", () => ({ captureOperationError }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }));
import { getPublicPublication } from "../../src/lib/business/public-publication";

describe("public publication resolver", () => {
  beforeEach(() => {
    rpc.mockReset();
    captureOperationError.mockReset();
  });

  it("resolves the live pointer, then reads the immutable snapshot", async () => {
    rpc.mockResolvedValueOnce({ data: { publicationId: "11111111-1111-4111-8111-111111111111", version: 2 }, error: null });
    rpc.mockResolvedValueOnce({ data: { publicationId: "11111111-1111-4111-8111-111111111111", version: 2, sections: [] }, error: null });
    await expect(getPublicPublication("cairo-shop")).resolves.toMatchObject({ version: 2 });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["get_publication_pointer", "get_publication_snapshot"]);
  });

  it("falls back to the existing live RPC when the snapshot read misses", async () => {
    rpc.mockResolvedValueOnce({ data: { publicationId: "11111111-1111-4111-8111-111111111111" }, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: new Error("cache fill failed") });
    rpc.mockResolvedValueOnce({ data: { publicationId: "11111111-1111-4111-8111-111111111111", version: 1 }, error: null });
    await expect(getPublicPublication("fallback-shop")).resolves.toMatchObject({ version: 1 });
    expect(rpc.mock.calls[2][0]).toBe("get_published_page");
  });

  it("does not attempt a snapshot read when the live pointer is absent", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(getPublicPublication("disabled-shop")).resolves.toBeNull();
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["get_publication_pointer", "get_published_page"]);
  });

  it("falls back when a pointer contains a malformed publication id", async () => {
    const publicationId = "11111111-1111-4111-8111-111111111111";
    rpc.mockResolvedValueOnce({ data: { publicationId: `${publicationId}-extra` }, error: null });
    rpc.mockResolvedValueOnce({ data: { version: 1 }, error: null });
    rpc.mockResolvedValueOnce({ data: { publicationId: `prefix-${publicationId}` }, error: null });
    rpc.mockResolvedValueOnce({ data: { version: 1 }, error: null });
    await expect(getPublicPublication("malformed-pointer-shop")).resolves.toMatchObject({ version: 1 });
    await expect(getPublicPublication("prefixed-pointer-shop")).resolves.toMatchObject({ version: 1 });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "get_publication_pointer", "get_published_page",
      "get_publication_pointer", "get_published_page",
    ]);
  });

  it("reports a pointer error when compatibility fallback also fails", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error("pointer network failure") });
    rpc.mockResolvedValueOnce({ data: null, error: new Error("fallback network failure") });
    await expect(getPublicPublication("failed-publication-shop")).resolves.toBeNull();
    expect(captureOperationError).toHaveBeenCalledWith(expect.any(Error), "public.publication.read");
  });

  it("reuses compatibility fallback after the pointer RPC is unavailable", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error("Could not find the function public.get_publication_pointer") });
    rpc.mockResolvedValueOnce({ data: { version: 1 }, error: null });
    rpc.mockResolvedValueOnce({ data: { version: 1 }, error: null });
    await expect(getPublicPublication("legacy-first-shop")).resolves.toMatchObject({ version: 1 });
    await expect(getPublicPublication("legacy-second-shop")).resolves.toMatchObject({ version: 1 });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "get_publication_pointer",
      "get_published_page",
      "get_published_page",
    ]);
  });

  it("rejects malformed and overlong slugs before touching Supabase", async () => {
    for (const slug of ["bad slug", "a".repeat(61), "UPPER-shop", "-invalid", "invalid-"]) {
      await expect(getPublicPublication(slug)).resolves.toBeNull();
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});
