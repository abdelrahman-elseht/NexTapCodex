export async function onRequest({ env, params, request, waitUntil }) {
  console.log("phase0-media", new URL(request.url).pathname);
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  const key = Array.isArray(params.key) ? params.key.join("/") : params.key;
  if (!key || key.includes("..")) {
    return new Response("Invalid media key", { status: 400 });
  }

  const cacheKey = new Request(new URL(request.url).origin + `/media/${key}`, {
    method: "GET",
  });
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("X-Phase0-R2-Cache", "HIT");
    return request.method === "HEAD"
      ? new Response(null, { status: cached.status, headers })
      : new Response(cached.body, { status: cached.status, headers });
  }

  const object = await env.PHASE0_MEDIA.get(key);
  if (!object) {
    return Response.json(
      { marker: "phase0-media-missing-v1", requestedKey: key },
      { status: 404 },
    );
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=60");
  headers.set("X-Phase0-R2-Cache", "MISS");
  const response = new Response(object.body, { headers });
  waitUntil(caches.default.put(cacheKey, response.clone()));
  return request.method === "HEAD"
    ? new Response(null, { status: response.status, headers })
    : response;
}
