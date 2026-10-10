import { unstable_cache } from "next/cache";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import type { Snapshot } from "@/components/public-snapshot";
import { captureOperationError } from "@/lib/observability";

type Pointer = { publicationId?: string; version?: number; slug?: string; isAlias?: boolean };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function readSnapshot(publicationId: string): Promise<Snapshot | null> {
  const { data, error } = await createPublicClient().rpc("get_publication_snapshot", { target_publication_id: publicationId });
  return error || !data || typeof data !== "object" ? null : data as Snapshot;
}

const cachedSnapshot = (publicationId: string) => unstable_cache(
  () => readSnapshot(publicationId),
  ["public-publication-snapshot", publicationId],
  { revalidate: false },
)();

async function resolvePublicPublication(slug: string): Promise<Snapshot | null> {
  const client = createPublicClient();
  const pointerResult = await client.rpc("get_publication_pointer", { page_slug: slug });
  const pointer = pointerResult.data as Pointer | null;
  if (!pointerResult.error && pointer?.publicationId && uuid.test(pointer.publicationId)) {
    const snapshot = await cachedSnapshot(pointer.publicationId);
    if (snapshot) return snapshot;
  }

  // Compatibility fallback during rollout, and a useful recovery path for a cold-cache failure.
  const fallback = await client.rpc("get_published_page", { page_slug: slug });
  if (pointerResult.error && fallback.error) captureOperationError(new Error("Public publication lookup failed"), "public.publication.read");
  return fallback.error || !fallback.data ? null : fallback.data as Snapshot;
}

// Page rendering and generateMetadata share this request-local promise.
export const getPublicPublication = cache(resolvePublicPublication);
