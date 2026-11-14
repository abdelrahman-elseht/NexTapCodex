import { describe, expect, it } from "vitest";
import { serializePublicationSnapshot } from "../../workers/phase1-foundation/src/publication-snapshot";

describe("Phase 1 publication snapshot contract", () => {
  it("copies page has_menu into page.hasMenu and embeds versioned contact in snapshot JSON", () => {
    const snapshotJson = serializePublicationSnapshot({
      business: { name: "Fixture Business" },
      contactProjection: {
        version: 1,
        enabled: true,
        displayName: "Fixture Business",
        organization: "Fixture Group",
        primaryPhone: "+15550000000",
        fields: [{ kind: "email", label: "Email", value: "hello@example.test" }],
      },
      page: { id: "page-1", slug: "fixture", has_menu: true },
      sections: [{ kind: "hero", enabled: true }],
    });

    expect(JSON.parse(snapshotJson)).toEqual({
      business: { name: "Fixture Business" },
      contact: {
        version: 1,
        enabled: true,
        displayName: "Fixture Business",
        organization: "Fixture Group",
        primaryPhone: "+15550000000",
        fields: [{ kind: "email", label: "Email", value: "hello@example.test" }],
      },
      page: { id: "page-1", slug: "fixture", hasMenu: true },
      sections: [{ kind: "hero", enabled: true }],
    });
    expect(snapshotJson).not.toContain("has_menu");
    expect(snapshotJson).not.toContain("contact_projection");
  });

  it("keeps contact out of the snapshot when no published projection exists", () => {
    const snapshot = JSON.parse(serializePublicationSnapshot({ page: { has_menu: false } }));
    expect(snapshot).toEqual({ page: { hasMenu: false } });
    expect(snapshot).not.toHaveProperty("contact");
  });

  it("rejects invalid page flags and unsupported contact projection versions", () => {
    expect(() => serializePublicationSnapshot({ page: { has_menu: 1 as unknown as boolean } })).toThrow("Page has_menu must be a boolean.");
    expect(() => serializePublicationSnapshot({
      page: { has_menu: false },
      contactProjection: {
        version: 2,
        enabled: true,
        displayName: "Fixture Business",
        organization: "",
        primaryPhone: "+15550000000",
        fields: [],
      },
    })).toThrow("Unsupported contact projection version.");
  });
});
