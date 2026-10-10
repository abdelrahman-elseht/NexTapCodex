import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

test("an owner creates, publishes, activates, scans, renames, and reassigns a card", async ({ app, screen, browser }) => {
  test.skip(
    !process.env.E2E_USER_OWNER_USERNAME ||
      !process.env.E2E_USER_OWNER_PASSWORD ||
      process.env.E2E_ALLOW_MUTATIONS !== "true",
    "Owner workflow tests require credentials and E2E_ALLOW_MUTATIONS=true for a dedicated isolated Supabase test project.",
  );

  await app.open("/login");
  await screen.getByLabel("البريد الإلكتروني").fill(credentials.user("owner").username);
  await screen.getByLabel("كلمة المرور").fill(credentials.user("owner").password);
  await screen.getByRole("button", "دخول آمن").tap();
  await expect(browser).toHaveURL(/\/admin(?:\?.*)?$/);

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const originalSlug = `e2e-${suffix}`;
  const renamedSlug = `e2e-renamed-${suffix}`;
  const secondSlug = `e2e-target-${suffix}`;
  const draftDescription = `Draft content ${suffix}`;

  await app.open("/admin/businesses/new");
  await screen.getByLabel("اسم النشاط").fill(`E2E Business ${suffix}`);
  await screen.getByLabel("التصنيف").fill("E2E");
  await screen.getByLabel("رابط الصفحة").fill(originalSlug);
  await screen.getByRole("button", "إنشاء النشاط والصفحة").tap();
  await expect(browser).toHaveURL(/\/admin\/businesses\/[0-9a-f-]+\?created=1/);

  const firstBusinessId = await browser.evaluate(() => location.pathname.split("/").at(-1) || "");
  const firstEditorPath = `/admin/businesses/${firstBusinessId}`;
  await expect(browser.locator('a[href*="/preview?page="]')).toBeVisible();
  const firstPageId = await browser.evaluate(() => {
    const href = document.querySelector<HTMLAnchorElement>('a[href*="/preview?page="]')?.getAttribute("href");
    return href ? new URL(href, location.origin).searchParams.get("page") || "" : "";
  });
  expect(firstBusinessId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(firstPageId).toMatch(/^[0-9a-f-]{36}$/i);

  // Templates place sections in different orders; target the semantic About
  // section instead of relying on a positional index.
  await screen.getByRole("button", /About/).tap();
  // The default cafe template keeps About hidden until the owner chooses it.
  // Enable it before editing so the draft preview and published page exercise
  // the section value end to end.
  const aboutVisible = await browser.evaluate(() => {
    const heading = [...document.querySelectorAll("h3")].find(node => /About/i.test(node.textContent || ""));
    const pane = heading?.closest(".editor-form-pane");
    return Boolean(pane?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked);
  });
  if (!aboutVisible) await screen.getByRole("checkbox").check();
  await screen.getByLabel("About copy").fill(draftDescription);
  expect(await browser.evaluate((description) => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="About copy"], textarea')?.value === description, draftDescription)).toBe(true);
  await screen.getByRole("button", "Save draft").tap();
  await expect(screen.getByRole("status")).toContainText("Draft saved");
  await app.open(`${firstEditorPath}/preview?page=${firstPageId}`);
  await expect(screen.getByRole("heading", new RegExp(`E2E Business ${suffix}`))).toBeVisible({ timeout: 20_000 });
  await expect(screen.getByText(draftDescription)).toBeVisible();

  await app.open(`/b/${originalSlug}`);
  const publicDraft = await browser.evaluate(() => document.body.innerText);
  expect(publicDraft.includes(draftDescription)).toBe(false);

  await app.open(firstEditorPath);
  await screen.getByRole("button", "Publish").tap();
  await expect(screen.getByRole("status")).toContainText("Published");
  await app.open(`/b/${originalSlug}`);
  await expect(screen.getByText(draftDescription)).toBeVisible();

  const batchName = `E2E batch ${suffix}`;
  await app.open("/admin/cards");
  await browser.locator('input[name="name"]').fill(batchName);
  await screen.getByRole("spinbutton").fill("1");
  await screen.getByRole("button", "إنشاء دفعة").tap();
  await expect(browser).toHaveURL(/\/admin\/cards\/batches\/[0-9a-f-]+\?created=1/);
  const createdBatchId = await browser.evaluate(() => location.pathname.split("/").at(-1) || "");
  expect(createdBatchId).toMatch(/^[0-9a-f-]{36}$/i);
  await app.open(`/admin/cards?batch=${createdBatchId}`);

  const card = await browser.evaluate(async () => {
    const batchId = new URL(location.href).searchParams.get("batch");
    if (!batchId) throw new Error("The created batch id is missing from the URL.");
    const response = await fetch(`/admin/cards/export?batch=${encodeURIComponent(batchId)}`);
    if (!response.ok) throw new Error("The created card batch could not be exported.");
    const csv = (await response.text()).replace(/^\uFEFF/, "");
    const row = csv.split(/\r?\n/)[1];
    const cells = row?.match(/"([^"]*)"/g)?.map(cell => cell.slice(1, -1));
    if (!cells || cells.length !== 4) throw new Error("The card CSV row is malformed.");
    const expectedOrigin = new URL(location.origin).origin;
    return {
      serial: cells[0],
      token: cells[1],
      qrUrlIsStable: cells[2] === `${expectedOrigin}/c/${cells[1]}?via=qr`,
      nfcUrlIsStable: cells[3] === `${expectedOrigin}/c/${cells[1]}?via=nfc`,
    };
  });
  expect(card.serial).toMatch(/^NT-\d{8}-\d{6}$/);
  expect(card.token).toMatch(/^[A-Za-z0-9_-]{32,64}$/);
  expect(card.qrUrlIsStable).toBe(true);
  expect(card.nfcUrlIsStable).toBe(true);

  const firstCardRow = browser.locator("tr").filter({ hasText: card.serial });
  const firstPageAssignment = firstCardRow.getByRole("combobox");
  expect(await firstPageAssignment.count()).toBe(1);
  const firstPageList = await browser.evaluate(() => {
    const select = document.querySelector<HTMLSelectElement>('select[name="page_id"]');
    return select ? {
      selected: select.value,
      options: Array.from(select.options).slice(1).map(option => ({ id: option.value, text: option.textContent || "" })),
    } : { selected: "", options: [] };
  });
  expect(firstPageList.options.some(option => option.id === firstPageId)).toBe(true);
  if (firstPageList.options.length === 1) {
    expect(firstPageList.selected).toBe(firstPageId);
  } else {
    await firstPageAssignment.selectOption({ value: firstPageId });
  }

  // Assignment is confirmed in the dialog; this form has no row checkbox.
  await firstCardRow.getByRole("button", "تفعيل / نقل").tap();
  await screen.getByRole("button", "تأكيد التعيين").tap();
  await expect(browser).toHaveURL(/\/admin\/cards\?assigned=1/, { timeout: 20_000 });
  // Read the confirmation directly; the accumulated inventory can make a full accessibility snapshot expensive.
  await expect(browser.locator('[role="status"].success')).toContainText("تم تحديث تعيين البطاقة.", { timeout: 20_000 });

  const baseUrl = app.baseUrl;
  if (!baseUrl) throw new Error("The E2E app target has no base URL.");
  const initialRedirect = await fetch(new URL(`/c/${card.token}?via=qr`, baseUrl), { redirect: "manual" });
  expect(initialRedirect.status).toBe(302);
  expect(initialRedirect.headers.get("location")).toContain(`/b/${originalSlug}?via=qr`);
  await app.open(`/c/${card.token}?via=qr`);
  await expect(browser).toHaveURL(`/b/${originalSlug}?via=qr`);

  await app.open(firstEditorPath);
  await screen.getByLabel("Business name").fill(`E2E Renamed ${suffix}`);
  await screen.getByLabel("Public slug").fill(renamedSlug);
  await screen.getByRole("button", "Save draft").tap();
  await expect(screen.getByRole("status")).toContainText("Draft saved");
  await screen.getByRole("button", "Publish").tap();
  await expect(screen.getByRole("status")).toContainText("Published");
  await app.open(`/b/${originalSlug}`);
  await expect(screen.getByText(draftDescription)).toBeVisible();

  const renamedRedirect = await fetch(new URL(`/c/${card.token}?via=qr`, baseUrl), { redirect: "manual" });
  expect(renamedRedirect.status).toBe(302);
  expect(renamedRedirect.headers.get("location")).toContain(`/b/${renamedSlug}?via=qr`);
  expect(renamedRedirect.headers.get("cache-control")).toContain("no-store");

  await app.open("/admin/businesses/new");
  await screen.getByLabel("اسم النشاط").fill(`E2E Target ${suffix}`);
  await screen.getByLabel("التصنيف").fill("E2E");
  await screen.getByLabel("رابط الصفحة").fill(secondSlug);
  await screen.getByRole("button", "إنشاء النشاط والصفحة").tap();
  await expect(browser).toHaveURL(/\/admin\/businesses\/[0-9a-f-]+\?created=1/);
  const secondBusinessId = await browser.evaluate(() => location.pathname.split("/").at(-1) || "");
  await expect(browser.locator('a[href*="/preview?page="]')).toBeVisible();
  const secondPageId = await browser.evaluate(() => {
    const href = document.querySelector<HTMLAnchorElement>('a[href*="/preview?page="]')?.getAttribute("href");
    return href ? new URL(href, location.origin).searchParams.get("page") || "" : "";
  });
  expect(secondPageId).toMatch(/^[0-9a-f-]{36}$/i);
  await screen.getByRole("button", "Publish").tap();
  await expect(screen.getByRole("status")).toContainText("Published");

  await app.open("/admin/cards");
  const secondCardRow = browser.locator("tr").filter({ hasText: card.serial });
  await secondCardRow.getByRole("combobox").selectOption({ value: secondPageId });
  // Assignment is confirmed in the dialog; this form has no row checkbox.
  await secondCardRow.getByRole("button", "تفعيل / نقل").tap();
  await screen.getByRole("button", "تأكيد التعيين").tap();
  await expect(browser).toHaveURL(/\/admin\/cards\?assigned=1/, { timeout: 20_000 });

  const reassignedRedirect = await fetch(new URL(`/c/${card.token}?via=nfc`, baseUrl), { redirect: "manual" });
  expect(reassignedRedirect.status).toBe(302);
  expect(reassignedRedirect.headers.get("location")).toContain(`/b/${secondSlug}?via=nfc`);
  expect(reassignedRedirect.headers.get("cache-control")).toContain("no-store");
  await app.open(`/c/${card.token}?via=nfc`);
  await expect(browser).toHaveURL(`/b/${secondSlug}?via=nfc`);

  await app.open(`/admin/businesses/${secondBusinessId}`);
  await expect(screen.getByRole("heading", `إدارة E2E Target ${suffix}`)).toBeVisible();
});
