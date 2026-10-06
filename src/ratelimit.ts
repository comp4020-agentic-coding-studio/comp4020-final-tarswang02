// Minimal in-memory per-key token bucket. This app runs as one process on
// one machine (fly.toml: one VM, no horizontal scaling), so in-memory state
// is the whole state — no shared store needed.
const buckets = new Map<string, { tokens: number; resetAt: number }>();

const CAPACITY = 20;
const WINDOW_MS = 60_000;

export function allow(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { tokens: CAPACITY - 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.tokens <= 0) return false;
  bucket.tokens -= 1;
  return true;
}
