import { requireOwner } from "@/lib/auth/owner";
import { cardUrls, getCardOrigin } from "@/lib/card-manufacturing";

export const dynamic = "force-dynamic";

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function GET(req: Request) {
  const { supabase } = await requireOwner();
  const requestOrigin = getCardOrigin(undefined, req.headers);
  const id = new URL(req.url).searchParams.get("batch");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("Invalid batch", { status: 400 });
  }

  const { data, error } = await supabase
    .from("cards")
    .select("serial,token")
    .eq("batch_id", id)
    .order("serial");
  if (error) return new Response("Not found", { status: 404 });

  const rows = [
    ["serial", "token", "qr_url", "nfc_url"],
    ...(data || []).map((card) => {
      const urls = cardUrls(card.token, requestOrigin);
      return [card.serial, card.token, urls.qrUrl, urls.nfcUrl];
    }),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=nextap-${id.slice(0, 8)}.csv`,
      "Cache-Control": "private, no-store",
    },
  });
}
