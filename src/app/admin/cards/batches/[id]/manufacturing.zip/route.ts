import { requireOwner } from "@/lib/auth/owner";
import { getCardOrigin, manufacturingZip } from "@/lib/cards/card-manufacturing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Invalid batch", { status: 400 });

  const { supabase } = await requireOwner();
  const [{ data: batch, error: batchError }, { data: cards, error: cardsError }] = await Promise.all([
    supabase.from("card_batches").select("id,batch_code,quantity").eq("id", id).maybeSingle(),
    supabase.from("cards").select("serial,token,status").eq("batch_id", id)
      .order("serial", { ascending: true }).limit(1000),
  ]);
  if (batchError || cardsError || !batch || !cards || cards.length !== batch.quantity) {
    return new Response("Not found", { status: 404 });
  }

  const archive = await manufacturingZip(cards, batch.batch_code, getCardOrigin(undefined, request.headers));
  return new Response(Buffer.from(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="NexTap-${batch.batch_code}.zip"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
