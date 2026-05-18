// M7 alignment: AI snoozeReminder must NOT shift dateTime — only set
// snoozedUntil + status. Mirrors HTTP PATCH snooze semantics.
//
// dateTime is what the user wants to be reminded about; snoozedUntil is the
// temporary postponement window. The previous AI behavior of `dateTime + N min`
// silently corrupted the user's intended reminder time.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { ObjectId } from "mongodb";
import { startDb, stopDb, clearDb, getDb } from "../../helpers/db.js";

vi.mock("@/lib/db.js", () => ({
  getCollection: async (name) => getDb().collection(name),
}));

const { createTools } = await import("@/lib/ai/tools.js");

const TEST_USER_ID = "user-m7";

let tools;

beforeAll(async () => {
  await startDb("test_snooze_m7");
  tools = createTools(TEST_USER_ID);
});

afterAll(async () => {
  await stopDb();
});

beforeEach(async () => {
  await clearDb();
});

describe("AI snoozeReminder — M7 alignment", () => {
  it("does NOT modify dateTime when snoozing (M7)", async () => {
    const ORIGINAL = new Date("2026-05-20T09:00:00Z");
    const coll = getDb().collection("reminders");
    const insert = await coll.insertOne({
      title: "Original",
      dateTime: ORIGINAL,
      userId: TEST_USER_ID,
      status: "pending",
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await tools.snoozeReminder.execute({
      reminderId: insert.insertedId.toString(),
      snoozeDuration: 30,
    });

    expect(result.success).toBe(true);

    const stored = await coll.findOne({ _id: insert.insertedId });
    expect(stored.dateTime.toISOString()).toBe(ORIGINAL.toISOString());
  });

  it("sets snoozedUntil to now + N minutes", async () => {
    const coll = getDb().collection("reminders");
    const before = Date.now();
    const insert = await coll.insertOne({
      title: "Snooze",
      dateTime: new Date("2026-05-20T09:00:00Z"),
      userId: TEST_USER_ID,
      status: "pending",
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await tools.snoozeReminder.execute({
      reminderId: insert.insertedId.toString(),
      snoozeDuration: 30,
    });
    const after = Date.now();

    expect(result.success).toBe(true);
    const stored = await coll.findOne({ _id: insert.insertedId });
    const snoozedUntilMs = stored.snoozedUntil.getTime();
    expect(snoozedUntilMs).toBeGreaterThanOrEqual(before + 30 * 60_000);
    expect(snoozedUntilMs).toBeLessThanOrEqual(after + 30 * 60_000);
  });

  it("sets status to 'snoozed'", async () => {
    const coll = getDb().collection("reminders");
    const insert = await coll.insertOne({
      title: "x",
      dateTime: new Date("2026-05-20T09:00:00Z"),
      userId: TEST_USER_ID,
      status: "pending",
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await tools.snoozeReminder.execute({
      reminderId: insert.insertedId.toString(),
      snoozeDuration: 15,
    });

    const stored = await coll.findOne({ _id: insert.insertedId });
    expect(stored.status).toBe("snoozed");
  });

  it("rejects invalid reminder id", async () => {
    const fake = new ObjectId().toString();
    const result = await tools.snoozeReminder.execute({
      reminderId: fake,
      snoozeDuration: 30,
    });
    expect(result.success).toBe(false);
  });
});
