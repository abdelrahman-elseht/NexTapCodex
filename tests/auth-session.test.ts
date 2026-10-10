import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), createClient: vi.fn(), claims: vi.fn(), redirect: vi.fn((url: string) => { throw new Error(url); }), owner: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.claims }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.owner }) }) }) }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

beforeEach(() => { vi.clearAllMocks(); process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co"; process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fixture"; });

it("registers Next 15 middleware only on session routes", async () => {
  const { config } = await import("../middleware");
  expect(config.matcher).toEqual(["/admin/:path*", "/login", "/auth/:path*", "/api/admin/:path*"]);
});
it("uses independent cookie-free public clients with session persistence disabled", async () => {
  const { createPublicClient } = await import("../lib/supabase/public");
  createPublicClient(); createPublicClient();
  expect(mocks.createClient).toHaveBeenCalledTimes(2);
  expect(mocks.createClient.mock.calls[0][2].auth).toEqual({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
});
it("passes refreshed cookies to server rendering and browser with cache prevention", async () => {
  mocks.createServerClient.mockImplementation((_url, _key, options) => ({ auth: { getClaims: async () => {
    options.cookies.setAll([{ name: "session", value: "fresh", options: { httpOnly: true } }], { "Cache-Control": "private, no-store" });
    return { data: { claims: { sub: "owner" } }, error: null };
  } } }));
  const { updateSession } = await import("../lib/supabase/proxy");
  const request = new NextRequest("http://localhost/admin", { headers: { cookie: "session=expired" } });
  const response = await updateSession(request);
  expect(request.cookies.get("session")?.value).toBe("fresh");
  expect(response.cookies.get("session")?.value).toBe("fresh");
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});
it("denies anonymous, revoked and non-owner sessions; checks each caller", async () => {
  const { requireOwner } = await import("../lib/auth/owner");
  mocks.claims.mockResolvedValue({ data: null, error: null });
  await expect(requireOwner()).rejects.toThrow("/login");
  mocks.claims.mockResolvedValue({ data: { claims: { sub: "owner" } }, error: null });
  mocks.owner.mockResolvedValue({ data: { user_id: "owner" }, error: null });
  expect((await requireOwner()).userId).toBe("owner");
  mocks.owner.mockResolvedValue({ data: null, error: null });
  await expect(requireOwner()).rejects.toThrow("unauthorized");
  mocks.claims.mockResolvedValue({ data: null, error: new Error("revoked") });
  await expect(requireOwner()).rejects.toThrow("/login");
});
