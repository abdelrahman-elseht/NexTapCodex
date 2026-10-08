import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireOwner() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;
  if (error || typeof subject !== "string") redirect("/login");
  const { data: owner, error: ownerError } = await supabase.from("owner_users").select("user_id").eq("user_id", subject).maybeSingle();
  if (ownerError || !owner) redirect("/login?notice=unauthorized");
  return { supabase, userId: subject };
}