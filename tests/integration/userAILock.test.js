/**
 * H11 — MongoDB TTL atomic lock for per-user AI streaming.
 *
 * The previous implementation in lib/ai/notesConcurrency.js used a
 * module-level Set<userId> as a cross-request invariant. That only
 * works inside one warm Node process; on Vercel serverless two
 * concurrent invocations land on different execution contexts, both
 * pass the check, both stream. False security.
 *
 * The replacement (lib/locks/acquireUserAILock.js) uses a Mongo
 * `locks` collection. The filter accepts an expired-or-absent doc and
 * upserts a new `expiresAt`; concurrent writers collide on the upsert
 * via the `_id` primary key and surface 11000, which the helper maps
 * to "lock held". A TTL index on `expiresAt` (expireAfterSeconds: 0)
 * auto-reaps locks left behind by crashed-mid-stream invocations.
 *
 * The test exercises the helper end-to-end against
 * mongodb-memory-server because CLAUDE.md flags "mocking the database
 * in integration tests" as an anti-pattern.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";

vi.mock("@/lib/db.js", () => ({
  getCollection: async (name) => getDb().collection(name),
}));

const {
  acquireUserAILock,
  releaseUserAILock,
} = await import("@/lib/locks/acquireUserAILock.js");
const { createLockIndexes } = await import("@/scripts/createLockIndexes.js");

beforeAll(async () => {
  await startDb("test_user_ai_lock");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
});

describe("acquireUserAILock / releaseUserAILock", () => {
  it("first acquire succeeds, second blocks, release allows re-acquire", async () => {
    const first = await acquireUserAILock("alice", "notes-ai");
    expect(first).toBeTruthy();
    expect(first._id).toBe("notes-ai:alice");

    const second = await acquireUserAILock("alice", "notes-ai");
    expect(second).toBeNull();

    await releaseUserAILock("alice", "notes-ai");

    const third = await acquireUserAILock("alice", "notes-ai");
    expect(third).toBeTruthy();
  });

  it("driver v6 regression: returns the lock doc directly, never a { value } wrapper", async () => {
    // L4 — package.json pins mongodb v6 exact. Earlier drivers wrapped
    // findOneAndUpdate's result in `{ value: doc | null }`. The helper used to
    // defensively unwrap; we dropped that. If a future driver bump changes the
    // contract, this assertion fails loud rather than silently returning a
    // wrapper object that callers would treat as a successful lock.
    const lock = await acquireUserAILock("vivian", "notes-ai");
    expect(lock).toBeTruthy();
    expect(lock._id).toBe("notes-ai:vivian");
    expect(lock).not.toHaveProperty("value");
    expect(lock.expiresAt).toBeInstanceOf(Date);
  });

  it("two different users do not block each other", async () => {
    const aliceLock = await acquireUserAILock("alice", "notes-ai");
    const bobLock = await acquireUserAILock("bob", "notes-ai");
    expect(aliceLock).toBeTruthy();
    expect(bobLock).toBeTruthy();
  });

  it("two different scopes do not block each other", async () => {
    const notesLock = await acquireUserAILock("alice", "notes-ai");
    const remindersLock = await acquireUserAILock("alice", "reminders-ai");
    expect(notesLock).toBeTruthy();
    expect(remindersLock).toBeTruthy();
    expect(notesLock._id).not.toBe(remindersLock._id);
  });

  it("expired lock can be re-acquired by another writer", async () => {
    // ttlMs override is the supported DI seam for tests; production callers
    // omit it and inherit the module default.
    const shortLock = await acquireUserAILock("alice", "notes-ai", {
      ttlMs: 50,
    });
    expect(shortLock).toBeTruthy();

    // Wait past expiry; the filter sees `expiresAt <= now` and accepts the
    // upsert as if the doc were absent.
    await new Promise((r) => setTimeout(r, 100));

    const second = await acquireUserAILock("alice", "notes-ai");
    expect(second).toBeTruthy();
  });

  it("release of a missing lock is a no-op", async () => {
    // Don't throw, don't insert. Mirrors the previous Set.delete semantics.
    await expect(
      releaseUserAILock("ghost", "notes-ai"),
    ).resolves.toBeUndefined();
  });

  it("under 10 concurrent acquires for the same user, exactly one wins", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 10 }, () =>
        acquireUserAILock("alice", "notes-ai"),
      ),
    );
    const winners = attempts.filter((r) => r !== null);
    expect(winners).toHaveLength(1);
    expect(winners[0]._id).toBe("notes-ai:alice");
  });
});

describe("createLockIndexes — TTL bootstrap", () => {
  it("creates a TTL index on locks.expiresAt with expireAfterSeconds: 0", async () => {
    const db = getDb();
    await createLockIndexes(db);

    const indexes = await db.collection("locks").indexes();
    const ttl = indexes.find(
      (idx) =>
        idx.key &&
        idx.key.expiresAt === 1 &&
        idx.expireAfterSeconds === 0,
    );
    expect(ttl).toBeTruthy();
  });

  it("is idempotent — calling twice does not throw", async () => {
    const db = getDb();
    await createLockIndexes(db);
    await expect(createLockIndexes(db)).resolves.toBeTruthy();
  });
});
