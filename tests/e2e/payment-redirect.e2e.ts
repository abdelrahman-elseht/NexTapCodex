import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("a payment Quick Action without a link opens private fallback instructions", async ({ app, screen, browser }) => {
  await browser.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true, value: { writeText: async () => undefined },
    });
  });
  await app.open("/demo");
  const action = browser.locator(".quick-actions").getByRole("button", "Pay", { exact: true });
  await expect(action).not.toHaveAttribute("href");
  await action.focus();
  await action.press("Enter");
  const dialog = screen.getByRole("dialog");
  await expect(dialog).toContainText("Recipient details copied");
  const publicContent = await browser.evaluate(() => ({
    text: document.body.innerText,
    names: Array.from(document.querySelectorAll(".quick-actions [aria-label], dialog [aria-label]"), node => node.getAttribute("aria-label")),
    hrefs: Array.from(document.querySelectorAll(".quick-actions a, dialog a"), node => node.getAttribute("href")),
  }));
  expect(JSON.stringify(publicContent)).not.toContain("@instapay");
  expect(publicContent.text).not.toContain("Copy identifier");
  await screen.getByRole("button", "Close", { exact: true }).press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(action).toBeFocused();
  await expect(browser).toHaveURL("/demo");
});
