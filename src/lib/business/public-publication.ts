import { unstable_cache } from "next/cache";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import type { PublicationSnapshot as Snapshot } from "./publication";
import { captureOperationError } from "@/lib/observability/operations";
import { consumeRateLimit } from "@/lib/security/rate-limit";

type Pointer = { publicationId?: string; version?: number; slug?: string; isAlias?: boolean };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const publicSlugPattern = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;
const MAX_CACHE_ENTRIES = 256;
const MAX_IN_FLIGHT = 32;

async function readSnapshot(publicationId: string): Promise<Snapshot | null> {
  const { data, error } = await createPublicClient().rpc("get_publication_snapshot", { target_publication_id: publicationId });
  return error || !data || typeof data !== "object" ? null : data as Snapshot;
}

async function readFallback(slug: string): Promise<Snapshot | null> {
  const { data, error } = await createPublicClient().rpc("get_published_page", { page_slug: slug });
  return error || !data ? null : data as Snapshot;
}

const cachedSnapshot = (publicationId: string) => unstable_cache(
  () => readSnapshot(publicationId),
  ["public-publication-snapshot", publicationId],
  { revalidate: false },
)();

const cachedFallback = (slug: string) => unstable_cache(
  () => readFallback(slug),
  ["public-publication-fallback", slug],
  { revalidate: 5 },
)();

let publicationCacheRpcUnavailable = false;

async function resolvePublicPublication(slug: string): Promise<Snapshot | null> {
  if (!publicSlugPattern.test(slug)) return null;
  if (!consumeRateLimit("public-publication", slug, { max: 120, windowMs: 60_000, maxKeys: MAX_CACHE_ENTRIES }).allowed) return null;
  const client = createPublicClient();
  let pointerError: Error | null = null;
  if (!publicationCacheRpcUnavailable) {
    const pointerResult = await client.rpc("get_publication_pointer", { page_slug: slug });
    const pointer = pointerResult.data as Pointer | null;
    if (!pointerResult.error && pointer?.publicationId && uuid.test(pointer.publicationId)) {
      const snapshot = await cachedSnapshot(pointer.publicationId);
      if (snapshot) return snapshot;
    }
    if (pointerResult.error) pointerError = pointerResult.error;
    if (pointerResult.error && /Could not find the function .*get_publication_pointer/i.test(pointerResult.error.message)) {
      // Older pre-production projects may not have the phase-6 RPCs yet.
      // Remember that capability miss so every request does not pay its latency.
      publicationCacheRpcUnavailable = true;
    }
  }

  // Compatibility fallback during rollout, and a useful recovery path for a cold-cache failure.
  const fallback = await cachedFallback(slug);
  if (!fallback && pointerError) captureOperationError(new Error("Public publication lookup failed"), "public.publication.read");
  return fallback;
}

// Page rendering and generateMetadata run in separate framework phases. Keep
// the in-flight lookup briefly at process scope so both phases share one RPC,
// while a new publication becomes visible after the short freshness window.
const publicationCache = new Map<string, { expiresAt: number; value: Promise<Snapshot | null>; pending: boolean }>();
let inFlightLookups = 0;
const cachedPublicPublication = (slug: string) => {
  if (!publicSlugPattern.test(slug)) return Promise.resolve(null);
  const now = Date.now();
  for (const [key, entry] of publicationCache) {
    if (!entry.pending && entry.expiresAt <= now) publicationCache.delete(key);
  }
  const existing = publicationCache.get(slug);
  if (existing && (existing.pending || existing.expiresAt > now)) {
    publicationCache.delete(slug);
    publicationCache.set(slug, existing);
    return existing.value;
  }
  if (existing) publicationCache.delete(slug);
  if (inFlightLookups >= MAX_IN_FLIGHT) return Promise.resolve(null);
  while (publicationCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = publicationCache.keys().next().value;
    if (typeof oldest !== "string") break;
    publicationCache.delete(oldest);
  }
  inFlightLookups += 1;
  let entry: { expiresAt: number; value: Promise<Snapshot | null>; pending: boolean };
  const value = resolvePublicPublication(slug).finally(() => { inFlightLookups = Math.max(0, inFlightLookups - 1); entry.pending = false; });
  entry = { expiresAt: now + 5_000, value, pending: true };
  publicationCache.set(slug, entry);
  return value;
};

export const getPublicPublication = cache(cachedPublicPublication);
