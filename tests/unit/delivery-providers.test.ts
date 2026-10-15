import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PublicSnapshot } from "../../src/components/business/public-snapshot";
import { normalizeProviderValue, providerMetadata, resolveProviderItem } from "../../src/lib/business/providers";

it.each(["talabat", "fast"] as const)("%s preserves exact safe destinations and independent overrides", provider => {
  const url = "https://merchant.example.test/share?a=1%2F2&b=3#menu";
  expect(normalizeProviderValue(provider,url)).toBe(url);
  expect(providerMetadata[provider].verifiedDeepLink).toBe(false);
  const item = { provider, url: "https://other.example.test", profileOverride: false };
  expect(resolveProviderItem(item, { [provider]: { id: provider, url } }).url).toBe(url);
  expect(resolveProviderItem({ ...item, profileOverride: true }, { [provider]: { id: provider, url } }).url).toBe(item.url);
});
it.each(["http://merchant.test", "https://user:pass@merchant.test", "javascript:alert(1)", "intent://order", "https://merchant.test/\norder", "//merchant.test"])("rejects unsafe delivery destination %s", url => {
  expect(normalizeProviderValue("fast",url)).toBe(""); expect(normalizeProviderValue("talabat",url)).toBe("");
});
it("renders local delivery marks and same-context links in quick, generic and nested actions", () => {
  const item = { provider: "fast", label: "Fast App", url: "https://merchant.example.test/fast" };
  const html = renderToStaticMarkup(React.createElement(PublicSnapshot, { snapshot: { sections: [
    { kind: "quick_actions", title: "", enabled: true, position: 0, content: { items: [item] } },
    { kind: "links", title: "", enabled: true, position: 1, content: { items: [{ ...item, provider: "talabat" }] } },
    { kind: "services", title: "", enabled: true, position: 2, content: { items: [{ label: "Service", actions: [item] }] } },
  ] } }));
  expect(html).toContain('/icons/social/fast.png'); expect(html).toContain('/icons/social/talabat.svg');
  const links = html.match(/<a\b[^>]*href="https:\/\/merchant\.example\.test\/fast"[^>]*>/g) || [];
  expect(links).toHaveLength(3); expect(links.every(link => !link.includes('target="_blank"'))).toBe(true);
});
it("does not infer trusted professional marks from lookalike hosts or custom labels", () => {
  const html = renderToStaticMarkup(React.createElement(PublicSnapshot, { snapshot: { sections: [{ kind: "social", title: "", position: 0, enabled: true, content: { items: [{ label: "GitHub", url: "https://github.com.evil.test/profile" }] } }] } }));
  expect(html).not.toContain('/icons/social/github.svg');
});
