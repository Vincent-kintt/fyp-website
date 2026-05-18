// Per-user, MongoDB-backed rate limiter for AI streaming endpoints (H10).
//
// AI routes have no other governor on request volume — a logged-in user
// firing dozens of streaming requests from dev tools can blow the
// OpenRouter quota and take the AI surface down for everyone. The fix
// is a sliding-window per-user counter persisted to MongoDB via
// `rate-limiter-flexible` (`RateLimiterMongo`), the same store cluster
// M's user-AI lock uses. No new external service, no payment, works
// across serverless invocations because the count lives in Mongo, not
// in process memory.
//
// Limits chosen for a personal-app AI surface:
//   - 20 requests per 60s window
//   - 60s block after exceed
// The cost-control envelope here is: even a steady stream of 20
// req/min spread across the 7 endpoints sits well below OpenRouter's
// per-key rate cap and below the per-message token budget that would
// noticeably move a daily quota dial. The 60s block window is short
// enough that a real user who hits it once during normal work
// recovers naturally before they'd notice; long enough that a
// scripted attacker can't churn the limiter every second.
//
// The limiter is a lazy singleton — `RateLimiterMongo` keeps a handle
// to the Mongo collection and initializes its indexes on first use,
// so constructing one per request would be both wasteful and
// race-prone. The `__resetLimiterForTests` seam clears the singleton
// between vitest runs so each test rebinds to a fresh
// mongodb-memory-server client.
//
// If MongoDB is down, `.consume()` rejects with a non-RateLimiterRes
// error which we re-throw — the AI endpoint would fail to do its work
// anyway (every reminder/note tool talks to Mongo), so failing closed
// here is the same correctness boundary as everywhere else in the app.

import { RateLimiterMongo } from "rate-limiter-flexible";
import { getMongoClient } from "@/lib/db.js";

const DEFAULT_POINTS = 20;
const DEFAULT_DURATION = 60;
const DEFAULT_BLOCK_DURATION = 60;
const KEY_PREFIX = "ai";
const TABLE_NAME = "ai_rate_limits";

// The limiter cache is keyed by the option set so the route default
// (20/60/60) and any test override (e.g. {points: 1, duration: 1})
// each get their own instance. `RateLimiterMongo` does not let you
// reconfigure points after construction.
const limiters = new Map();

function cacheKey({ points, duration, blockDuration }) {
  return `${points}:${duration}:${blockDuration}`;
}

async function getLimiter({ points, duration, blockDuration }) {
  const key = cacheKey({ points, duration, blockDuration });
  const existing = limiters.get(key);
  if (existing) return existing;

  const client = await getMongoClient();
  // Read MONGODB_DB at call-time, not at module load. lib/db.js's
  // connectDB() also reads it lazily — keeping the same pattern means
  // a test (or any caller) can mutate process.env before the limiter
  // ever resolves.
  const limiter = new RateLimiterMongo({
    storeClient: client,
    dbName: process.env.MONGODB_DB,
    tableName: TABLE_NAME,
    keyPrefix: KEY_PREFIX,
    points,
    duration,
    blockDuration,
  });
  limiters.set(key, limiter);
  return limiter;
}

/**
 * Attempt to consume one rate-limit point for `userId`.
 *
 * @param {string} userId
 * @param {{ points?: number, duration?: number, blockDuration?: number }} [opts]
 * @returns {Promise<{ ok: true } | { ok: false, retryAfterSeconds: number }>}
 */
export async function consumeAILimit(userId, opts = {}) {
  if (!userId) throw new Error("consumeAILimit: userId is required");
  const {
    points = DEFAULT_POINTS,
    duration = DEFAULT_DURATION,
    blockDuration = DEFAULT_BLOCK_DURATION,
  } = opts;

  const limiter = await getLimiter({ points, duration, blockDuration });

  try {
    await limiter.consume(userId, 1);
    return { ok: true };
  } catch (rejection) {
    // RateLimiterMongo rejects with a `RateLimiterRes` only when the
    // quota is exhausted; anything else (Mongo connection issue,
    // unexpected error) we re-throw so the route surfaces a 500 and
    // the operator can investigate. Distinguishing on the
    // `msBeforeNext` property is the documented contract.
    if (rejection && typeof rejection.msBeforeNext === "number") {
      return {
        ok: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(rejection.msBeforeNext / 1000),
        ),
      };
    }
    throw rejection;
  }
}

/**
 * Test-only seam: clear the cached limiter singletons. Production
 * callers should never reach for this.
 */
export function __resetLimiterForTests() {
  limiters.clear();
}
