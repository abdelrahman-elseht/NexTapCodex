// Node requests do not inherit the browser's host-only bypass cookie. Never follow
// redirects while carrying a deployment bypass, including redirects to SSO.
export function fetchApp(url: URL, init: RequestInit = {}) {
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  const staging = url.protocol === "https:" && !url.port &&
    url.hostname === "staging.nextap.services";
  if (!local && !staging) throw new Error("E2E HTTP requests must target local or Staging hosts.");
  if (url.username || url.password) throw new Error("E2E URLs must not contain credentials.");
  const headers = new Headers(init.headers);
  if (staging && process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers.set("x-vercel-protection-bypass", process.env.VERCEL_AUTOMATION_BYPASS_SECRET);
  }
  return fetch(url, { ...init, headers, redirect: "manual" });
}
