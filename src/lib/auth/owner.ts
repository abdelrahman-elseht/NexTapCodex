import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

const getOwner = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;
  if (error || typeof subject !== "string") redirect("/login");
  const { data: owner, error: ownerError } = await supabase.from("owner_users").select("user_id").eq("user_id", subject).maybeSingle();
  if (ownerError || !owner) redirect("/login?notice=unauthorized");
  return { supabase, userId: subject };
});

/** Request-local memoization avoids repeating the same auth and allowlist query. */
export type AdminCapability = "read" | "edit" | "publish" | "media" | "inventory" | "export" | "delete";
export async function requireOwner(capability: AdminCapability = "read") {
  const owner = await getOwner();
  if (capability !== "read") {
    const { data, error } = await owner.supabase.rpc("admin_has_capability", { capability });
    if (error || data !== true) redirect("/403");
  }
  return owner;
}
