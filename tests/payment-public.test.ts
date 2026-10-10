import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicSnapshot } from "../components/public-snapshot";

const recipient = "fixture-only@instapay";
const render = (items: Array<{ provider: string; value?: string; label?: string; url?: string; destinationStrategy?: string; profileOverride?: boolean }>, profiles = {}) => renderToStaticMarkup(React.createElement(PublicSnapshot, {
  snapshot: {
    providerProfiles: profiles,
    sections: [{ kind: "payments", title: "Payment options", position: 0, enabled: true, content: { items } }],
  },
}));

describe("public payment privacy", () => {
  it("renders local monochrome logos and keyboard actions without recipient text", () => {
    const html = render([{ provider: "instapay", value: recipient }, { provider: "vodafone", value: "fixture-only-wallet", label: "My wallet" }]);
    expect(html).toContain('/icons/payment/instapay.svg');
    expect(html).toContain('/icons/payment/vodafone.svg');
    expect(html).toContain('aria-label="InstaPay"');
    expect(html).toContain('aria-label="My wallet"');
    expect(html).toContain('<button');
    expect(html).not.toContain(recipient);
    expect(html).not.toContain("fixture-only-wallet");
    expect(html).not.toContain("Copy identifier");
    expect(html).not.toContain("<a ");
  });

  it("opens an owner-supplied payment link directly even with a legacy copy strategy", () => {
    const url = "https://payments.example.test/S/test/instapay/fixture";
    for (const destinationStrategy of [undefined, "copy_identifier", "external_url"]) {
      const html = render([{ provider: "instapay", value: recipient, url, destinationStrategy }]);
      expect(html).toContain(`href="${url}"`);
      expect(html).not.toContain('target="_blank"');
      expect(html).not.toContain("aria-haspopup");
      expect(html).not.toContain(recipient);
    }
  });

  it("rejects unsafe payment links without exposing recipient details", () => {
    for (const url of ["javascript:alert(1)", "instapay://invented", "http://payments.example.test/", "https://user:password@payments.example.test/"]) {
      const html = render([{ provider: "instapay", value: recipient, url }]);
      expect(html).not.toContain('<a ');
      expect(html).not.toContain(recipient);
      expect(html).toContain('<button');
    }
  });

  it("shares the exact supplied link while preserving item overrides", () => {
    const shared = "https://payments.example.test/shared";
    const alternate = "https://payments.example.test/alternate";
    const html = render([{ provider: "instapay" }, { provider: "instapay", url: alternate, profileOverride: true }], {
      instapay: { id: "instapay", url: shared },
    });
    expect(html).toContain(`href="${shared}"`);
    expect(html).toContain(`href="${alternate}"`);
  });

  it("keeps shared profiles and explicit overrides functional for icon-only cards", () => {
    const html = render([{ provider: "instapay" }, { provider: "instapay", value: recipient, label: "Alternate", profileOverride: true }], {
      instapay: { id: "instapay", value: "shared-fixture@instapay", destinationStrategy: "copy_identifier" },
    });
    expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Alternate"');
    expect(html).not.toContain("shared-fixture@instapay");
    expect(html).not.toContain(recipient);
  });

  it("does not turn custom labels into provider identity or reveal a label containing the recipient", () => {
    const custom = render([{ provider: "custom", label: "InstaPay", url: "https://checkout.example.test/" }]);
    expect(custom).toContain('href="https://checkout.example.test/"');
    expect(custom).not.toContain('/icons/payment/instapay.svg');
    expect(render([{ provider: "instapay", value: recipient, label: `Pay ${recipient}` }])).not.toContain(recipient);
  });

  it("never renders saved bank instructions or account details", () => {
    expect(render([{ provider: "bank", value: "fixture-only-account" }])).not.toContain("fixture-only-account");
  });

  it("redacts wallet labels with a differently formatted recipient number", () => {
    const local = "01000000000";
    const html = render([{ provider: "vodafone", value: `+20${local.slice(1)}`, label: `Wallet ${local.slice(0, 3)} ${local.slice(3)}` }]);
    expect(html).not.toContain(`Wallet ${local.slice(0, 3)}`);
    expect(html).toContain('aria-label="Vodafone Cash"');
  });
});
