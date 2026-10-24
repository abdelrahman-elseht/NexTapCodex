import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { resolveWalletUssdEnabled } from "../../src/lib/config/wallet-ussd.mjs";

test("wallet payment actions open an amount-only modal with sandbox codes behind the staging flag", async ({ app, browser, screen }) => {
  const enabled = resolveWalletUssdEnabled(process.env) === "true";
  await app.open("/demo");
  for (const provider of ["Vodafone Cash", "Etisalat Cash", "Orange Cash (Mobinil)"]) {
    await screen.getByRole("button", provider, { exact: true }).first().tap();
    await expect(browser.locator("dialog[aria-labelledby]")).toBeVisible();
    if (!enabled) await app.screenshot("wallet-payment-modal");
    await expect(screen.getByLabel("Amount (EGP)")).toBeVisible();
    if (enabled) {
      await screen.getByLabel("Amount (EGP)").fill("10");
      await expect(browser.locator(".wallet-code")).toBeVisible();
      await expect(screen.getByRole("link", "Open Dialer")).toHaveAttribute("href", /^tel:(?:\*|%23)/);
      await expect(screen.getByRole("button", "Copy Full Code")).toBeVisible();
    } else {
      await expect(screen.getByText("Experimental dialing formats are disabled on this deployment.")).toBeVisible();
      await expect(screen.getByRole("link", "Open Dialer")).toHaveCount(0);
    }
    await screen.getByRole("button", "Close", { exact: true }).tap();
  }

  const instapay = screen.getByRole("button", "InstaPay").first();
  await expect(instapay).toBeVisible();
  await instapay.tap();
  await expect(browser.locator("dialog.payment-instructions-dialog")).toBeVisible();
  await expect(browser.locator(".wallet-payment-dialog")).toHaveCount(0);
});

