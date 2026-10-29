// In-memory sliding-window rate limiter (same as Ask Kazakhstan's).
// Per server instance only; a Vercel Firewall rate-limit rule is the backstop across instances.

const buckets = new Map<string, number[]>();

const CLEAN_INTERVAL_MS = 5 * 60_000;
let lastCleanup = Date.now();

function cleanup(now: number, windowMs: number) {
  if (now - lastCleanup < CLEAN_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [k, hits] of buckets) {
    const live = hits.filter(t => now - t < windowMs);
    if (live.length === 0) buckets.delete(k);
    else buckets.set(k, live);
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): { allowed: boolean; retryAfterSec: number } {
  const windowMs = windowSec * 1000;
  const now = Date.now();
  cleanup(now, windowMs);

  const hits = (buckets.get(key) ?? []).filter(t => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { allowed: false, retryAfterSec: Math.ceil((windowMs - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { allowed: true, retryAfterSec: 0 };
}
