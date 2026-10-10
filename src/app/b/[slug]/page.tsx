import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicPublication } from "@/lib/business/public-publication";
import { PublicSnapshot, type Snapshot } from "@/components/business/public-snapshot";
export const dynamic = "force-dynamic";

function heroFrom(snapshot: Snapshot) {
  return snapshot.sections?.find(section => section.kind === "hero")?.content || {};
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const snapshot = await getPublicPublication(slug);
  if (!snapshot) return {};
  const hero = heroFrom(snapshot) as Record<string, unknown>;
  const name = snapshot.business?.name || snapshot.page?.branchName || "Business";
  const description = typeof hero.tagline === "string" ? hero.tagline : typeof hero.description === "string" ? hero.description : undefined;
  const image = typeof hero.coverUrl === "string" && /^(https?:\/\/|\/)/.test(hero.coverUrl) ? hero.coverUrl : undefined;
  return { title: name, description, openGraph: { title: name, description, ...(image ? { images: [{ url: image, alt: typeof hero.coverAlt === "string" ? hero.coverAlt : name }] } : {}) } };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const snapshot = await getPublicPublication(slug);
  if (!snapshot) notFound();
  return <PublicSnapshot snapshot={snapshot} />;
}
