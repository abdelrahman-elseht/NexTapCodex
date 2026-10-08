import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

test("owner creates a manufacturing batch, previews its QR, and downloads its archive", async ({ app, screen, browser }) => {
  test.skip(
    !process.env.E2E_USER_OWNER_USERNAME || !process.env.E2E_USER_OWNER_PASSWORD || process.env.E2E_ALLOW_MUTATIONS !== "true",
    "Manufacturing E2E requires owner credentials and E2E_ALLOW_MUTATIONS=true on an isolated Supabase project.",
  );

  await app.open("/login");
  await screen.getByLabel("البريد الإلكتروني").fill(credentials.user("owner").username);
  await screen.getByLabel("كلمة المرور").fill(credentials.user("owner").password);
  await screen.getByRole("button", "دخول آمن").tap();
  await expect(browser).toHaveURL(/\/admin(?:\?.*)?$/);

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  await app.open("/admin/cards");
  await browser.locator('input[name="name"]').fill(`Manufacturing E2E ${suffix}`);
  await browser.locator('input[name="quantity"]').fill("3");
  await screen.getByRole("button", "إنشاء دفعة").tap();
  await expect(browser).toHaveURL(/\/admin\/cards\/batches\/[0-9a-f-]+\?created=1/);
  await expect(screen.getByRole("heading", "معاينة QR لبطاقة واحدة")).toBeVisible();
  await expect(screen.getByText(/https:\/\/nextab\.services\/c\/.+\?via=qr/)).toBeVisible();

  const download = await browser.waitForDownload(() =>
    screen.getByRole("link", "تنزيل حزمة التصنيع ZIP").tap(),
  );
  expect(download.suggestedFilename).toMatch(/^NexTap-BATCH-[0-9]{3,}\.zip$/);
  const archive = unzipSync(new Uint8Array(readFileSync(download.path)));
  expect(Object.keys(archive).sort()).toHaveLength(6);
  expect(archive["manifest.csv"]).toBeTruthy();
  expect(archive["nfc-encoding.csv"]).toBeTruthy();
  expect(archive["PRINT-INSTRUCTIONS.txt"]).toBeTruthy();
  expect(Object.keys(archive).filter((path) => path.startsWith("qr/")).length).toBe(3);
});
