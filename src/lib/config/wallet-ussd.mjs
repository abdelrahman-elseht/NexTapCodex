/**
 * Resolve the build-time wallet control policy. An empty injected variable is
 * treated as unset so E2E and preview launchers cannot accidentally disable
 * the staging experience. Production remains disabled by default.
 * @param {Record<string, string | undefined>} env
 */
export function resolveWalletUssdEnabled(env) {
  const explicit = (env.NEXT_PUBLIC_WALLET_USSD_ENABLED || "").trim().toLowerCase();
  if (explicit === "true" || explicit === "false") return explicit;
  return env.VERCEL_ENV === "production" || env.NEXTAP_ENV === "production" ? "false" : "true";
}
