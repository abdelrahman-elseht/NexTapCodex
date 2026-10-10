import { test } from "@e2e-dev/web";
import { expect } from "e2e";

const diagnosticsEnabled = process.env.SENTRY_TEST_ERRORS_ENABLED === "1";

test("controlled Sentry client and server checks stay isolated to the diagnostics route", { skip: !diagnosticsEnabled }, async ({ app, screen }) => {
  await app.open("/sentry-example-page");
  await expect(screen.getByRole("heading", "Sentry diagnostics")).toBeVisible();
  await screen.getByRole("button", "Send controlled client error").tap();
  await expect(screen.getByRole("status")).toContainText("Client status: sent");

  const response = await fetch(new URL("/api/sentry-example-api", app.baseUrl));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true });
});
