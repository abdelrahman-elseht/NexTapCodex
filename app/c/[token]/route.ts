import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const redirectHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
};

function redirectToPath(path: string) {
  return new Response(null, {
    status: 302,
    headers: { ...redirectHeaders, Location: path },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) {
    return redirectToPath("/card/unavailable?state=invalid");
  }

  const { data, error } = await (await createClient()).rpc("resolve_card", {
    card_token: token,
  });

  if (
    !error &&
    data?.state === "active" &&
    /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(data.slug)
  ) {
    const via = new URL(req.url).searchParams.get("via");
    const suffix = via === "qr" || via === "nfc" ? "?via=" + via : "";
    return redirectToPath("/b/" + data.slug + suffix);
  }

  const state = !error && ["unassigned", "inactive"].includes(data?.state)
    ? data.state
    : "invalid";
  return redirectToPath("/card/unavailable?state=" + state);
}
