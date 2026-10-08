import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

test("the only eligible published page is selected for card activation", async ({ app, screen, browser }) => {
  test.skip(
    !process.env.E2E_USER_OWNER_USERNAME || !process.env.E2E_USER_OWNER_PASSWORD,
    "Set owner E2E credentials to verify the authenticated card assignment screen.",
  );

  await app.open("/login");
  await screen.getByLabel("البريد الإلكتروني").fill(credentials.user("owner").username);
  await screen.getByLabel("كلمة المرور").fill(credentials.user("owner").password);
  await screen.getByRole("button", "دخول آمن").tap();
  await expect(browser).toHaveURL(/\/admin(?:\?.*)?$/);

  await app.open("/admin/cards");
  await expect(screen.getByRole("heading", "البحث والتصفية")).toBeVisible();
  const initialSerial = await browser.evaluate(() =>
    document.querySelector<HTMLTableRowElement>(".table-wrap tbody tr strong")?.textContent?.trim() || "",
  );
  expect(initialSerial).toBeTruthy();
  await screen.getByRole("combobox").nth(0).selectOption({ label: "مفعّلة" });
  await screen.getByRole("button", "تطبيق التصفية").tap();
  await expect(browser).toHaveURL(/\/admin\/cards\?status=active/);
  const shownStatuses = await browser.evaluate(() =>
    Array.from(document.querySelectorAll(".table-wrap tbody tr"), row => row.children[1]?.textContent?.trim() || ""),
  );
  expect(shownStatuses.length).toBeGreaterThan(0);
  expect(shownStatuses.every(status => status === "active")).toBe(true);
  const linkPath = await browser.evaluate(() =>
    document.querySelector<HTMLAnchorElement>('.table-wrap a[href^="/c/"]')?.getAttribute("href") || "",
  );
  expect(linkPath).toMatch(/^\/c\/[A-Za-z0-9_-]{32,64}\?via=nfc$/);

  await app.open("/admin/cards");
  const assignment = await browser.evaluate(() => {
    const selectors = Array.from(document.querySelectorAll<HTMLSelectElement>('select[name="page_id"]'));
    if (selectors.length === 0) return { cards: 0, pageOptions: 0, selected: [] as string[], eligiblePageId: "" };
    return {
      cards: selectors.length,
      pageOptions: selectors[0].options.length - 1,
      selected: selectors.map(select => select.value),
      eligiblePageId: selectors[0].options[1]?.value || "",
    };
  });
  test.skip(assignment.cards === 0, "No card inventory exists in the isolated E2E project yet.");
  test.skip(assignment.pageOptions !== 1, "This regression applies when exactly one published page is eligible.");

  expect(assignment.eligiblePageId).toBeTruthy();
  expect(assignment.selected.every(value => value === assignment.eligiblePageId)).toBe(true);
});
