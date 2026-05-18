// H3 + H4: AI updateReminder must route through buildReminderDoc("patch"),
// which preserves notificationSent on title-only edits and resets it only on
// dateTime changes.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { startDb, stopDb, clearDb, getDb } from "../../helpers/db.js";

vi.mock("@/lib/db.js", () => ({
  getCollection: async (name) => getDb().collection(name),
}));

const { createTools } = await import("@/lib/ai/tools.js");

const TEST_USER_ID = "user-update-factory";

let tools;

beforeAll(async () => {
  await startDb("test_update_factory");
  tools = createTools(TEST_USER_ID);
});

afterAll(async () => {
  await stopDb();
});

beforeEach(async () => {
  await clearDb();
});

describe("updateReminder factory consistency", () => {
  it("title-only edit preserves notificationSent (H3)", async () => {
    const coll = getDb().collection("reminders");
    const insert = await coll.insertOne({
      title: "Original",
      dateTime: new Date("2026-05-20T09:00:00Z"),
      userId: TEST_USER_ID,
      status: "pending",
      completed: false,
      notificationSent: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await tools.updateReminder.execute({
      reminderId: insert.insertedId.toString(),
      title: "Renamed",
    });

    expect(result.success).toBe(true);
    const stored = await coll.findOne({ _id: insert.insertedId });
    expect(stored.notificationSent).toBe(true);
    expect(stored.title).toBe("Renamed");
  });

  it("dateTime change resets notificationSent (H3)", async () => {
    const coll = getDb().collection("reminders");
    const insert = await coll.insertOne({
      title: "Original",
      dateTime: new Date("2026-05-20T09:00:00Z"),
      userId: TEST_USER_ID,
      status: "pending",
      completed: false,
      notificationSent: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await tools.updateReminder.execute({
      reminderId: insert.insertedId.toString(),
      dateTime: "2026-05-21T10:00:00Z",
    });

    expect(result.success).toBe(true);
    const stored = await coll.findOne({ _id: insert.insertedId });
    expect(stored.notificationSent).toBe(false);
  });

  it("same dateTime value does NOT reset notificationSent (H3)", async () => {
    const SAME = "2026-05-20T09:00:00Z";
    const coll = getDb().collection("reminders");
    const insert = await coll.insertOne({
      title: "Original",
      dateTime: new Date(SAME),
      userId: TEST_USER_ID,
      status: "pending",
      completed: false,
      notificationSent: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await tools.updateReminder.execute({
      reminderId: insert.insertedId.toString(),
      dateTime: SAME,
    });

    expect(result.success).toBe(true);
    const stored = await coll.findOne({ _id: insert.insertedId });
    expect(stored.notificationSent).toBe(true);
  });

  it("invalid status transition returns error (no DB mutation)", async () => {
    const coll = getDb().collection("reminders");
    const insert = await coll.insertOne({
      title: "Completed already",
      dateTime: new Date("2026-05-20T09:00:00Z"),
      userId: TEST_USER_ID,
      status: "completed",
      completed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await tools.updateReminder.execute({
      reminderId: insert.insertedId.toString(),
      status: "snoozed",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid status transition");
  });
});

describe("batchCreate factory consistency", () => {
  it("each batch item gets notificationSent:false stamp", async () => {
    await tools.batchCreate.execute({
      reminders: [
        { title: "B1", dateTime: "2026-06-01T09:00:00Z" },
        { title: "B2", dateTime: "2026-06-02T09:00:00Z" },
        { title: "B3", dateTime: "2026-06-03T09:00:00Z" },
      ],
    });

    const docs = await getDb()
      .collection("reminders")
      .find({ userId: TEST_USER_ID })
      .toArray();
    expect(docs.length).toBe(3);
    for (const d of docs) {
      expect(d.notificationSent).toBe(false);
      expect(d.status).toBe("pending");
      expect(d.completed).toBe(false);
      expect(d.username).toBeDefined();
    }
  });
});
