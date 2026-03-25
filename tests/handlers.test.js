/**
 * Integration tests for lib/agents/tools/handlers.js
 * Uses mongodb-memory-server for real DB integration
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";

let mongod;
let client;
let db;

// Mock the db module to use in-memory MongoDB
vi.mock("@/lib/db.js", () => ({
  getCollection: async (name) => db.collection(name),
}));

// Import handlers AFTER mock is set up
const {
  createReminder,
  listReminders,
  updateReminder,
  deleteReminder,
  snoozeReminder,
  batchCreate,
  suggestReminders,
  findConflicts,
  analyzePatterns,
  summarizeUpcoming,
  exportReminders,
  setQuickReminder,
  templateCreate,
  executeTool,
} = await import("@/lib/agents/tools/handlers.js");

const TEST_USER_ID = "user123";
const OTHER_USER_ID = "user456";

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  client = new MongoClient(mongod.getUri());
  await client.connect();
  db = client.db("test_handlers");
});

afterAll(async () => {
  await client.close();
  await mongod.stop();
});

beforeEach(async () => {
  // Clean DB before each test
  await db.collection("reminders").deleteMany({});
});

// ============================================
// createReminder
// ============================================
describe("createReminder", () => {
  it("creates a reminder with required fields", async () => {
    const result = await createReminder(
      {
        title: "Test Reminder",
        dateTime: "2024-06-01T09:00:00Z",
      },
      TEST_USER_ID
    );

    expect(result.success).toBe(true);
    expect(result.reminder.title).toBe("Test Reminder");
    expect(result.reminder.userId).toBe(TEST_USER_ID);
    expect(result.reminder.status).toBe("pending");
    expect(result.reminder.completed).toBe(false);
  });

  it("stores completed field in MongoDB document", async () => {
    const result = await createReminder(
      { title: "Check completed", dateTime: "2024-06-01T09:00:00Z" },
      TEST_USER_ID
    );

    // Verify the document in DB has completed field
    const doc = await db.collection("reminders").findOne({ _id: result.reminder._id });
    expect(doc).not.toBeNull();
    expect(doc.completed).toBe(false);
    expect(doc.status).toBe("pending");
  });

  it("processes tags correctly", async () => {
    const result = await createReminder(
      {
        title: "Tagged",
        dateTime: "2024-06-01T09:00:00Z",
        tags: ["#Work", "URGENT", "a", "  personal  "],
      },
      TEST_USER_ID
    );

    expect(result.reminder.tags).toEqual(["work", "urgent", "personal"]);
    // "a" should be filtered (< 2 chars)
  });

  it("rejects invalid duration", async () => {
    const result = await createReminder(
      {
        title: "Bad duration",
        dateTime: "2024-06-01T09:00:00Z",
        duration: -5,
      },
      TEST_USER_ID
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("negative");
  });

  it("handles subtasks as strings and objects", async () => {
    const result = await createReminder(
      {
        title: "With subtasks",
        dateTime: "2024-06-01T09:00:00Z",
        subtasks: ["Buy groceries", { title: "Cook dinner", completed: true }],
      },
      TEST_USER_ID
    );

    expect(result.reminder.subtasks).toHaveLength(2);
    expect(result.reminder.subtasks[0].title).toBe("Buy groceries");
    expect(result.reminder.subtasks[0].completed).toBe(false);
    expect(result.reminder.subtasks[1].title).toBe("Cook dinner");
    expect(result.reminder.subtasks[1].completed).toBe(true);
  });

  it("sets default values correctly", async () => {
    const result = await createReminder(
      { title: "Defaults", dateTime: "2024-06-01T09:00:00Z" },
      TEST_USER_ID
    );

    const r = result.reminder;
    expect(r.description).toBe("");
    expect(r.remark).toBe("");
    expect(r.duration).toBeNull();
    expect(r.priority).toBe("medium");
    expect(r.recurring).toBe(false);
    expect(r.recurringType).toBeNull();
    expect(r.subtasks).toEqual([]);
  });
});

// ============================================
// listReminders
// ============================================
describe("listReminders", () => {
  beforeEach(async () => {
    // Seed reminders
    const coll = db.collection("reminders");
    const now = new Date();
    await coll.insertMany([
      {
        title: "Today task",
        dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0),
        userId: TEST_USER_ID,
        category: "work",
        tags: ["work"],
        status: "pending",
        completed: false,
        createdAt: now,
      },
      {
        title: "Next week task",
        dateTime: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
        userId: TEST_USER_ID,
        category: "personal",
        tags: ["personal"],
        status: "in_progress",
        completed: false,
        createdAt: now,
      },
      {
        title: "Other user task",
        dateTime: now,
        userId: OTHER_USER_ID,
        category: "work",
        tags: ["work"],
        status: "pending",
        completed: false,
        createdAt: now,
      },
      {
        title: "Completed task",
        dateTime: now,
        userId: TEST_USER_ID,
        category: "work",
        tags: ["work"],
        status: "completed",
        completed: true,
        createdAt: now,
      },
    ]);
  });

  it("returns only user's reminders with filter=all", async () => {
    const result = await listReminders({ filter: "all" }, TEST_USER_ID);
    expect(result.success).toBe(true);
    // Should not include other user's task
    expect(result.reminders.every((r) => r.userId === TEST_USER_ID)).toBe(true);
    expect(result.count).toBe(3);
  });

  it("filters by category", async () => {
    const result = await listReminders({ category: "work" }, TEST_USER_ID);
    expect(result.reminders.every((r) => r.category === "work" || r.tags.includes("work"))).toBe(true);
  });

  it("filters by tag", async () => {
    const result = await listReminders({ tag: "personal" }, TEST_USER_ID);
    expect(result.reminders.length).toBe(1);
    expect(result.reminders[0].title).toBe("Next week task");
  });

  it("filters by status", async () => {
    const result = await listReminders({ status: "completed" }, TEST_USER_ID);
    expect(result.reminders.length).toBe(1);
    expect(result.reminders[0].title).toBe("Completed task");
  });

  it("limits to 50 results", async () => {
    // Insert 60 reminders
    const coll = db.collection("reminders");
    await coll.deleteMany({});
    const docs = Array.from({ length: 60 }, (_, i) => ({
      title: `Task ${i}`,
      dateTime: new Date(),
      userId: TEST_USER_ID,
      status: "pending",
      completed: false,
      createdAt: new Date(),
    }));
    await coll.insertMany(docs);

    const result = await listReminders({ filter: "all" }, TEST_USER_ID);
    expect(result.count).toBe(50);
  });

  it("user isolation: cannot see other user's reminders", async () => {
    const result = await listReminders({ filter: "all" }, OTHER_USER_ID);
    expect(result.count).toBe(1);
    expect(result.reminders[0].title).toBe("Other user task");
  });
});

// ============================================
// updateReminder
// ============================================
describe("updateReminder", () => {
  let reminderId;

  beforeEach(async () => {
    const result = await createReminder(
      {
        title: "Original",
        dateTime: "2024-06-01T09:00:00Z",
        tags: ["work"],
      },
      TEST_USER_ID
    );
    reminderId = result.reminder._id.toString();
  });

  it("updates title", async () => {
    const result = await updateReminder(
      { reminderId, title: "Updated Title" },
      TEST_USER_ID
    );
    expect(result.success).toBe(true);
    expect(result.reminder.title).toBe("Updated Title");
  });

  it("validates status transitions", async () => {
    // pending -> completed (valid)
    let result = await updateReminder(
      { reminderId, status: "completed" },
      TEST_USER_ID
    );
    expect(result.success).toBe(true);
    expect(result.reminder.status).toBe("completed");
    expect(result.reminder.completed).toBe(true);

    // completed -> snoozed (INVALID per STATUS_TRANSITIONS)
    result = await updateReminder(
      { reminderId, status: "snoozed" },
      TEST_USER_ID
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid status transition");
  });

  it("tracks startedAt timestamp", async () => {
    const result = await updateReminder(
      { reminderId, status: "in_progress" },
      TEST_USER_ID
    );
    expect(result.reminder.startedAt).toBeDefined();
  });

  it("tracks completedAt timestamp", async () => {
    const result = await updateReminder(
      { reminderId, status: "completed" },
      TEST_USER_ID
    );
    expect(result.reminder.completedAt).toBeDefined();
  });

  it("returns 404 for non-existent reminder", async () => {
    const fakeId = new ObjectId().toString();
    const result = await updateReminder(
      { reminderId: fakeId, title: "Ghost" },
      TEST_USER_ID
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("user isolation: cannot update other user's reminder", async () => {
    const result = await updateReminder(
      { reminderId, title: "Hacked" },
      OTHER_USER_ID
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("validates duration on update", async () => {
    const result = await updateReminder(
      { reminderId, duration: 2000 },
      TEST_USER_ID
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("24 hours");
  });

  it("rejects invalid status value", async () => {
    const result = await updateReminder(
      { reminderId, status: "bogus" },
      TEST_USER_ID
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid status");
  });
});

// ============================================
// deleteReminder
// ============================================
describe("deleteReminder", () => {
  it("deletes an existing reminder", async () => {
    const created = await createReminder(
      { title: "To Delete", dateTime: "2024-06-01T09:00:00Z" },
      TEST_USER_ID
    );
    const reminderId = created.reminder._id.toString();

    const result = await deleteReminder({ reminderId }, TEST_USER_ID);
    expect(result.success).toBe(true);

    // Verify it's gone
    const doc = await db.collection("reminders").findOne({ _id: new ObjectId(reminderId) });
    expect(doc).toBeNull();
  });

  it("user isolation: cannot delete other user's reminder", async () => {
    const created = await createReminder(
      { title: "Protected", dateTime: "2024-06-01T09:00:00Z" },
      TEST_USER_ID
    );
    const reminderId = created.reminder._id.toString();

    // Other user tries to delete
    await deleteReminder({ reminderId }, OTHER_USER_ID);

    // Should still exist
    const doc = await db.collection("reminders").findOne({ _id: new ObjectId(reminderId) });
    expect(doc).not.toBeNull();
  });

  it("reports failure for non-existent reminder", async () => {
    const fakeId = new ObjectId().toString();
    const result = await deleteReminder({ reminderId: fakeId }, TEST_USER_ID);
    // BUG: currently always returns success. After fix, should report failure.
    // This test documents the expected behavior after fix.
    expect(result.success).toBe(false);
  });
});

// ============================================
// snoozeReminder
// ============================================
describe("snoozeReminder", () => {
  it("snoozes a pending reminder", async () => {
    const created = await createReminder(
      {
        title: "Snoozable",
        dateTime: new Date(Date.now() + 60000).toISOString(),
      },
      TEST_USER_ID
    );
    const reminderId = created.reminder._id.toString();

    const result = await snoozeReminder(
      { reminderId, snoozeDuration: 30 },
      TEST_USER_ID
    );

    expect(result.success).toBe(true);
    expect(result.reminder.status).toBe("snoozed");
    expect(result.snoozedMinutes).toBe(30);
    expect(result.snoozedUntil).toBeDefined();
  });

  it("sets completed=false when snoozing (backward compat)", async () => {
    const created = await createReminder(
      {
        title: "Snooze compat",
        dateTime: new Date(Date.now() + 60000).toISOString(),
      },
      TEST_USER_ID
    );
    const reminderId = created.reminder._id.toString();

    const result = await snoozeReminder(
      { reminderId, snoozeDuration: 15 },
      TEST_USER_ID
    );

    expect(result.reminder.completed).toBe(false);
  });

  it("validates status transition before snoozing", async () => {
    // Create and complete a reminder
    const created = await createReminder(
      { title: "Completed", dateTime: "2024-06-01T09:00:00Z" },
      TEST_USER_ID
    );
    const reminderId = created.reminder._id.toString();
    await updateReminder({ reminderId, status: "completed" }, TEST_USER_ID);

    // Snoozing a completed reminder should be invalid
    const result = await snoozeReminder(
      { reminderId, snoozeDuration: 30 },
      TEST_USER_ID
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Cannot snooze");
  });

  it("returns error for non-existent reminder", async () => {
    const fakeId = new ObjectId().toString();
    const result = await snoozeReminder(
      { reminderId: fakeId, snoozeDuration: 30 },
      TEST_USER_ID
    );
    expect(result.success).toBe(false);
  });

  it("supports legacy 'duration' parameter", async () => {
    const created = await createReminder(
      {
        title: "Legacy param",
        dateTime: new Date(Date.now() + 60000).toISOString(),
      },
      TEST_USER_ID
    );
    const reminderId = created.reminder._id.toString();

    const result = await snoozeReminder(
      { reminderId, duration: 60 },
      TEST_USER_ID
    );

    expect(result.success).toBe(true);
    expect(result.snoozedMinutes).toBe(60);
  });
});

// ============================================
// batchCreate
// ============================================
describe("batchCreate", () => {
  it("creates multiple reminders", async () => {
    const result = await batchCreate(
      {
        reminders: [
          { title: "Batch 1", dateTime: "2024-06-01T09:00:00Z" },
          { title: "Batch 2", dateTime: "2024-06-02T09:00:00Z" },
        ],
      },
      TEST_USER_ID
    );

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);

    const docs = await db.collection("reminders").find({ userId: TEST_USER_ID }).toArray();
    expect(docs.length).toBe(2);
  });

  it("enforces size limit", async () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => ({
      title: `Overflow ${i}`,
      dateTime: "2024-06-01T09:00:00Z",
    }));

    const result = await batchCreate({ reminders: tooMany }, TEST_USER_ID);
    // After fix, should reject batches > 50
    expect(result.success).toBe(false);
    expect(result.error).toContain("50");
  });

  it("sets correct default fields on batch items", async () => {
    const result = await batchCreate(
      {
        reminders: [{ title: "Defaults", dateTime: "2024-06-01T09:00:00Z" }],
      },
      TEST_USER_ID
    );

    const doc = await db.collection("reminders").findOne({ title: "Defaults" });
    expect(doc.status).toBe("pending");
    expect(doc.completed).toBe(false);
    expect(doc.userId).toBe(TEST_USER_ID);
    expect(doc.priority).toBe("medium");
  });
});

// ============================================
// findConflicts
// ============================================
describe("findConflicts", () => {
  it("detects overlapping reminders", async () => {
    const time = new Date("2024-06-01T10:00:00Z");
    await createReminder(
      { title: "Existing", dateTime: time.toISOString(), duration: 60 },
      TEST_USER_ID
    );

    const conflictTime = new Date("2024-06-01T10:30:00Z");
    const result = await findConflicts(
      { dateTime: conflictTime.toISOString(), duration: 60 },
      TEST_USER_ID
    );

    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it("no conflicts when times don't overlap", async () => {
    const time = new Date("2024-06-01T10:00:00Z");
    await createReminder(
      { title: "Morning", dateTime: time.toISOString(), duration: 60 },
      TEST_USER_ID
    );

    const noConflict = new Date("2024-06-01T14:00:00Z");
    const result = await findConflicts(
      { dateTime: noConflict.toISOString(), duration: 60 },
      TEST_USER_ID
    );

    expect(result.hasConflicts).toBe(false);
  });
});

// ============================================
// executeTool
// ============================================
describe("executeTool", () => {
  it("dispatches to correct handler", async () => {
    const result = await executeTool(
      "createReminder",
      { title: "Via executeTool", dateTime: "2024-06-01T09:00:00Z" },
      TEST_USER_ID
    );
    expect(result.success).toBe(true);
  });

  it("returns error for unknown tool", async () => {
    const result = await executeTool("unknownTool", {}, TEST_USER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("catches handler errors gracefully", async () => {
    // Pass invalid ObjectId to trigger error
    const result = await executeTool(
      "updateReminder",
      { reminderId: "not-an-objectid", title: "Bad" },
      TEST_USER_ID
    );
    expect(result.success).toBe(false);
  });
});

// ============================================
// analyzePatterns
// ============================================
describe("analyzePatterns", () => {
  it("returns frequency analysis", async () => {
    await createReminder(
      { title: "P1", dateTime: "2024-06-01T09:00:00Z" },
      TEST_USER_ID
    );

    const result = await analyzePatterns(
      { analysisType: "frequency", period: "all" },
      TEST_USER_ID
    );

    expect(result.success).toBe(true);
    expect(result.analysis.totalReminders).toBeGreaterThanOrEqual(1);
  });
});

// ============================================
// templateCreate
// ============================================
describe("templateCreate", () => {
  it("creates from known template", async () => {
    const result = await templateCreate(
      { templateName: "daily-review" },
      TEST_USER_ID
    );
    expect(result.success).toBe(true);
    expect(result.reminder.title).toBe("Daily Review");
  });

  it("rejects unknown template", async () => {
    const result = await templateCreate(
      { templateName: "nonexistent" },
      TEST_USER_ID
    );
    expect(result.success).toBe(false);
  });
});

// ============================================
// setQuickReminder
// ============================================
describe("setQuickReminder", () => {
  it("creates reminder with future dateTime", async () => {
    const before = Date.now();
    const result = await setQuickReminder(
      { title: "Quick", minutesFromNow: 30 },
      TEST_USER_ID
    );

    expect(result.success).toBe(true);
    const reminderTime = new Date(result.reminder.dateTime).getTime();
    // Should be ~30 min from now (allow 5s tolerance)
    expect(reminderTime).toBeGreaterThan(before + 29 * 60 * 1000);
    expect(reminderTime).toBeLessThan(before + 31 * 60 * 1000);
  });
});
