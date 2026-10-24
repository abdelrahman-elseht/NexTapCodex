/**
 * Resolve the build-time wallet control policy. An empty injected variable is
 * treated as unset so a deployment cannot accidentally hide the wallet
 * actions. An explicit `false` remains the kill switch for any environment.
 * @param {Record<string, string | undefined>} env
 */
export function resolveWalletUssdEnabled(env) {
  const explicit = (env.NEXT_PUBLIC_WALLET_USSD_ENABLED || "").trim().toLowerCase();
  if (explicit === "true" || explicit === "false") return explicit;
  return "true";
}
