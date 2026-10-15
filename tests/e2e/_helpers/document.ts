import type { Browser } from "@e2e-dev/web";
import { expect } from "e2e";
export async function markDocument(browser: Browser) {
  return browser.evaluate(() => {
    const sentinel = crypto.randomUUID();
    Object.assign(window, { __nextapDocument: sentinel });
    return { sentinel, origin: performance.timeOrigin, navigationCount: performance.getEntriesByType("navigation").length };
  });
}
export async function expectSameDocument(browser: Browser, before: Awaited<ReturnType<typeof markDocument>>) {
  expect(await browser.evaluate(() => ({ sentinel: Reflect.get(window, "__nextapDocument"), origin: performance.timeOrigin, navigationCount: performance.getEntriesByType("navigation").length }))).toEqual(before);
}
