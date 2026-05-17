/**
 * Tests for lib/notifications/processDueReminders.js — pure helper that drives
 * the cron/notify endpoint with atomic-claim + in-loop 5xx retry semantics.
 *
 *   - Atomic claim (`findOneAndUpdate` setting `notificationSent: true`) runs
 *     BEFORE any send attempt. This blocks concurrent cron ticks from
 *     double-sending and is final per RFC 8030 — push-service TTL handles
 *     offline-device retry; we never retro-deliver across crons.
 *   - 5xx/429 retry happens WITHIN the same cron tick via in-loop exp backoff
 *     (3 attempts, 500ms / 1s / 2s by default).
 *   - 410/404/400/403 are terminal: short-circuit the retry loop. For 410/404
 *     also delete the stale subscription.
 *   - "No subs" still claims the reminder (no retro delivery) and counts via
 *     `no_subs`.
 *   - PII: logged failures include only sub._id, statusCode, attempts — never
 *     the raw error message or endpoint URL.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { processDueReminders } from "@/lib/notifications/processDueReminders.js";

function makeRemindersCollection(initialDue) {
  const store = new Map(initialDue.map((r) => [r._id, { ...r }]));

  // Default: the find predicate filters out anything already
  // notificationSent:true; replicate that here so calling the helper twice
  // exercises the "second cron skips claimed reminder" path. Each find()
  // call snapshots the store; tests that override toArray do so by replacing
  // the implementation directly.
  const findCursor = {
    limit: vi.fn(),
    toArray: vi.fn(async () =>
      [...store.values()]
        .filter((doc) => doc.notificationSent !== true)
        .map((doc) => ({ ...doc })),
    ),
  };
  findCursor.limit.mockReturnValue(findCursor);

  const collection = {
    _store: store,
    find: vi.fn(() => findCursor),
    findOneAndUpdate: vi.fn(async (filter, update) => {
      const id = filter._id;
      const doc = store.get(id);
      if (!doc) return null;

      if (filter.notificationSent && filter.notificationSent.$ne === true) {
        if (doc.notificationSent === true) return null;
      }
      Object.assign(doc, update.$set);
      return { value: doc };
    }),
    updateOne: vi.fn(async (filter, update) => {
      const id = filter._id;
      const doc = store.get(id);
      if (!doc) return { modifiedCount: 0 };
      Object.assign(doc, update.$set);
      return { modifiedCount: 1 };
    }),
    _findCursor: findCursor,
  };

  return collection;
}

function makeSubsCollection(byUser) {
  const subsById = new Map();
  for (const subs of Object.values(byUser)) {
    for (const s of subs) subsById.set(s._id, s);
  }

  return {
    find: vi.fn((filter) => {
      const list = byUser[filter.userId] ?? [];
      return {
        toArray: vi.fn().mockResolvedValue(list.map((s) => ({ ...s }))),
      };
    }),
    deleteOne: vi.fn(async (filter) => {
      const existed = subsById.delete(filter._id);
      for (const list of Object.values(byUser)) {
        const idx = list.findIndex((s) => s._id === filter._id);
        if (idx !== -1) list.splice(idx, 1);
      }
      return { deletedCount: existed ? 1 : 0 };
    }),
    _byUser: byUser,
  };
}

const NOW = new Date("2026-05-18T00:00:00.000Z");

describe("processDueReminders", () => {
  let consoleErrorSpy;
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("happy path single sub: claim then send, notificationSent=true, no lease fields", async () => {
    const reminders = makeRemindersCollection([
      {
        _id: "r1",
        userId: "u1",
        title: "Do thing",
        dateTime: new Date("2026-05-17T23:00:00.000Z"),
        status: "pending",
        notificationSent: false,
      },
    ]);
    const subs = makeSubsCollection({
      u1: [{ _id: "s1", userId: "u1", endpoint: "ep1", keys: {} }],
    });
    const sendPush = vi.fn().mockResolvedValue({ success: true, statusCode: 201 });

    const result = await processDueReminders({
      remindersCollection: reminders,
      subscriptionsCollection: subs,
      sendPush,
      now: NOW,
    });

    expect(result.processed).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.cleaned).toBe(0);
    expect(result.no_subs).toBe(0);
    expect(result.all_gone).toBe(0);
    expect(result.partial_success).toBe(0);

    const stored = reminders._store.get("r1");
    expect(stored.notificationSent).toBe(true);
    expect(stored.notifiedAt).toEqual(NOW);
    // No lease field set anywhere.
    expect("notificationLeaseUntil" in stored).toBe(false);
  });

  it("multi-sub all-success: sent=N, single claim, no per-sub commit", async () => {
    const reminders = makeRemindersCollection([
      {
        _id: "r1",
        userId: "u1",
        title: "Multi",
        dateTime: new Date("2026-05-17T23:00:00.000Z"),
        status: "pending",
        notificationSent: false,
      },
    ]);
    const subs = makeSubsCollection({
      u1: [
        { _id: "s1", userId: "u1", endpoint: "ep1", keys: {} },
        { _id: "s2", userId: "u1", endpoint: "ep2", keys: {} },
        { _id: "s3", userId: "u1", endpoint: "ep3", keys: {} },
      ],
    });
    const sendPush = vi.fn().mockResolvedValue({ success: true, statusCode: 201 });

    const result = await processDueReminders({
      remindersCollection: reminders,
      subscriptionsCollection: subs,
      sendPush,
      now: NOW,
    });

    expect(result.sent).toBe(3);
    expect(reminders._store.get("r1").notificationSent).toBe(true);
    // notificationSent set exactly once via the atomic claim, not per-sub.
    const claimCalls = reminders.findOneAndUpdate.mock.calls.filter(
      (c) => c[1]?.$set?.notificationSent === true,
    );
    expect(claimCalls).toHaveLength(1);
  });

  it("no subs: claim still flips notificationSent:true, no_subs=1, sendPush never called", async () => {
    const reminders = makeRemindersCollection([
      {
        _id: "r1",
        userId: "u-empty",
        title: "Lone",
        dateTime: new Date("2026-05-17T23:00:00.000Z"),
        status: "pending",
        notificationSent: false,
      },
    ]);
    const subs = makeSubsCollection({});
    const sendPush = vi.fn();

    const result = await processDueReminders({
      remindersCollection: reminders,
      subscriptionsCollection: subs,
      sendPush,
      now: NOW,
    });

    expect(result.no_subs).toBe(1);
    expect(result.processed).toBe(1);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);

    const stored = reminders._store.get("r1");
    expect(stored.notificationSent).toBe(true);
    expect(stored.notifiedAt).toEqual(NOW);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("all 410: claim flips notificationSent:true, cleaned=N, all_gone=1, subs deleted", async () => {
    const reminders = makeRemindersCollection([
      {
        _id: "r1",
        userId: "u1",
        title: "Gone",
        dateTime: new Date("2026-05-17T23:00:00.000Z"),
        status: "pending",
        notificationSent: false,
      },
    ]);
    const subs = makeSubsCollection({
      u1: [
        { _id: "s1", userId: "u1", endpoint: "ep1", keys: {} },
        { _id: "s2", userId: "u1", endpoint: "ep2", keys: {} },
      ],
    });
    const sendPush = vi
      .fn()
      .mockResolvedValueOnce({ success: false, statusCode: 410 })
      .mockResolvedValueOnce({ success: false, statusCode: 404 });

    const result = await processDueReminders({
      remindersCollection: reminders,
      subscriptionsCollection: subs,
      sendPush,
      now: NOW,
    });

    expect(result.all_gone).toBe(1);
    expect(result.cleaned).toBe(2);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);

    const stored = reminders._store.get("r1");
    expect(stored.notificationSent).toBe(true);
    expect(subs.deleteOne).toHaveBeenCalledTimes(2);
  });

  it("partial success: sent=1, cleaned=1, failed=1, partial_success=1, notificationSent:true", async () => {
    const reminders = makeRemindersCollection([
      {
        _id: "r1",
        userId: "u1",
        title: "Mixed",
        dateTime: new Date("2026-05-17T23:00:00.000Z"),
        status: "pending",
        notificationSent: false,
      },
    ]);
    const subs = makeSubsCollection({
      u1: [
        { _id: "s1", userId: "u1", endpoint: "ok", keys: {} },
        { _id: "s2", userId: "u1", endpoint: "gone", keys: {} },
        { _id: "s3", userId: "u1", endpoint: "transient", keys: {} },
      ],
    });
    // ok success first attempt; gone 410 first attempt (terminal); transient
    // 500 thrice (exhausts retries).
    const sendPush = vi
      .fn()
      .mockResolvedValueOnce({ success: true, statusCode: 201 })
      .mockResolvedValueOnce({ success: false, statusCode: 410 })
      .mockResolvedValue({ success: false, statusCode: 500 });

    const result = await processDueReminders({
      remindersCollection: reminders,
      subscriptionsCollection: subs,
      sendPush,
      now: NOW,
      sendRetries: 3,
      backoffMs: 0,
      sleep: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.sent).toBe(1);
    expect(result.cleaned).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.partial_success).toBe(1);

    const stored = reminders._store.get("r1");
    expect(stored.notificationSent).toBe(true);
    expect(stored.notifiedAt).toEqual(NOW);
  });

  it("5xx in-loop retry: 500 -> 500 -> 201 yields sent=1, sendPush called 3x, sleep awaited 2x with backoff", async () => {
    const reminders = makeRemindersCollection([
      {
        _id: "r1",
        userId: "u1",
        title: "Retry",
        dateTime: new Date("2026-05-17T23:00:00.000Z"),
        status: "pending",
        notificationSent: false,
      },
    ]);
    const subs = makeSubsCollection({
      u1: [{ _id: "s1", userId: "u1", endpoint: "ep", keys: {} }],
    });
    const sendPush = vi
      .fn()
      .mockResolvedValueOnce({ success: false, statusCode: 500 })
      .mockResolvedValueOnce({ success: false, statusCode: 500 })
      .mockResolvedValueOnce({ success: true, statusCode: 201 });

    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await processDueReminders({
      remindersCollection: reminders,
      subscriptionsCollection: subs,
      sendPush,
      now: NOW,
      sendRetries: 3,
      backoffMs: 500,
      sleep,
    });

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(sendPush).toHaveBeenCalledTimes(3);
    // backoff schedule: 500 * 2^0 = 500, 500 * 2^1 = 1000 — sleep should be
    // called twice with those args.
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 500);
    expect(sleep).toHaveBeenNthCalledWith(2, 1000);

    expect(reminders._store.get("r1").notificationSent).toBe(true);
  });

  it("5xx exhausted: 3 attempts of 500 -> failed=1, no cross-cron retry (second invocation processed=0)", async () => {
    const reminders = makeRemindersCollection([
      {
        _id: "r1",
        userId: "u1",
        title: "Dies",
        dateTime: new Date("2026-05-17T23:00:00.000Z"),
        status: "pending",
        notificationSent: false,
      },
    ]);
    const subs = makeSubsCollection({
      u1: [{ _id: "s1", userId: "u1", endpoint: "ep", keys: {} }],
    });
    const sendPush = vi
      .fn()
      .mockResolvedValue({ success: false, statusCode: 500 });

    const sleep = vi.fn().mockResolvedValue(undefined);

    const first = await processDueReminders({
      remindersCollection: reminders,
      subscriptionsCollection: subs,
      sendPush,
      now: NOW,
      sendRetries: 3,
      backoffMs: 0,
      sleep,
    });

    expect(first.processed).toBe(1);
    expect(first.failed).toBe(1);
    expect(first.sent).toBe(0);
    expect(sendPush).toHaveBeenCalledTimes(3);

    // notificationSent is final per RFC 8030 / fire-and-forget — reminder
    // won't be picked up by the next cron.
    expect(reminders._store.get("r1").notificationSent).toBe(true);

    sendPush.mockClear();
    const second = await processDueReminders({
      remindersCollection: reminders,
      subscriptionsCollection: subs,
      sendPush,
      now: NOW,
      sendRetries: 3,
      backoffMs: 0,
      sleep,
    });

    expect(second.processed).toBe(0);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("410 short-circuits retry: first attempt 410 -> sendPush called once, sub deleted, cleaned=1", async () => {
    const reminders = makeRemindersCollection([
      {
        _id: "r1",
        userId: "u1",
        title: "Terminal",
        dateTime: new Date("2026-05-17T23:00:00.000Z"),
        status: "pending",
        notificationSent: false,
      },
    ]);
    const subs = makeSubsCollection({
      u1: [{ _id: "s1", userId: "u1", endpoint: "ep-gone", keys: {} }],
    });
    const sendPush = vi
      .fn()
      .mockResolvedValue({ success: false, statusCode: 410 });

    const result = await processDueReminders({
      remindersCollection: reminders,
      subscriptionsCollection: subs,
      sendPush,
      now: NOW,
      sendRetries: 3,
      backoffMs: 0,
      sleep: vi.fn(),
    });

    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(result.cleaned).toBe(1);
    expect(result.all_gone).toBe(1);
    expect(subs.deleteOne).toHaveBeenCalledTimes(1);
  });

  it("400/403 terminal: sendPush called once, failed=1 (no retry)", async () => {
    const reminders = makeRemindersCollection([
      {
        _id: "r1",
        userId: "u1",
        title: "Bad",
        dateTime: new Date("2026-05-17T23:00:00.000Z"),
        status: "pending",
        notificationSent: false,
      },
    ]);
    const subs = makeSubsCollection({
      u1: [{ _id: "s1", userId: "u1", endpoint: "ep", keys: {} }],
    });
    const sendPush = vi
      .fn()
      .mockResolvedValue({ success: false, statusCode: 403 });

    const result = await processDueReminders({
      remindersCollection: reminders,
      subscriptionsCollection: subs,
      sendPush,
      now: NOW,
      sendRetries: 3,
      backoffMs: 0,
      sleep: vi.fn(),
    });

    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(result.failed).toBe(1);
    expect(result.cleaned).toBe(0);
    // sub not deleted on 403/400 — only 410/404 indicate gone.
    expect(subs.deleteOne).not.toHaveBeenCalled();
  });

  it("429 retries with backoff", async () => {
    const reminders = makeRemindersCollection([
      {
        _id: "r1",
        userId: "u1",
        title: "Limited",
        dateTime: new Date("2026-05-17T23:00:00.000Z"),
        status: "pending",
        notificationSent: false,
      },
    ]);
    const subs = makeSubsCollection({
      u1: [{ _id: "s1", userId: "u1", endpoint: "ep", keys: {} }],
    });
    const sendPush = vi
      .fn()
      .mockResolvedValueOnce({ success: false, statusCode: 429 })
      .mockResolvedValueOnce({ success: true, statusCode: 201 });

    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await processDueReminders({
      remindersCollection: reminders,
      subscriptionsCollection: subs,
      sendPush,
      now: NOW,
      sendRetries: 3,
      backoffMs: 500,
      sleep,
    });

    expect(result.sent).toBe(1);
    expect(sendPush).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(500);
  });

  it("atomic claim blocks concurrent: findOneAndUpdate returns null, reminder skipped, no send", async () => {
    // Simulate the concurrent-cron scenario: the find() returned a doc but
    // between find and claim, another cron flipped notificationSent:true.
    const reminders = makeRemindersCollection([
      {
        _id: "r1",
        userId: "u1",
        title: "Raced",
        dateTime: new Date("2026-05-17T23:00:00.000Z"),
        status: "pending",
        notificationSent: false,
      },
    ]);
    const subs = makeSubsCollection({
      u1: [{ _id: "s1", userId: "u1", endpoint: "ep", keys: {} }],
    });
    // Force the cursor to return the doc but mutate the store to look claimed
    // by the time findOneAndUpdate fires.
    reminders._findCursor.toArray.mockResolvedValue([
      { ...reminders._store.get("r1") },
    ]);
    reminders._store.get("r1").notificationSent = true; // claimed by sibling

    const sendPush = vi.fn();

    const result = await processDueReminders({
      remindersCollection: reminders,
      subscriptionsCollection: subs,
      sendPush,
      now: NOW,
    });

    expect(result.processed).toBe(0);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("PII: console.error includes sub._id and statusCode and attempts, not raw error or endpoint", async () => {
    const reminders = makeRemindersCollection([
      {
        _id: "r1",
        userId: "u1",
        title: "Loggy",
        dateTime: new Date("2026-05-17T23:00:00.000Z"),
        status: "pending",
        notificationSent: false,
      },
    ]);
    const subs = makeSubsCollection({
      u1: [{ _id: "s1", userId: "u1", endpoint: "ep-leak", keys: {} }],
    });
    const PII = "WebPushError https://push.example.com/secret/token-AABBCC";
    const sendPush = vi
      .fn()
      .mockResolvedValue({ success: false, statusCode: 500, error: PII });

    await processDueReminders({
      remindersCollection: reminders,
      subscriptionsCollection: subs,
      sendPush,
      now: NOW,
      sendRetries: 3,
      backoffMs: 0,
      sleep: vi.fn(),
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    let sawSubId = false;
    let sawStatus = false;
    let sawAttempts = false;
    for (const call of consoleErrorSpy.mock.calls) {
      const joined = call.map((a) => String(a)).join(" ");
      expect(joined).not.toContain(PII);
      expect(joined).not.toContain("secret/token");
      expect(joined).not.toContain("push.example.com");
      if (joined.includes("s1")) sawSubId = true;
      if (joined.includes("500")) sawStatus = true;
      if (/attempts=\d/.test(joined)) sawAttempts = true;
    }
    expect(sawSubId).toBe(true);
    expect(sawStatus).toBe(true);
    expect(sawAttempts).toBe(true);
  });

  it("limit honored: with limit=2, find().limit(2) is called and only 2 reminders processed", async () => {
    const initial = Array.from({ length: 5 }, (_, i) => ({
      _id: `r${i}`,
      userId: "u1",
      title: `T${i}`,
      dateTime: new Date("2026-05-17T23:00:00.000Z"),
      status: "pending",
      notificationSent: false,
    }));
    const reminders = makeRemindersCollection(initial);
    reminders._findCursor.toArray.mockResolvedValue(initial.slice(0, 2));

    const subs = makeSubsCollection({
      u1: [{ _id: "s1", userId: "u1", endpoint: "ep", keys: {} }],
    });
    const sendPush = vi.fn().mockResolvedValue({ success: true, statusCode: 201 });

    const result = await processDueReminders({
      remindersCollection: reminders,
      subscriptionsCollection: subs,
      sendPush,
      now: NOW,
      limit: 2,
    });

    expect(reminders._findCursor.limit).toHaveBeenCalledWith(2);
    expect(result.processed).toBe(2);
  });
});
