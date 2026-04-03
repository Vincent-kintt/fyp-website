/**
 * In-memory sliding window rate limiter.
 * Suitable for single-instance deployments (FYP project).
 * For production/multi-instance, replace with Redis-backed solution.
 */

const store = new Map();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now - entry.windowStart > windowMs * 2) {
      store.delete(key);
    }
  }
}

/**
 * @param {string} key - Rate limit key (e.g. IP address)
 * @param {{ maxAttempts?: number, windowMs?: number }} options
 * @returns {{ success: boolean, remaining: number, resetMs: number }}
 */
export function checkRateLimit(key, { maxAttempts = 5, windowMs = 60_000 } = {}) {
  const now = Date.now();
  cleanup(windowMs);

  const entry = store.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { windowStart: now, count: 1 });
    return { success: true, remaining: maxAttempts - 1, resetMs: windowMs };
  }

  if (entry.count >= maxAttempts) {
    const resetMs = windowMs - (now - entry.windowStart);
    return { success: false, remaining: 0, resetMs };
  }

  entry.count++;
  return {
    success: true,
    remaining: maxAttempts - entry.count,
    resetMs: windowMs - (now - entry.windowStart),
  };
}
