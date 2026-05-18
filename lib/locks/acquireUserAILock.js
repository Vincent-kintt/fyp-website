// Cross-process atomic lock for per-user AI streaming, backed by MongoDB.
//
// Replaces the module-level Set<userId> in lib/ai/notesConcurrency.js, which
// only enforced mutual exclusion inside one warm Node process. On Vercel
// serverless, two concurrent invocations from the same user can land on
// different execution contexts; the old guard let both pass and both stream.
//
// Correctness primitive: `findOneAndUpdate` upsert against a `locks` doc
// keyed on `${scope}:${userId}`. The filter accepts an expired or absent
// doc, so a stale lock is acquirable without waiting for the TTL reaper.
// Concurrent acquirers race on the upsert; the loser surfaces E11000, which
// this helper maps to `null` ("lock held"). The TTL index on `expiresAt`
// (expireAfterSeconds: 0; see scripts/createLockIndexes.js) is the
// crash-recovery primitive — if a function dies mid-stream without calling
// release, the doc disappears once `expiresAt < now`.

import { getCollection } from "@/lib/db.js";

const DEFAULT_TTL_MS = 30_000;
const DEFAULT_SCOPE = "notes-ai";

/**
 * Attempt to acquire a per-user, per-scope AI streaming lock.
 *
 * @param {string} userId
 * @param {string} [scope] - logical lock namespace (e.g. "notes-ai").
 * @param {{ ttlMs?: number }} [opts]
 * @returns {Promise<{_id: string, expiresAt: Date} | null>}
 *   the lock doc on success, `null` if another writer holds an unexpired lock.
 */
export async function acquireUserAILock(
  userId,
  scope = DEFAULT_SCOPE,
  { ttlMs = DEFAULT_TTL_MS } = {},
) {
  if (!userId) throw new Error("acquireUserAILock: userId is required");

  const collection = await getCollection("locks");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  const _id = `${scope}:${userId}`;

  try {
    // mongodb v6 (pinned exact in package.json) resolves findOneAndUpdate to
    // the doc directly, or null if the filter matched nothing. If a future
    // driver upgrade changes the contract, the integration tests fail loud.
    return await collection.findOneAndUpdate(
      {
        _id,
        $or: [
          { expiresAt: { $lte: now } },
          { expiresAt: { $exists: false } },
        ],
      },
      { $set: { expiresAt }, $setOnInsert: { _id } },
      { upsert: true, returnDocument: "after" },
    );
  } catch (err) {
    // E11000 means another writer beat us to the upsert. The losing acquirer
    // sees the live (unexpired) doc and is denied the lock — by design.
    if (err && err.code === 11000) return null;
    throw err;
  }
}

/**
 * Release a previously acquired lock. Missing-doc deletes are a no-op so
 * stream-lifecycle callers can safely double-release across onFinish /
 * onError / onAbort.
 */
export async function releaseUserAILock(userId, scope = DEFAULT_SCOPE) {
  if (!userId) return;
  const collection = await getCollection("locks");
  await collection.deleteOne({ _id: `${scope}:${userId}` });
}
