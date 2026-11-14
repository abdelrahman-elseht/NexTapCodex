export async function onRequest({ params, request }) {
  console.log("phase0-purge", new URL(request.url).pathname);
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const key = Array.isArray(params.key) ? params.key.join("/") : params.key;
  if (!key || key.includes("..")) {
    return new Response("Invalid media key", { status: 400 });
  }

  const url = new URL(`/media/${key}`, request.url);
  const deleted = await caches.default.delete(new Request(url, { method: "GET" }));
  return Response.json({ marker: "phase0-purge-v1", deleted });
}
