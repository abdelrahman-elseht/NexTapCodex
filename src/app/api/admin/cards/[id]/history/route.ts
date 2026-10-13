import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/owner";
import { captureOperationError } from "@/lib/observability/operations";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const limit = 25;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) return NextResponse.json({ error: "Invalid card." }, { status: 400 });
  const { supabase } = await requireOwner();
  const cursor = new URL(request.url).searchParams.get("cursor");
  let query = supabase.from("card_assignment_history").select("id,old_status,new_status,reason,created_at").eq("card_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  if (cursor && /^\d+$/.test(cursor)) query = query.lt("id", cursor);
  const { data, error } = await query;
  if (error) { captureOperationError(error, "admin.card_history.read"); return NextResponse.json({ error: "تعذر تحميل سجل البطاقة." }, { status: 503 }); }
  const events = data || [];
  const hasMore = events.length > limit;
  if (hasMore) events.pop();
  return NextResponse.json({ events, nextCursor: hasMore && events.length ? String(events[events.length - 1].id) : null }, { headers: { "Cache-Control": "private, no-store" } });
}
