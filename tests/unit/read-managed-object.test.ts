import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readManagedObject } from "@/lib/media/read-object";
const path = "00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000003.webp";
beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key"); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
it("rejects declared and chunked overflow before buffering the full object", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch");
  fetcher.mockResolvedValueOnce(new Response("small", { headers: { "content-length": "100000" } }));
  expect(await readManagedObject(path, 8)).toBeUndefined();
  const cancel = vi.fn();
  fetcher.mockResolvedValueOnce(new Response(new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(9)); }, cancel })));
  expect(await readManagedObject(path, 8)).toBeUndefined();
  expect(cancel).toHaveBeenCalled();
});
it("uses only the verified session token for private reads and never puts it in the URL", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
  const client = { auth: { getSession: async () => ({ data: { session: { access_token: "test-token" } } }) } } as SupabaseClient;
  expect(await readManagedObject(path, 8, client)).toEqual(new TextEncoder().encode("ok"));
  expect(fetcher.mock.calls[0][0]).toBe(`https://fixture.supabase.co/storage/v1/object/business-media/${path}`);
  expect(fetcher.mock.calls[0][1]).toMatchObject({ headers: { apikey: "test-key", Authorization: "Bearer test-token" }, cache: "no-store", redirect: "error" });
});


