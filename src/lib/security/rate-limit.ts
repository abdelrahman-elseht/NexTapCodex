type Window = { startedAt: number; count: number };
type Limit = { max: number; windowMs: number; maxKeys?: number };

const windows = new Map<string, Window>();
const DEFAULT_MAX_KEYS = 2048;

function evictExpired(now: number, windowMs: number) {
  for (const [key, value] of windows) {
    if (now - value.startedAt >= windowMs) windows.delete(key);
  }
}

/** A bounded process-local budget for expensive operations. Providers/WAFs remain the distributed control. */
export function consumeRateLimit(scope: string, subject: string | null | undefined, limit: Limit): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const windowMs = Math.max(1_000, limit.windowMs);
  evictExpired(now, windowMs);
  const maxKeys = Math.max(1, limit.maxKeys || DEFAULT_MAX_KEYS);
  const key = `${scope}:${String(subject || "anonymous").slice(0, 160)}`;
  let current = windows.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    if (!current && windows.size >= maxKeys) {
      const oldest = windows.keys().next().value;
      if (typeof oldest === "string") windows.delete(oldest);
    }
    current = { startedAt: now, count: 0 };
    windows.set(key, current);
  }
  current.count += 1;
  const allowed = current.count <= Math.max(1, limit.max);
  return { allowed, retryAfter: Math.max(1, Math.ceil((current.startedAt + windowMs - now) / 1000)) };
}

export function resetRateLimits() {
  windows.clear();
}
