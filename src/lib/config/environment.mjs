// Project refs are public identifiers, not credentials. Keep this mapping under review.
export const SUPABASE_PROJECTS = Object.freeze({
  staging: "flkakuysakgwfoemgbwn",
  production: "jezpobjlfvihikplxrta",
});

/** Fail before Next.js or a test runner can contact the wrong database.
 * @param {Record<string, string | undefined>} env
 */
export function assertSupabaseEnvironment(env) {
  const target = env.VERCEL_ENV || env.NEXTAP_ENV || "development";
  if (!["development", "preview", "staging", "production", "test"].includes(target)) {
    throw new Error("Unknown NexTap environment; review NEXTAP_ENV / VERCEL_ENV.");
  }
  if (env.VERCEL_ENV && env.NEXTAP_ENV && env.VERCEL_ENV !== env.NEXTAP_ENV && !(env.VERCEL_ENV === "preview" && env.NEXTAP_ENV === "staging")) {
    throw new Error("NEXTAP_ENV conflicts with the Vercel deployment target.");
  }
  let url;
  try { url = new URL(env.NEXT_PUBLIC_SUPABASE_URL || ""); }
  catch { throw new Error("A valid NEXT_PUBLIC_SUPABASE_URL is required."); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("Supabase URL must be an origin without credentials or a path.");
  }
  const production = url.hostname === `${SUPABASE_PROJECTS.production}.supabase.co`;
  const staging = url.hostname === `${SUPABASE_PROJECTS.staging}.supabase.co`;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const placeholder = url.hostname === "example.supabase.co" && env.CI === "true";
  if (target === "production") {
    if (!production || env.NODE_ENV === "development" || env.E2E_ALLOW_MUTATIONS === "true") {
      throw new Error("Production requires its dedicated Supabase project and cannot run development/E2E mutations.");
    }
  } else if (production || !(staging || local || placeholder)) {
    throw new Error("Non-production NexTap must use the approved staging project or local Supabase.");
  }
  if ((!local && (url.protocol !== "https:" || url.port)) || (local && !["http:", "https:"].includes(url.protocol))) {
    throw new Error("Hosted Supabase requires HTTPS on its standard port.");
  }
  if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith("sb_secret_")) {
    throw new Error("A public Supabase key is required; never use a secret key.");
  }
  return { target, project: production ? "production" : staging ? "staging" : local ? "local" : "ci" };
}
