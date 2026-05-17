/**
 * Tests for lib/notifications/processDueReminders.js — pure helper that drives
 * the cron/notify endpoint. Implements lease + commit semantics so that:
 *
 *   - Reminders are NOT marked notificationSent until at least one push
 *     succeeded for them (commit after success).
 *   - A short-lived lease (notificationLeaseUntil) prevents overlapping cron
 *     invocations from double-processing the same reminder.
 *   - "No subs" is an indefinite-retry case (lease released, NOT counted as a
 *     send failure) — enabling push later will retro-deliver.
 *   - "All subs 410" cleans up stale endpoints without claiming the reminder.
 *   - Transient (500) failures release the lease so the next cron retries.
 *   - PII: logged failures must include only the statusCode, never the raw
 *     error.message (web-push libraries may embed the endpoint).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { processDueReminders } from "@/lib/notifications/processDueReminders.js";

function makeRemindersCollection(initialDue) {
  // Mutable store of reminders keyed by `_id`.
  const store = new Map(initialDue.map((r) => [r._id, { ...r }]));

  const findCursor = {
    limit: vi.fn(),
    toArray: vi.fn(),
  };
  findCursor.limit.mockReturnValue(findCursor);

  const collection = {
    _store: store,
    find: vi.fn(() => findCursor),
    findOneAndUpdate: vi.fn(async (filter, update) => {
      const id = filter._id;
      const doc = store.get(id);
      if (!doc) return null;

      // Replicate the eligibility checks the helper uses to acquire a lease.
      if (filter.notificationSent && filter.notificationSent.$ne === true) {
        if (doc.notificationSent === true) return null;
      }
      if (filter.$or) {
        const leaseOk = filter.$or.some((cond) => {
          if ("notificationLeaseUntil" in cond) {
            const inner = cond.notificationLeaseUntil;
            if (inner && inner.$exists === false) {
              return !("notificationLeaseUntil" in doc);
            }
            if (inner === null) {
              return doc.notificationLeaseUntil === null;
            }
            if (inner && "$lt" in inner) {
              return (
                doc.notificationLeaseUntil instanceof Date &&
                doc.notificationLeaseUntil < inner.$lt
              );
            }
          }
          return false;
        });
        if (!leaseOk) return null;
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

  // The helper calls find().limit(N).toArray(); return the initial due list.
  findCursor.toArray.mockResolvedValue(initialDue.map((r) => ({ ...r })));
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
      // Also strip from byUser groups so subsequent find() doesn't return it.
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

  it("happy path single sub: sent=1, notificationSent flipped, lease released", async () => {
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
    expect(stored.notificationLeaseUntil).toBeNull();
  });

  it("multi-sub all-success: sent=N, marked sent once", async () => {
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
    // Marking 'sent' only happens once via a single updateOne($set notificationSent).
    const commitCalls = reminders.updateOne.mock.calls.filter(
      (c) => c[1]?.$set?.notificationSent === true,
    );
    expect(commitCalls).toHaveLength(1);
  });

  it("no subs: counters.no_subs=1, notificationSent NOT flipped, lease released", async () => {
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
    const subs = makeSubsCollection({}); // no subs for any user
    const sendPush = vi.fn();

    const result = await processDueReminders({
      remindersCollection: reminders,
      subscriptionsCollection: subs,
      sendPush,
      now: NOW,
    });

    expect(result.no_subs).toBe(1);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);

    const stored = reminders._store.get("r1");
    expect(stored.notificationSent).not.toBe(true);
    expect(stored.notifiedAt).toBeUndefined();
    expect(stored.notificationLeaseUntil).toBeNull();

    expect(sendPush).not.toHaveBeenCalled();
  });

  it("all 410: counters.all_gone=1, cleaned=N, notificationSent NOT flipped", async () => {
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
    expect(stored.notificationSent).not.toBe(true);
    expect(stored.notificationLeaseUntil).toBeNull();
    expect(subs.deleteOne).toHaveBeenCalledTimes(2);
  });

  it("partial success: sent=1, cleaned=1, failed=1, partial_success=1, notificationSent flipped", async () => {
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
    const sendPush = vi
      .fn()
      .mockResolvedValueOnce({ success: true, statusCode: 201 })
      .mockResolvedValueOnce({ success: false, statusCode: 410 })
      .mockResolvedValueOnce({ success: false, statusCode: 500 });

    const result = await processDueReminders({
      remindersCollection: reminders,
      subscriptionsCollection: subs,
      sendPush,
      now: NOW,
    });

    expect(result.sent).toBe(1);
    expect(result.cleaned).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.partial_success).toBe(1);

    const stored = reminders._store.get("r1");
    expect(stored.notificationSent).toBe(true);
    expect(stored.notifiedAt).toEqual(NOW);
    expect(stored.notificationLeaseUntil).toBeNull();
  });

  it("all transient: counters.failed=N, sent=0, notificationSent NOT flipped, lease released", async () => {
    const reminders = makeRemindersCollection([
      {
        _id: "r1",
        userId: "u1",
        title: "Transient",
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
      .mockResolvedValue({ success: false, statusCode: 500 });

    const result = await processDueReminders({
      remindersCollection: reminders,
      subscriptionsCollection: subs,
      sendPush,
      now: NOW,
    });

    expect(result.failed).toBe(2);
    expect(result.sent).toBe(0);

    const stored = reminders._store.get("r1");
    expect(stored.notificationSent).not.toBe(true);
    expect(stored.notificationLeaseUntil).toBeNull();
  });

  it("lease acquired blocks concurrent: findOneAndUpdate returns null, reminder skipped", async () => {
    const reminders = makeRemindersCollection([
      {
        _id: "r1",
        userId: "u1",
        title: "Already-leased",
        dateTime: new Date("2026-05-17T23:00:00.000Z"),
        status: "pending",
        notificationSent: false,
        // Lease held by another cron until 1 minute in the future.
        notificationLeaseUntil: new Date(NOW.getTime() + 60_000),
      },
    ]);
    const subs = makeSubsCollection({
      u1: [{ _id: "s1", userId: "u1", endpoint: "ep1", keys: {} }],
    });
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

  it("expired lease re-acquired", async () => {
    const reminders = makeRemindersCollection([
      {
        _id: "r1",
        userId: "u1",
        title: "Stuck",
        dateTime: new Date("2026-05-17T23:00:00.000Z"),
        status: "pending",
        notificationSent: false,
        notificationLeaseUntil: new Date(NOW.getTime() - 60_000),
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
    expect(reminders._store.get("r1").notificationSent).toBe(true);
  });

  it("PII: console.error logs only statusCode, not raw error.message", async () => {
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
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    for (const call of consoleErrorSpy.mock.calls) {
      const joined = call.map((a) => String(a)).join(" ");
      expect(joined).not.toContain(PII);
      expect(joined).not.toContain("secret/token");
    }
  });

  it("limit honored: with limit=2, only 2 reminders processed even if 5 due", async () => {
    const initial = Array.from({ length: 5 }, (_, i) => ({
      _id: `r${i}`,
      userId: "u1",
      title: `T${i}`,
      dateTime: new Date("2026-05-17T23:00:00.000Z"),
      status: "pending",
      notificationSent: false,
    }));
    const reminders = makeRemindersCollection(initial);
    // For this test, override the cursor to only return first 2 (the helper
    // should pass limit:2 to find().limit, and our mock returns whatever
    // toArray says — so we verify the helper calls limit() with 2, then
    // restrict the result to 2 items).
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
