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

// 120s, not the worst-case full-run duration. Callers renew the lease on
// every agent step (see renewUserAILock), so a multi-minute run stays alive
// indefinitely as long as steps keep landing. The TTL therefore only needs to
// exceed the worst-case SINGLE step; it stays the crash-recovery backstop that
// reaps a lock whose owner died mid-stream without releasing.
const DEFAULT_TTL_MS = 120_000;
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
 * Renew (extend) the lease on a held lock — the heartbeat half of a
 * lease+renewal scheme. Callers fire this on every agent step so a run that
 * outlives DEFAULT_TTL_MS doesn't self-expire its own lock mid-stream.
 *
 * Deliberately NOT an upsert: the update matches by `_id` only, so a renew
 * that fires after release (the doc is already deleted) matches zero docs and
 * is a harmless no-op. This is the zombie guard — renewal can never resurrect
 * a lock the owner already let go.
 *
 * Errors propagate; the lib does not swallow them. Callers fire-and-forget and
 * log a renew failure so it surfaces rather than silently dropping the lease.
 *
 * @param {string} userId
 * @param {string} [scope] - logical lock namespace (must match the acquire).
 * @param {{ ttlMs?: number }} [opts]
 * @returns {Promise<void>}
 */
export async function renewUserAILock(
  userId,
  scope = DEFAULT_SCOPE,
  { ttlMs = DEFAULT_TTL_MS } = {},
) {
  if (!userId) return;
  const collection = await getCollection("locks");
  await collection.updateOne(
    { _id: `${scope}:${userId}` },
    { $set: { expiresAt: new Date(Date.now() + ttlMs) } },
  );
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
