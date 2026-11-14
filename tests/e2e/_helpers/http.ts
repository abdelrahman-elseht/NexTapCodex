// Keep direct E2E HTTP requests inside the local test server.
export function fetchApp(url: URL, init: RequestInit = {}) {
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (!local) throw new Error("E2E HTTP requests must target the local app.");
  if (url.username || url.password) throw new Error("E2E URLs must not contain credentials.");
  const headers = new Headers(init.headers);
  return fetch(url, { ...init, headers, redirect: "manual" });
}
