import { readBatchSnapshot } from "@/lib/cards/batch-snapshot";
import { requireOwner } from "@/lib/auth/owner";
import { getCardOrigin, manufacturingZip } from "@/lib/cards/card-manufacturing";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Invalid batch", { status: 400 });

  const { supabase, userId } = await requireOwner("export");
  const budget = consumeRateLimit("manufacturing-export", userId, { max: 5, windowMs: 60_000, maxKeys: 256 });
  if (!budget.allowed) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const snapshot = await readBatchSnapshot(supabase, id);
  if (!snapshot) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const { batch, cards } = snapshot;
  if (!cards.length) return new Response("Empty inventory", { status: 409, headers: { "Cache-Control": "private, no-store" } });

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
