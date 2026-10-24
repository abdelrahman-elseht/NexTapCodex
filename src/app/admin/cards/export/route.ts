import { readBatchSnapshot } from "@/lib/cards/batch-snapshot";
import { requireOwner } from "@/lib/auth/owner";
import { cardUrls, getCardOrigin } from "@/lib/cards/card-manufacturing";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function GET(req: Request) {
  const { supabase, userId } = await requireOwner("export");
  const budget = consumeRateLimit("card-export", userId, { max: 20, windowMs: 60_000, maxKeys: 256 });
  if (!budget.allowed) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const requestOrigin = getCardOrigin(undefined, req.headers);
  const id = new URL(req.url).searchParams.get("batch");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response("Invalid batch", { status: 400 });
  }

  const snapshot = await readBatchSnapshot(supabase, id);
  if (!snapshot) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const data = snapshot.cards;
  if (!data.length) return new Response("Empty inventory", { status: 409, headers: { "Cache-Control": "private, no-store" } });

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
