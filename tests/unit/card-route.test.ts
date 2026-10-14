import { beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ rpc }) }));
vi.mock("@/lib/observability/operations", () => ({ captureOperationError: vi.fn() }));
import { GET } from "../../src/app/c/[token]/route";

const token = "A".repeat(32);
beforeEach(() => vi.clearAllMocks());

describe("public card route", () => {
  it("passes a strict unassigned serial without exposing the token", async () => {
    rpc.mockResolvedValue({ data: { state: "unassigned", serial: "NT-20261008-000123" }, error: null });
    const response = await GET(new Request(`https://nextap.test/c/${token}?via=qr`), { params: Promise.resolve({ token }) });
    expect(response.headers.get("location")).toBe("/card/unavailable?state=unassigned&serial=NT-20261008-000123");
    expect(response.headers.get("location")).not.toContain(token);
  });

  it("ignores malformed resolver serials", async () => {
    rpc.mockResolvedValue({ data: { state: "unassigned", serial: token }, error: null });
    const response = await GET(new Request(`https://nextap.test/c/${token}`), { params: Promise.resolve({ token }) });
    expect(response.headers.get("location")).toBe("/card/unavailable?state=unassigned");
  });
});
