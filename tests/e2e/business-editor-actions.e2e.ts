import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

test("owners can configure provider-aware actions, social links, and payment links and fallbacks", async ({ app, screen, browser }) => {
  test.skip(
    !process.env.E2E_USER_OWNER_USERNAME || !process.env.E2E_USER_OWNER_PASSWORD || process.env.E2E_ALLOW_MUTATIONS !== "true",
    "Owner editor workflows require credentials and E2E_ALLOW_MUTATIONS=true for the isolated Supabase test project.",
  );

  await app.open("/login");
  await screen.getByLabel("البريد الإلكتروني").fill(credentials.user("owner").username);
  await screen.getByLabel("كلمة المرور").fill(credentials.user("owner").password);
  await screen.getByRole("button", "دخول آمن").tap();
  await expect(browser).toHaveURL(/\/admin(?:\?.*)?$/);

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const slug = `editor-${suffix}`;
  await app.open("/admin/businesses/new");
  await screen.getByLabel("اسم النشاط").fill(`E2E Editor ${suffix}`);
  await screen.getByLabel("التصنيف").fill("E2E");
  await screen.getByLabel("رابط الصفحة").fill(slug);
  await browser.locator('input[name="template"][value="professional"]').check();
  await screen.getByRole("button", "إنشاء النشاط والصفحة").tap();
  await expect(browser).toHaveURL(/\/admin\/businesses\/[0-9a-f-]+\?created=1/, { timeout: 20_000 });

  const businessId = await browser.evaluate(() => location.pathname.split("/").at(-1) || "");
  const editorPath = `/admin/businesses/${businessId}`;
  const quickSection = () => screen.getByRole("button", /Quick Actions/);
  const itemRow = (index: number) => browser.locator(".editor-form-pane .live-item-row").nth(index);

  await quickSection().tap();
  await screen.getByLabel("Buttons per row").selectOption("4");
  await screen.getByRole("button", "Social").tap();
  await screen.getByRole("button", "Add Instagram").tap();
  await itemRow(0).getByRole("textbox").nth(0).fill("Follow Us");
  await itemRow(0).getByRole("textbox").nth(1).fill("@nextapqa");

  await screen.getByRole("button", "Popular").tap();
  await screen.getByRole("button", "Add WhatsApp").tap();
  await itemRow(1).getByRole("textbox").nth(0).fill("Message us");
  await itemRow(1).getByRole("textbox").nth(1).fill("01012345678");

  await screen.getByRole("button", "Add Call").tap();
  await itemRow(2).getByRole("textbox").nth(0).fill("Call");
  await itemRow(2).getByRole("textbox").nth(1).fill("01098765432");

  await screen.getByRole("button", "Booking & reviews").tap();
  await screen.getByRole("button", "Add Google Reviews").tap();
  await itemRow(3).getByRole("textbox").nth(0).fill("Review Us");
  await itemRow(3).getByRole("textbox").nth(1).fill("https://maps.google.com/?cid=12345");
  await itemRow(0).getByRole("button", "Move item 1 down").tap();

  if (await browser.evaluate(() => innerWidth < 800)) await screen.getByRole("button", "Preview").tap();
  const liveActions = await browser.evaluate(() => Array.from(document.querySelectorAll<HTMLAnchorElement>(".editor-phone-screen .quick-action"), link => ({ label: link.innerText.trim(), href: link.getAttribute("href") || "" })));
  expect(liveActions.length).toBe(4);
  expect(await browser.evaluate(() => {
    const grid = document.querySelector<HTMLElement>(".editor-phone-screen .quick-actions-configured")!;
    return getComputedStyle(grid).gridTemplateColumns.split(" ").length;
  })).toBe(4);
  expect(liveActions.some(action => action.label === "Follow Us" && action.href === "https://instagram.com/nextapqa")).toBe(true);
  expect(liveActions.some(action => action.label === "Message us" && action.href === "https://wa.me/201012345678")).toBe(true);
  expect(liveActions.some(action => action.label === "Call" && action.href === "tel:01098765432")).toBe(true);
  expect(liveActions.some(action => action.label === "Review Us" && action.href.startsWith("https://maps.google.com/"))).toBe(true);

  if (await browser.evaluate(() => innerWidth < 800)) await screen.getByRole("button", "Editor").tap();
  await screen.getByRole("button", /Social & Community/).tap();
  await screen.getByRole("button", "More social").tap();
  await screen.getByRole("button", "Add LinkedIn").tap();
  await itemRow(0).getByRole("textbox").nth(0).fill("Find us on LinkedIn");
  await itemRow(0).getByRole("textbox").nth(1).fill("https://www.linkedin.com/company/nextapqa");
  expect(await browser.evaluate(() => Array.from(document.querySelectorAll(".editor-phone-screen .social-tile"), tile => ({ label: tile.textContent?.trim() || "", icon: tile.querySelector("img")?.getAttribute("src") || "" })).some(item => item.label === "Find us on LinkedIn" && item.icon === "/icons/social/linkedin.svg"))).toBe(true);

  await screen.getByRole("button", /Payments/).tap();
  await screen.getByRole("checkbox", "Hidden").check();
  await screen.getByLabel("Buttons per row").selectOption("3");
  await screen.getByRole("button", "Add InstaPay").tap();
  await itemRow(0).getByRole("textbox").nth(0).fill("Pay");
  await itemRow(0).getByRole("textbox").nth(1).fill("not-an-id");
  await expect(itemRow(0).getByRole("alert")).toContainText("Use an InstaPay IPA");
  await itemRow(0).getByRole("textbox").nth(1).fill("nextap@instapay");
  await expect(itemRow(0).getByRole("alert")).toHaveCount(0);
  await itemRow(0).getByRole("textbox").nth(0).fill("");
  // Reserved test host: never manufacture or visit a real payment token.
  const paymentUrl = "https://payments.example.test/S/test/instapay/fixture";
  await itemRow(0).getByRole("textbox").nth(2).fill(paymentUrl);
  await itemRow(0).getByRole("textbox").nth(1).fill("");
  await screen.getByRole("button", "Add Vodafone Cash").tap();
  await itemRow(1).getByRole("textbox").nth(0).fill("Wallet");
  await itemRow(1).getByRole("textbox").nth(1).fill("01055556666");
  await screen.getByRole("button", "Other methods").tap();
  await screen.getByRole("button", "Add Custom URL").tap();
  await itemRow(2).getByRole("textbox").nth(0).fill("Online Pay");
  await itemRow(2).getByRole("textbox").nth(1).fill("https://payments.example.test/checkout");
  await screen.getByRole("button", "Add Bank instructions").tap();
  await itemRow(3).getByRole("textbox").nth(0).fill("Bank transfer");
  await itemRow(3).getByRole("textbox").nth(1).fill("Transfer to demo account 123");

  if (await browser.evaluate(() => innerWidth < 800)) await screen.getByRole("button", "Preview").tap();
  const paymentPreview = await browser.evaluate(() => {
    const grid = document.querySelector<HTMLElement>(".editor-phone-screen .payment-grid");
    const section = document.querySelector<HTMLElement>(".editor-phone-screen .payments-section");
    return {
      count: grid?.children.length || 0,
      columns: grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length : 0,
      background: section ? section.querySelector("img.section-background-photo")?.getAttribute("src") || "" : "",
      copyCount: grid?.querySelectorAll(".copy-payment").length || 0,
      actionCount: grid?.querySelectorAll("button.payment-tile").length || 0,
    };
  });
  expect(paymentPreview.count).toBe(4);
  expect(paymentPreview.copyCount).toBe(0);
  expect(paymentPreview.actionCount).toBe(2);
  expect(paymentPreview.background.includes("payment-nfc.webp")).toBe(true);
  const viewportWidth = await browser.evaluate(() => innerWidth);
  expect(paymentPreview.columns).toBe(viewportWidth < 560 ? 2 : 3);

  if (await browser.evaluate(() => innerWidth < 800)) await screen.getByRole("button", "Editor").tap();
  const orderBefore = await browser.evaluate(() => Array.from(document.querySelectorAll(".visual-section-list > li"), item => item.querySelector(".navigator-item small")?.textContent?.trim() || ""));
  const paymentSection = browser.locator(".visual-section-list > li").filter({ hasText: "Payments" });
  await paymentSection.getByRole("button").nth(1).tap();
  const orderAfter = await browser.evaluate(() => Array.from(document.querySelectorAll(".visual-section-list > li"), item => item.querySelector(".navigator-item small")?.textContent?.trim() || ""));
  expect(orderAfter.indexOf("Payments")).toBe(orderBefore.indexOf("Payments") - 1);

  await browser.locator('.add-section-row select[aria-label="Section to add"]').selectOption({ label: "Gallery" });
  await expect(browser.locator(".visual-section-list > li").filter({ hasText: "Gallery" })).toHaveCount(2);
  await browser.evaluate(() => { window.confirm = () => true; return true; });
  await screen.getByRole("button", "Delete section").tap();
  await expect(browser.locator(".visual-section-list > li").filter({ hasText: "Gallery" })).toHaveCount(1);

  await quickSection().tap();
  await screen.getByRole("button", "Payments", { exact: true }).tap();
  await screen.getByRole("button", "Add InstaPay").tap();
  await expect(itemRow(4).getByRole("textbox").nth(2)).toHaveValue(paymentUrl);

  await screen.getByRole("button", "Save draft").tap();
  await expect(screen.getByRole("status")).toContainText("Draft saved");
  await app.open(`/b/${slug}`);
  const unpublishedText = await browser.evaluate(() => document.body.innerText);
  expect(unpublishedText.includes("Follow Us")).toBe(false);
  expect(unpublishedText.includes("Find us on LinkedIn")).toBe(false);

  await app.open(editorPath);
  await quickSection().tap();
  const persistedActions = await browser.evaluate(() => Array.from(document.querySelectorAll<HTMLInputElement>(".editor-form-pane .live-item-row input")).filter(input => input.type === "text").map(input => input.value));
  expect(persistedActions).toContain("Follow Us");
  expect(persistedActions).toContain("@nextapqa");
  const persistedOrder = await browser.evaluate(() => Array.from(document.querySelectorAll(".visual-section-list > li"), item => item.querySelector(".navigator-item small")?.textContent?.trim() || ""));
  expect(persistedOrder.indexOf("Payments")).toBeLessThan(persistedOrder.indexOf("Opening hours"));

  await browser.locator(".navigator-item").filter({ hasText: "Payments" }).tap();
  await expect(itemRow(0).getByRole("textbox").nth(2)).toHaveValue(paymentUrl);
  await expect(itemRow(0).getByRole("textbox").nth(1)).toHaveValue("");
  await screen.getByRole("button", "Publish").tap();
  await expect(screen.getByRole("status")).toContainText("Published");
  await app.open(`/b/${slug}`);
  await expect(screen.getByRole("heading", `E2E Editor ${suffix}`)).toBeVisible();
  const publicEvidence = await browser.evaluate(() => {
    const action = Array.from(document.querySelectorAll<HTMLAnchorElement>(".quick-actions a")).find(link => link.textContent?.trim() === "Follow Us");
    const social = Array.from(document.querySelectorAll<HTMLAnchorElement>(".social-tile")).find(link => link.textContent?.trim() === "Find us on LinkedIn");
    const grid = document.querySelector<HTMLElement>(".payment-grid");
    const section = document.querySelector<HTMLElement>(".payments-section");
    const columns = (element: HTMLElement | null) => element ? getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length : 0;
    return {
      actionHref: action?.getAttribute("href") || "",
      socialHref: social?.getAttribute("href") || "",
      socialIcon: social?.querySelector("img")?.getAttribute("src") || "",
      paymentColumns: columns(grid),
      actionColumns: columns(document.querySelector<HTMLElement>(".quick-actions-configured")),
      paymentCount: grid?.children.length || 0,
      paymentBackground: section ? section.querySelector("img.section-background-photo")?.getAttribute("src") || "" : "",
      paymentActions: Array.from(grid?.querySelectorAll("button.payment-tile") || []).map(button => ({
        label: button.getAttribute("aria-label") || "",
        text: button.textContent?.trim() || "",
      })),
      paymentHrefs: Array.from(grid?.querySelectorAll("a") || []).map(link => link.getAttribute("href") || ""),
    };
  });
  expect(publicEvidence.actionHref).toBe("https://instagram.com/nextapqa");
  expect(publicEvidence.socialHref).toBe("https://www.linkedin.com/company/nextapqa");
  expect(publicEvidence.socialIcon).toBe("/icons/social/linkedin.svg");
  expect(publicEvidence.paymentCount).toBe(4);
  expect(publicEvidence.paymentActions).toHaveLength(2);
  expect(publicEvidence.paymentActions[0]).toEqual({ label: "Wallet", text: "Wallet" });
  expect(publicEvidence.paymentHrefs).toContain(paymentUrl);
  expect(publicEvidence.paymentActions.every(action => !/nextap@instapay|01055556666|Copy identifier/i.test(`${action.label} ${action.text}`))).toBe(true);
  expect(publicEvidence.paymentHrefs.every(href => !/nextap@instapay|01055556666/i.test(href))).toBe(true);
  expect(publicEvidence.paymentBackground.includes("payment-nfc.webp")).toBe(true);
  const publicWidth = await browser.evaluate(() => innerWidth);
  expect(publicEvidence.paymentColumns).toBe(publicWidth < 560 ? 2 : 3);
  expect(publicEvidence.actionColumns).toBe(4);

  const paymentLink = browser.locator(".payment-grid").getByRole("link", "InstaPay", { exact: true });
  const quickPaymentLink = browser.locator(".quick-actions").getByRole("link", "InstaPay", { exact: true });
  await expect(paymentLink).toHaveAttribute("href", paymentUrl);
  await expect(paymentLink).not.toHaveAttribute("target");
  await expect(quickPaymentLink).toHaveAttribute("href", paymentUrl);
  await expect(quickPaymentLink).not.toHaveAttribute("target");
  await browser.route("https://payments.example.test/**", route => route.fulfill({
    status: 200, contentType: "text/html", body: "<h1>Test payment handoff</h1>",
  }));
  await quickPaymentLink.tap();
  await expect(browser).toHaveURL(paymentUrl);
  await app.open(`/b/${slug}`);
  await paymentLink.focus();
  await paymentLink.press("Enter");
  await expect(browser).toHaveURL(paymentUrl);

  const iconResponse = await fetch(new URL("/icons/social/linkedin.svg", app.baseUrl));
  const backgroundResponse = await fetch(new URL("/payment-nfc.webp", app.baseUrl));
  expect(iconResponse.status).toBe(200);
  expect(backgroundResponse.status).toBe(200);
});
