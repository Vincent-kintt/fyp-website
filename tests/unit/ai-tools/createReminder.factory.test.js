// H4: createReminder must build its insert payload via buildReminderDoc.
// This locks the AI write path against drift from the HTTP POST route.
//
// Strategy: drive the AI tool against an in-memory DB, then compare the
// stored doc against buildReminderDoc({mode:"create", ...}) for the same input.
// Volatile timestamps and _id are excluded.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { startDb, stopDb, clearDb, getDb } from "../../helpers/db.js";
import { buildReminderDoc } from "@/lib/reminders/buildReminderDoc.js";

vi.mock("@/lib/db.js", () => ({
  getCollection: async (name) => getDb().collection(name),
}));

const { createTools } = await import("@/lib/ai/tools.js");

const TEST_USER_ID = "user-factory";

let tools;

beforeAll(async () => {
  await startDb("test_create_factory");
  tools = createTools(TEST_USER_ID);
});

afterAll(async () => {
  await stopDb();
});

beforeEach(async () => {
  await clearDb();
});

describe("createReminder factory consistency", () => {
  it("inserts notificationSent:false stamp (factory inherits H3 default)", async () => {
    await tools.createReminder.execute({
      title: "nf",
      dateTime: "2026-05-20T09:00:00Z",
    });
    const doc = await getDb().collection("reminders").findOne({ title: "nf" });
    expect(doc.notificationSent).toBe(false);
  });

  it("inserts username stamp from session-shaped ctx", async () => {
    await tools.createReminder.execute({
      title: "user",
      dateTime: "2026-05-20T09:00:00Z",
    });
    const doc = await getDb().collection("reminders").findOne({ title: "user" });
    expect(doc.username).toBeDefined();
    expect(typeof doc.username).toBe("string");
  });

  it("stored shape matches buildReminderDoc('create') field-for-field", async () => {
    const input = {
      title: "matched",
      description: "desc",
      remark: "remark",
      dateTime: "2026-05-20T09:00:00Z",
      tags: ["work", "urgent"],
      priority: "high",
      duration: 30,
      subtasks: ["a", "b"],
      recurring: false,
    };

    await tools.createReminder.execute(input);
    const stored = await getDb()
      .collection("reminders")
      .findOne({ title: "matched" });

    const expected = buildReminderDoc({
      mode: "create",
      patch: input,
      session: { user: { id: TEST_USER_ID, username: stored.username } },
    });

    // Volatile / db-assigned fields excluded from compare.
    const volatile = new Set(["createdAt", "updatedAt", "_id"]);
    for (const key of Object.keys(expected)) {
      if (volatile.has(key)) continue;
      // subtasks have generated ids — compare by titles only
      if (key === "subtasks") {
        expect(stored.subtasks.map((s) => s.title)).toEqual(
          expected.subtasks.map((s) => s.title),
        );
        continue;
      }
      if (expected[key] instanceof Date) {
        expect(stored[key]?.getTime()).toBe(expected[key].getTime());
      } else {
        expect(stored[key]).toEqual(expected[key]);
      }
    }
  });
});
