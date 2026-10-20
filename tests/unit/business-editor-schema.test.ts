import { expect, it, vi } from "vitest";
import { assertBusinessEditorSchema } from "../../scripts/ci/business-editor-schema.mjs";

function client(missingTable?: string, rpcError = { code: "P0001", message: "page not found" }, creationError = { code: "22023", message: "invalid creation" }) {
  return {
    from: vi.fn((table: string) => ({ select: vi.fn(() => ({
      limit: vi.fn(async () => ({ error: table === missingTable ? { code: "42703" } : null })),
    })) })),
    rpc: vi.fn(async (name: string) => ({ error: name === "create_admin_page" ? creationError : rpcError })),
  };
}

it("rejects the observed pre-Contacts schema before attempting the RPC", async () => {
  const staging = client("business_pages");
  await expect(assertBusinessEditorSchema(staging)).rejects.toThrow("business_pages (42703)");
  expect(staging.rpc).not.toHaveBeenCalled();
});

it.each(["businesses", "media_assets"])("rejects missing editor columns on %s", async table => {
  await expect(assertBusinessEditorSchema(client(table))).rejects.toThrow(table);
});

it("rejects a missing atomic save RPC even when columns exist", async () => {
  await expect(assertBusinessEditorSchema(client(undefined, { code: "PGRST202", message: "missing" }))).rejects.toThrow("save_contact_draft (PGRST202)");
});

it("rejects a missing idempotent business creation RPC", async () => {
  await expect(assertBusinessEditorSchema(client(undefined, undefined, { code: "PGRST202", message: "missing" }))).rejects.toThrow("create_admin_page (PGRST202)");
});

it("accepts the migrated schema using only zero-row reads and an invalid no-write draft", async () => {
  const staging = client();
  await expect(assertBusinessEditorSchema(staging)).resolves.toBeUndefined();
  expect(staging.from.mock.calls.map(([table]) => table)).toEqual(["businesses", "business_pages", "media_assets"]);
  expect(staging.rpc).toHaveBeenNthCalledWith(1, "save_contact_draft", {
    draft: {}, expected_page_revision: 0, expected_business_revision: 0, publish: false,
  });
  expect(staging.rpc).toHaveBeenNthCalledWith(2, "create_admin_page", { request_key: null, details: {}, seeds: [] });
});
