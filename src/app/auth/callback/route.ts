import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(request:Request) {
  const url=new URL(request.url), code=url.searchParams.get("code");
  if(code) { const supabase=await createClient(); const {error}=await supabase.auth.exchangeCodeForSession(code); if(!error) return NextResponse.redirect(new URL("/admin",url.origin)); }
  return NextResponse.redirect(new URL("/login?notice=invalid",url.origin));
}