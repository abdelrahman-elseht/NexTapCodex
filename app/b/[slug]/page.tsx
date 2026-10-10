import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { PublicSnapshot } from "@/components/public-snapshot";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data, error } = await createPublicClient().rpc("get_published_page", { page_slug: slug });
  if (error || !data) notFound();
  return <PublicSnapshot snapshot={data} />;
}
