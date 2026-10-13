import { web, surfaceOf } from "@e2e-dev/web";
import { defineEngine } from "e2e/engine";

// Keep the bypass out of engine headers: @e2e-dev/web scopes them to a site,
// which includes sibling domains and other vercel.app tenants. Bootstrap an
// HttpOnly host-only cookie through Node instead, without following redirects.
export function hostedBrowser(origin: string, viewport: { width: number; height: number }) {
  if (origin !== "https://staging.nextap.services") throw new Error("Browser protection requires the stable Staging origin.");
  const base = web({ viewport });
  const live = surfaceOf(base)!;
  const installCookie = async () => {
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
    if (!bypass) return;
    const response = await fetch(origin, {
      headers: { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    const header = response.headers.getSetCookie().find(value => value.startsWith("_vercel_jwt="));
    if (!header || ![200, 307].includes(response.status)) {
      throw new Error("Staging protection did not issue its bypass cookie.");
    }
    const value = header.split(";", 1)[0].slice("_vercel_jwt=".length);
    // Use URL, never the provider's Domain attribute. Playwright creates a
    // host-only cookie, so Production and unrelated tenants cannot receive it.
    await live.context().addCookies([{ name: "_vercel_jwt", value, url: origin, secure: true, httpOnly: true, sameSite: "Lax" }]);
    const siblingCookies = await live.context().cookies(["https://nextap.services", "https://admin.nextap.services", "https://unrelated-tenant.vercel.app"]);
    if (siblingCookies.some(cookie => cookie.name === "_vercel_jwt")) throw new Error("Bypass cookie escaped the Staging host.");
  };
  // Engine handles contain computed capabilities; defineEngine accepts only
  // the engine manifest. Reuse its public hooks and underlying live surface.
  const { capabilities, ...manifest } = base;
  void capabilities;
  return defineEngine({
    ...manifest,
    async startAttempt(context) {
      await base.startAttempt!(context);
      await installCookie();
    },
    session: {
      ...base.session,
      async reset(operation) {
        await base.session!.reset!(operation);
        await installCookie();
      },
    },
    state: {
      ...base.state!,
      async restore(state, operation) {
        await base.state!.restore(state, operation);
        await installCookie();
      },
    },
  });
}
