"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export async function signIn(formData: FormData) {
  const email=String(formData.get("email")||"").trim().toLowerCase(), password=String(formData.get("password")||"");
  if (!email || !password || password.length>256) redirect("/login?notice=invalid");
  const supabase=await createClient();
  const {error}=await supabase.auth.signInWithPassword({email,password});
  if(error) redirect("/login?notice=invalid");
  const {data}=await supabase.auth.getClaims();
  const subject=data?.claims?.sub;
  if(typeof subject!=="string") { await supabase.auth.signOut(); redirect("/login?notice=invalid"); }
  const {data:owner}=await supabase.from("owner_users").select("user_id").eq("user_id",subject).maybeSingle();
  if(!owner) { await supabase.auth.signOut(); redirect("/login?notice=unauthorized"); }
  redirect("/admin");
}