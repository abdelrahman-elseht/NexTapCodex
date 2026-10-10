import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("configured Quick Actions keep four columns on mobile and in the phone preview", async ({ app, browser }) => {
  await app.open("/demo");
  const publicLayout = await browser.evaluate(() => {
    const grid = document.querySelector<HTMLElement>(".quick-actions-configured")!;
    const items = Array.from(grid.children, item => item.getBoundingClientRect());
    return {
      columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
      firstRow: items.slice(0, 4).map(item => item.top),
      nextRow: items[4].top,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(publicLayout.columns).toBe(4);
  expect(new Set(publicLayout.firstRow).size).toBe(1);
  expect(publicLayout.nextRow).toBeGreaterThan(publicLayout.firstRow[0]);
  expect(publicLayout.overflow).toBe(false);

  // Reuse the rendered profile and actual editor preview styles without owner mutations.
  await browser.evaluate(() => {
    const preview = document.createElement("div");
    preview.className = "editor-phone-screen";
    preview.style.width = "300px";
    preview.style.height = "740px";
    const profile = document.querySelector<HTMLElement>(".premium-public")!;
    profile.before(preview);
    preview.append(profile);
    return null;
  });
  for (const columns of [1, 2, 3, 4]) {
    await browser.evaluate(`document.querySelector('.quick-actions-configured').style.setProperty('--action-columns', '${columns}')`);
    const previewLayout = await browser.evaluate(() => {
      const grid = document.querySelector<HTMLElement>(".editor-phone-screen .quick-actions-configured")!;
      const items = Array.from(grid.children, item => item.getBoundingClientRect());
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        rowItems: items.filter(item => item.top === items[0].top).length,
        minWidth: Math.min(...items.map(item => item.width)),
        overflow: grid.scrollWidth > grid.clientWidth,
      };
    });
    expect(previewLayout.columns).toBe(columns);
    expect(previewLayout.rowItems).toBe(columns);
    expect(previewLayout.minWidth).toBeGreaterThanOrEqual(44);
    expect(previewLayout.overflow).toBe(false);
  }
  await app.screenshot("quick-actions-four-column-preview");
});
