import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { authorizeServiceRequest, authorizeStaffOperation, capabilitiesForLegacyRole } from "../../workers/phase1-foundation/src/auth";
import runtime from "../../workers/phase1-foundation/src/index";

const config = readFileSync(new URL("../../infra/cloudflare/phase1-runtime.wrangler.toml", import.meta.url), "utf8");

describe("Phase 1 runtime bindings", () => {
  it("declares distinct development and staging resources and has no production environment", () => {
    expect(config).toContain('APP_ENV = "development"');
    expect(config).toContain('APP_ENV = "staging"');
    expect(config).toContain('database_name = "nextap-dev-core"');
    expect(config).toContain('database_name = "nextap-staging-core"');
    expect(config).toContain('bucket_name = "nextap-dev-public"');
    expect(config).toContain('bucket_name = "nextap-staging-public"');
    expect(config).toContain('id = "58df600b88a94da7806deb7ad5bc90c2"');
    expect(config).toContain('id = "d0154043f05a495c8e5e0ef5dbb81dc1"');
    expect(config).not.toMatch(/\[env\.production(?:\.|\])/);
    expect(config).toContain("workers_dev = false");
  });

  it("denies unknown, inactive, incapable, and cross-business staff by default", () => {
    expect(authorizeStaffOperation({ identity: null, capability: "page:read" })).toEqual({ allowed: false, reason: "unauthenticated" });
    const base = {
      subject: "staff-1",
      active: true,
      globalCapabilities: ["staff:manage"],
      businessCapabilities: { "business-1": ["page:read"] },
    };
    expect(authorizeStaffOperation({ identity: { ...base, active: false }, capability: "page:read", scope: { kind: "business", businessId: "business-1" } })).toEqual({ allowed: false, reason: "inactive" });
    expect(authorizeStaffOperation({ identity: base, capability: "card:write", scope: { kind: "business", businessId: "business-1" } })).toEqual({ allowed: false, reason: "business_scope" });
    expect(authorizeStaffOperation({ identity: base, capability: "page:read", scope: { kind: "business", businessId: "business-2" } })).toEqual({ allowed: false, reason: "business_scope" });
    expect(authorizeStaffOperation({ identity: base, capability: "page:read", scope: { kind: "business", businessId: "business-1" } })).toEqual({ allowed: true, subject: "staff-1" });
    expect(authorizeStaffOperation({ identity: base, capability: "staff:manage", scope: { kind: "global" } })).toEqual({ allowed: true, subject: "staff-1" });
    expect(authorizeStaffOperation({ identity: base, capability: "page:read", scope: { kind: "global" } })).toEqual({ allowed: false, reason: "business_scope" });
    expect(authorizeStaffOperation({ identity: { ...base, globalCapabilities: ["read"] }, capability: "read", scope: { kind: "global" } })).toEqual({ allowed: false, reason: "business_scope" });
    expect(authorizeStaffOperation({ identity: { ...base, globalCapabilities: ["read"] }, capability: "read", scope: { kind: "business", businessId: "business-1" } })).toEqual({ allowed: true, subject: "staff-1" });
  });

  it("denies business-scoped capabilities when business scope is absent or empty", () => {
    const identity = {
      subject: "staff-1",
      active: true,
      globalCapabilities: [],
      businessCapabilities: { "business-1": ["page:read"] },
    };
    expect(authorizeStaffOperation({ identity, capability: "page:read" })).toEqual({ allowed: false, reason: "business_scope" });
    expect(authorizeStaffOperation({ identity, capability: "page:read", scope: { kind: "business", businessId: "" } })).toEqual({ allowed: false, reason: "business_scope" });
    expect(authorizeStaffOperation({ identity, capability: "page:read", scope: { kind: "business", businessId: "  " } })).toEqual({ allowed: false, reason: "business_scope" });
  });

  it("maps known legacy roles to global capabilities and denies unknown roles", () => {
    expect(capabilitiesForLegacyRole("administrator")).toEqual(["read", "edit", "media", "publish", "inventory", "export", "delete"]);
    expect(capabilitiesForLegacyRole("publisher")).toEqual(["read", "edit", "media", "publish"]);
    expect(capabilitiesForLegacyRole("editor")).toEqual(["read", "edit", "media"]);
    expect(capabilitiesForLegacyRole("inventory")).toEqual(["read", "inventory", "export"]);
    expect(capabilitiesForLegacyRole("auditor")).toEqual(["read"]);
    expect(capabilitiesForLegacyRole("unknown")).toEqual([]);
  });

  it("fails closed for service requests without a verifier or when verification errors", async () => {
    const request = new Request("https://admin.example.test/internal");
    expect(await authorizeServiceRequest(request)).toBe(false);
    expect(await authorizeServiceRequest(request, async () => { throw new Error("verification failed"); })).toBe(false);
    expect(await authorizeServiceRequest(request, async () => true)).toBe(true);
  });

  it("does not expose a runtime route before an authenticated application handler exists", async () => {
    const response = await runtime.fetch(new Request("https://admin.example.test/anything"), {} as never);
    expect(response.status).toBe(404);
  });
});
