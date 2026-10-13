import { describe, expect, it } from "vitest";
import {
  buildProviderProfiles,
  destinationStrategyFor,
  getProviderMetadata,
  isLocalWalletProvider,
  isMobileWalletProvider,
  isPaymentProvider,
  normalizeProviderValue,
  resolveProviderItem,
} from "../../src/lib/business/providers";

describe("provider metadata and destinations", () => {
  it("uses copy-only defaults for payment identifiers", () => {
    expect(getProviderMetadata("instapay")?.sensitive).toBe(true);
    expect(destinationStrategyFor("instapay")).toBe("copy_identifier");
    expect(destinationStrategyFor("vodafone")).toBe("copy_identifier");
    expect(destinationStrategyFor("etisalat")).toBe("copy_identifier");
    expect(destinationStrategyFor("orange")).toBe("copy_identifier");
    expect(destinationStrategyFor("bank")).toBe("instructions");
  });

  it("rejects an unverified deep-link strategy", () => {
    for (const provider of ["instapay", "vodafone", "etisalat", "orange"]) {
      expect(destinationStrategyFor(provider, "verified_deep_link")).toBe("copy_identifier");
      expect(getProviderMetadata(provider)?.verifiedDeepLink).toBe(false);
    }
  });

  it("prioritizes supplied payment URLs without claiming a verified contract", () => {
    for (const provider of ["instapay", "vodafone", "etisalat", "orange", "bank"]) {
      expect(destinationStrategyFor(provider, "copy_identifier", "https://payments.example.test/checkout")).toBe("external_url");
      expect(getProviderMetadata(provider)?.verifiedDeepLink).toBe(false);
    }
  });

  it("normalizes Egyptian mobile-wallet numbers for the new local providers", () => {
    for (const provider of ["etisalat", "orange"] as const) {
      expect(getProviderMetadata(provider)?.sensitive).toBe(true);
      expect(isLocalWalletProvider(provider)).toBe(true);
      expect(isMobileWalletProvider(provider)).toBe(true);
      expect(isPaymentProvider(provider)).toBe(true);
      expect(normalizeProviderValue(provider, "01012345678")).toBe("+201012345678");
      expect(normalizeProviderValue(provider, "12345")).toBe("");
    }
  });
});

describe("provider profile inheritance", () => {
  it("builds one shared profile and resolves blank item fields", () => {
    const profiles = buildProviderProfiles([
      { provider: "instapay", value: "shop@instapay" },
      { provider: "instapay", value: "ignored@instapay" },
    ]);
    expect(profiles.instapay.value).toBe("shop@instapay");
    expect(resolveProviderItem({ provider: "instapay", label: "Pay", value: "", url: "" }, profiles)).toMatchObject({
      value: "shop@instapay",
      destinationStrategy: "copy_identifier",
    });
  });

  it("keeps explicit item overrides separate from the shared profile", () => {
    const profiles = buildProviderProfiles([{ provider: "vodafone", value: "01011111111" }]);
    const item: { provider: string; label: string; value: string; profileOverride: boolean; destinationStrategy?: string } = { provider: "vodafone", label: "Alternate", value: "01022222222", profileOverride: true };
    const resolved = resolveProviderItem(item, profiles);
    expect(resolved.value).toBe("01022222222");
    expect(resolved.destinationStrategy).toBeUndefined();
  });

  it("lets an updated shared profile replace stale inherited section values", () => {
    const profiles = buildProviderProfiles([{ provider: "instapay", value: "new@instapay" }]);
    const item = resolveProviderItem({ provider: "instapay", value: "old@instapay" }, profiles);
    expect(item.value).toBe("new@instapay");
  });
});
