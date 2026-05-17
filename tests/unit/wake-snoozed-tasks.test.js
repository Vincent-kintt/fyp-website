/**
 * Tests for lib/reminders/wakeSnoozedTasks.js — pure helper that bulk-wakes
 * snoozed reminders whose `snoozedUntil` cutoff has passed. The merge order is
 * load-bearing: the base predicate (`status: 'snoozed'`, `snoozedUntil: { $lte: now }`)
 * must win over any caller-supplied filter, so a caller cannot accidentally wake
 * pending tasks or tasks that are not yet due.
 */

import { describe, it, expect, vi } from "vitest";

import { wakeSnoozedTasks } from "@/lib/reminders/wakeSnoozedTasks.js";

function makeCollection(modifiedCount = 0) {
  return {
    updateMany: vi.fn().mockResolvedValue({ modifiedCount }),
  };
}

describe("wakeSnoozedTasks", () => {
  it("returns { reactivated, timestamp } on the happy path", async () => {
    const collection = makeCollection(3);
    const now = new Date("2026-05-17T10:00:00.000Z");

    const result = await wakeSnoozedTasks({ collection, now });

    expect(result).toEqual({
      reactivated: 3,
      timestamp: "2026-05-17T10:00:00.000Z",
    });
  });

  it("merged filter contains base predicate regardless of empty caller filter", async () => {
    const collection = makeCollection(0);
    const now = new Date("2026-05-17T10:00:00.000Z");

    await wakeSnoozedTasks({ collection, now });

    const [filter, update] = collection.updateMany.mock.calls[0];
    expect(filter).toEqual({
      status: "snoozed",
      snoozedUntil: { $lte: now },
    });
    expect(update).toEqual({
      $set: {
        status: "pending",
        completed: false,
        snoozedUntil: null,
        updatedAt: now,
      },
    });
  });

  it("base predicate overwrites caller filter — status: 'pending' is ignored", async () => {
    const collection = makeCollection(0);
    const now = new Date("2026-05-17T10:00:00.000Z");

    await wakeSnoozedTasks({
      collection,
      filter: { status: "pending", snoozedUntil: { $gte: new Date(0) } },
      now,
    });

    const [filter] = collection.updateMany.mock.calls[0];
    expect(filter.status).toBe("snoozed");
    expect(filter.snoozedUntil).toEqual({ $lte: now });
  });

  it("merges caller userId filter with the base predicate", async () => {
    const collection = makeCollection(2);
    const now = new Date("2026-05-17T10:00:00.000Z");

    await wakeSnoozedTasks({
      collection,
      filter: { userId: "user-abc" },
      now,
    });

    const [filter] = collection.updateMany.mock.calls[0];
    expect(filter).toEqual({
      userId: "user-abc",
      status: "snoozed",
      snoozedUntil: { $lte: now },
    });
  });

  it("modifiedCount: 0 is a normal case (no due snoozed tasks)", async () => {
    const collection = makeCollection(0);
    const now = new Date("2026-05-17T10:00:00.000Z");

    const result = await wakeSnoozedTasks({ collection, now });

    expect(result).toEqual({
      reactivated: 0,
      timestamp: "2026-05-17T10:00:00.000Z",
    });
  });

  it("timestamp is ISO string of the provided now", async () => {
    const collection = makeCollection(0);
    const now = new Date("2026-01-02T03:04:05.678Z");

    const result = await wakeSnoozedTasks({ collection, now });

    expect(result.timestamp).toBe("2026-01-02T03:04:05.678Z");
  });

  it("defaults now to current time when omitted", async () => {
    const collection = makeCollection(0);
    const before = Date.now();

    const result = await wakeSnoozedTasks({ collection });

    const after = Date.now();
    const stamp = Date.parse(result.timestamp);
    expect(stamp).toBeGreaterThanOrEqual(before);
    expect(stamp).toBeLessThanOrEqual(after);
  });
});
