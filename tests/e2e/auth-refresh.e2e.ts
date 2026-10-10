import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";

test("expired cookie sessions refresh on admin routes and sign-out removes owner access", async ({ app, screen, browser }) => {
  test.skip(!process.env.E2E_USER_OWNER_USERNAME || !process.env.E2E_USER_OWNER_PASSWORD, "Requires isolated owner credentials");
  await app.open("/login");
  await screen.getByLabel("البريد الإلكتروني").fill(credentials.user("owner").username);
  await screen.getByLabel("كلمة المرور").fill(credentials.user("owner").password);
  await screen.getByRole("button", "دخول آمن").tap();
  await expect(browser).toHaveURL(/\/admin(?:\?.*)?$/);
  await expect(screen.getByRole("heading", "لوحة التحكم")).toBeVisible();
  const cookies = (await browser.cookies()).filter(cookie => /sb-.*-auth-token/.test(cookie.name)).sort((a,b) => a.name.localeCompare(b.name));
  expect(cookies.length > 0).toBe(true);
  const encoded = cookies.map(cookie => cookie.value).join("");
  const session = JSON.parse(Buffer.from(encoded.replace(/^base64-/, ""), "base64url").toString());
  session.expires_at = 1; // Exercise the real refresh endpoint using our valid refresh token.
  let changed = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  await browser.setCookies(cookies.map((cookie,index) => { const value = index === cookies.length-1 ? changed : changed.slice(0,cookie.value.length); changed = changed.slice(value.length); return { ...cookie, value }; }));
  await app.open("/admin");
  await expect(screen.getByRole("heading", "لوحة التحكم")).toBeVisible();
  const freshCookies = (await browser.cookies()).filter(cookie => /sb-.*-auth-token/.test(cookie.name)).sort((a,b) => a.name.localeCompare(b.name));
  const fresh = JSON.parse(Buffer.from(freshCookies.map(cookie => cookie.value).join("").replace(/^base64-/, ""), "base64url").toString());
  expect(fresh.expires_at > Date.now()/1000).toBe(true);
  await screen.getByRole("button", "خروج", { exact: true }).tap();
  await app.open("/admin");
  await expect(browser).toHaveURL(/\/login/);
});
