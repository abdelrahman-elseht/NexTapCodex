import type { SupabaseClient } from "@supabase/supabase-js";
export type BatchSnapshot = {
  batch: { id: string; name: string; batch_code: string; quantity: number; created_at: string };
  cards: { id: string; serial: string; token: string; status: string }[];
};
export async function readBatchSnapshot(supabase: SupabaseClient, id: string): Promise<BatchSnapshot | null> {
  const { data, error } = await supabase.rpc("card_batch_snapshot", { target_batch: id });
  if (error) throw new Error("Could not read batch inventory");
  return data;
}
