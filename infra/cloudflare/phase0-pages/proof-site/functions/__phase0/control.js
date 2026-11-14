export function onRequest({ request }) {
  console.log("phase0-control", new URL(request.url).pathname);
  return Response.json(
    { marker: "phase0-control-v1", invoked: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
