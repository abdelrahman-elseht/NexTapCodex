import { test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";
import { createServerClient } from "@supabase/ssr";
import { fetchApp } from "./_helpers/http";

test("authenticated non-owners cannot enter the dashboard, read owner rows or upload media", async ({ app, screen, browser }) => {
  test.skip(!process.env.E2E_USER_NON_OWNER_USERNAME || !process.env.E2E_USER_NON_OWNER_PASSWORD, "Requires protected Staging non-owner credentials.");
  await app.open("/login?lang=en");
  await screen.getByLabel("Email address").fill(credentials.user("nonOwner").username);
  await screen.getByLabel("Password").fill(credentials.user("nonOwner").password);
  await screen.getByRole("button", "Sign in securely").tap();
  await expect(browser).toHaveURL(/\/login\?notice=unauthorized/, { timeout: 30_000 });

  // The UI rejects and signs out non-owners. Also exercise the server with a
  // valid authenticated session directly, so anonymous denial cannot mask an
  // owner-allowlist or RLS failure. Never record these cookies in runner steps.
  const cookies = new Map<string, string>();
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { cookies: {
    getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
    setAll: values => values.forEach(({ name, value }) => cookies.set(name, value)),
  } });
  const { data, error } = await client.auth.signInWithPassword({ email: process.env.E2E_USER_NON_OWNER_USERNAME!, password: process.env.E2E_USER_NON_OWNER_PASSWORD! });
  if (error || !data.user) throw new Error("The protected Staging non-owner fixture could not authenticate.");
  try {
    const headers = { Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") };
    const dashboard = await fetchApp(new URL("/admin", app.baseUrl), { headers });
    expect(dashboard.status).toBe(307);
    expect(new URL(dashboard.headers.get("location")!, app.baseUrl).pathname).toBe("/login");
    expect(new URL(dashboard.headers.get("location")!, app.baseUrl).searchParams.get("notice")).toBe("unauthorized");
    const media = await fetchApp(new URL("/api/admin/media", app.baseUrl), { method: "POST", headers });
    expect(media.status).toBe(401);
    for (const [table, column] of [["businesses", "id"], ["owner_users", "user_id"]]) {
      const result = await client.from(table).select(column).limit(1);
      expect(Boolean(result.error)).toBe(false);
      expect(result.data).toEqual([]);
    }
  } finally {
    await client.auth.signOut({ scope: "local" });
  }
});
