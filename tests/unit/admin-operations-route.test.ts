import { beforeEach, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const mocks = vi.hoisted(() => ({ claims: vi.fn(), owner: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getClaims: mocks.claims }, rpc: mocks.rpc,
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.owner }) }) }),
}) }));

import { POST } from "../../src/app/api/admin/operations/route";

const key = "11111111-1111-4111-8111-111111111111";
const request = (fields: Record<string, string> = {}) => new Request("https://admin.example.test/api/admin/operations", {
  method: "POST",
  headers: { origin: "https://admin.example.test", accept: "application/json" },
  body: new URLSearchParams({
    mode: "business", request_key: key, name: "Migration probe", category: "cafe",
    slug: "migration-probe", template: "cafe", ...fields,
  }),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claims.mockResolvedValue({ data: { claims: { sub: "owner" } }, error: null });
  mocks.owner.mockResolvedValue({ data: { user_id: "owner" }, error: null });
  mocks.rpc.mockResolvedValue({ data: { businessId: "business", pageId: "page" }, error: null });
});

it("creates a business through the idempotent admin page RPC", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, nextHref: "/admin/businesses/business?created=1" });
  expect(mocks.rpc).toHaveBeenCalledWith("create_admin_page", expect.objectContaining({
    request_key: key,
    details: { name: "Migration probe", category: "cafe", slug: "migration-probe", template: "cafe" },
    seeds: expect.arrayContaining([expect.objectContaining({ kind: "hero", enabled: true })]),
  }));
});

it("does not report success when the required RPC is missing", async () => {
  mocks.rpc.mockResolvedValue({ error: { code: "PGRST202" } });
  const response = await POST(request());
  expect(response.status).toBe(500);
  expect((await response.json()).ok).toBe(false);
});
