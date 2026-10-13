import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PublicSnapshot } from "../../src/components/business/public-snapshot";

it("cleared optional text stays absent across compatible public sections", () => {
  const html = renderToStaticMarkup(React.createElement(PublicSnapshot, { snapshot: {
    sections: ["social", "payments", "hours", "services", "links", "branch"].map((kind, position) => ({
      key: kind, kind, position, enabled: true, title: "", content: { eyebrow: "", description: "", badge: "", items: [{ id: kind, label: "", subtitle: "", badge: "", value: kind === "hours" ? "09:00–17:00" : "", url: "https://example.test", provider: "custom" }] },
    })),
  } }));
  expect(html).not.toContain("<h2");
  expect(html).not.toContain('class="section-overline"');
  expect(html).not.toContain('class="section-intro"');
  expect(html).not.toContain('class="item-subtitle"');
  expect(html).toContain('aria-label="Custom URL"');
});

it("different hours sections render their own schedules and ignore provider profiles", () => {
  const html = renderToStaticMarkup(React.createElement(PublicSnapshot, { snapshot: {
    providerProfiles: { custom: { id: "custom", value: "WRONG" } },
    sections: ["09:00–17:00", "11:00–19:00"].map((value, position) => ({ key: String(position), kind: "hours", title: "", position, enabled: true, content: { items: [{ label: "Day", value, provider: "custom" }] } })),
  } }));
  expect(html).toContain("09:00–17:00");
  expect(html).toContain("11:00–19:00");
  expect(html).not.toContain("WRONG");
});

it("renders additional action sections instead of treating their kind as a singleton", () => {
  const html = renderToStaticMarkup(React.createElement(PublicSnapshot, { snapshot: {
    sections: ["first", "second"].map((key, position) => ({ key, kind: "quick_actions", title: "", position, enabled: true, content: { items: [{ id: key, label: key, provider: "custom", url: `https://example.test/${key}` }] } })),
  } }));
  expect(html).toContain('href="https://example.test/first"');
  expect(html).toContain('href="https://example.test/second"');
});
