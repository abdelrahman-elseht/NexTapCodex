export async function onRequest({ env, request, params }) {
  console.log("phase0-menu", new URL(request.url).pathname);
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  const segments = Array.isArray(params.path)
    ? params.path
    : params.path ? [params.path] : [];
  const target = new URL(env.MENU_ORIGIN);
  target.pathname = "/" + segments.map(encodeURIComponent).join("/");
  target.search = new URL(request.url).search;
  return fetch(target, { method: request.method });
}
