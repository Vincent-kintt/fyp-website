/**
 * Integration tests for lib/ai/tools.js
 * Uses mongodb-memory-server for real DB integration
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
import { ObjectId } from "mongodb";
import { startDb, stopDb, clearDb, getDb } from "./helpers/db.js";

// Mock the db module to use in-memory MongoDB
vi.mock("@/lib/db.js", () => ({
  getCollection: async (name) => getDb().collection(name),
}));

// Import AFTER mock is set up
const { createTools } = await import("@/lib/ai/tools.js");

const TEST_USER_ID = "user123";
const OTHER_USER_ID = "user456";

let tools;

beforeAll(async () => {
  await startDb("test_ai_tools");
  tools = createTools(TEST_USER_ID);
});

afterAll(async () => {
  await stopDb();
});

beforeEach(async () => {
  await clearDb();
});

// ============================================
// createReminder
// ============================================
describe("createReminder", () => {
  it("creates a reminder with required fields", async () => {
    const result = await tools.createReminder.execute({
      title: "Test Reminder",
      dateTime: "2024-06-01T09:00:00Z",
    });

    expect(result.success).toBe(true);
    expect(result.reminder.title).toBe("Test Reminder");
    expect(result.reminder.userId).toBe(TEST_USER_ID);
    expect(result.reminder.status).toBe("pending");
    expect(result.reminder.completed).toBe(false);
  });

  it("stores completed field in MongoDB document", async () => {
    const result = await tools.createReminder.execute({
      title: "Check completed",
      dateTime: "2024-06-01T09:00:00Z",
    });

    const doc = await getDb()
      .collection("reminders")
      .findOne({ _id: result.reminder._id });
    expect(doc).not.toBeNull();
    expect(doc.completed).toBe(false);
    expect(doc.status).toBe("pending");
  });

  it("processes tags correctly", async () => {
    const result = await tools.createReminder.execute({
      title: "Tagged",
      dateTime: "2024-06-01T09:00:00Z",
      tags: ["#Work", "URGENT", "a", "  personal  "],
    });

    // "a" should be filtered (< 2 chars), others normalized to lowercase
    expect(result.reminder.tags).toEqual(["work", "urgent", "personal"]);
  });

  it("handles subtasks as strings", async () => {
    const result = await tools.createReminder.execute({
      title: "With subtasks",
      dateTime: "2024-06-01T09:00:00Z",
      subtasks: ["Buy groceries", "Cook dinner"],
    });

    expect(result.reminder.subtasks).toHaveLength(2);
    expect(result.reminder.subtasks[0].title).toBe("Buy groceries");
    expect(result.reminder.subtasks[0].completed).toBe(false);
    expect(result.reminder.subtasks[1].title).toBe("Cook dinner");
    expect(result.reminder.subtasks[1].completed).toBe(false);
  });

  it("sets default values correctly", async () => {
    const result = await tools.createReminder.execute({
      title: "Defaults",
      dateTime: "2024-06-01T09:00:00Z",
    });

    const r = result.reminder;
    expect(r.description).toBe("");
    expect(r.remark).toBe("");
    expect(r.duration).toBeNull();
    expect(r.priority).toBe("medium");
    expect(r.recurring).toBe(false);
    expect(r.recurringType).toBeNull();
    expect(r.subtasks).toEqual([]);
  });

  it("rejects invalid duration", async () => {
    const result = await tools.createReminder.execute({
      title: "Bad duration",
      dateTime: "2024-06-01T09:00:00Z",
      duration: -5,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("negative");
  });
});

// ============================================
// listReminders
// ============================================
describe("listReminders", () => {
  beforeEach(async () => {
    const coll = getDb().collection("reminders");
    const now = new Date();
    await coll.insertMany([
      {
        title: "Today task",
        dateTime: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          14,
          0,
        ),
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
    const result = await tools.listReminders.execute({ filter: "all" });
    expect(result.success).toBe(true);
    expect(result.reminders.every((r) => r.userId === TEST_USER_ID)).toBe(true);
    expect(result.count).toBe(3);
  });

  it("filters by tag", async () => {
    const result = await tools.listReminders.execute({
      filter: "all",
      tag: "personal",
    });
    expect(result.reminders.length).toBe(1);
    expect(result.reminders[0].title).toBe("Next week task");
  });

  it("filters by status", async () => {
    const result = await tools.listReminders.execute({
      filter: "all",
      status: "completed",
    });
    expect(result.reminders.length).toBe(1);
    expect(result.reminders[0].title).toBe("Completed task");
  });

  it("limits to 50 results", async () => {
    await getDb().collection("reminders").deleteMany({});
    const docs = Array.from({ length: 60 }, (_, i) => ({
      title: `Task ${i}`,
      dateTime: new Date(),
      userId: TEST_USER_ID,
      status: "pending",
      completed: false,
      createdAt: new Date(),
    }));
    await getDb().collection("reminders").insertMany(docs);

    const result = await tools.listReminders.execute({ filter: "all" });
    expect(result.count).toBe(50);
  });

  it("user isolation: cannot see other user's reminders", async () => {
    // Create a separate tools instance for the other user
    const otherTools = createTools(OTHER_USER_ID);
    const result = await otherTools.listReminders.execute({ filter: "all" });
    expect(result.count).toBe(1);
    expect(result.reminders[0].title).toBe("Other user task");
  });

  it("filter=today includes tasks from start of day (00:00)", async () => {
    await getDb().collection("reminders").deleteMany({});
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const beforeToday = new Date(startOfToday.getTime() - 1);
    await getDb()
      .collection("reminders")
      .insertMany([
        {
          title: "Midnight task",
          dateTime: startOfToday,
          userId: TEST_USER_ID,
          status: "pending",
          completed: false,
          createdAt: now,
        },
        {
          title: "Yesterday late",
          dateTime: beforeToday,
          userId: TEST_USER_ID,
          status: "pending",
          completed: false,
          createdAt: now,
        },
      ]);

    const result = await tools.listReminders.execute({ filter: "today" });
    expect(result.reminders.map((r) => r.title)).toContain("Midnight task");
    expect(result.reminders.map((r) => r.title)).not.toContain("Yesterday late");
  });
});

// ============================================
// updateReminder
// ============================================
describe("updateReminder", () => {
  let reminderId;

  beforeEach(async () => {
    const result = await tools.createReminder.execute({
      title: "Original",
      dateTime: "2024-06-01T09:00:00Z",
      tags: ["work"],
    });
    reminderId = result.reminder._id.toString();
  });

  it("updates title", async () => {
    const result = await tools.updateReminder.execute({
      reminderId,
      title: "Updated Title",
    });
    expect(result.success).toBe(true);
    expect(result.reminder.title).toBe("Updated Title");
  });

  it("validates status transitions — pending to completed is valid", async () => {
    const result = await tools.updateReminder.execute({
      reminderId,
      status: "completed",
    });
    expect(result.success).toBe(true);
    expect(result.reminder.status).toBe("completed");
    expect(result.reminder.completed).toBe(true);
  });

  it("validates status transitions — completed to snoozed is invalid", async () => {
    await tools.updateReminder.execute({ reminderId, status: "completed" });
    const result = await tools.updateReminder.execute({
      reminderId,
      status: "snoozed",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid status transition");
  });

  it("tracks startedAt timestamp when transitioning to in_progress", async () => {
    const result = await tools.updateReminder.execute({
      reminderId,
      status: "in_progress",
    });
    expect(result.reminder.startedAt).toBeDefined();
  });

  it("tracks completedAt timestamp when transitioning to completed", async () => {
    const result = await tools.updateReminder.execute({
      reminderId,
      status: "completed",
    });
    expect(result.reminder.completedAt).toBeDefined();
  });

  it("returns not found for non-existent reminder", async () => {
    const fakeId = new ObjectId().toString();
    const result = await tools.updateReminder.execute({
      reminderId: fakeId,
      title: "Ghost",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("user isolation: cannot update other user's reminder", async () => {
    const otherTools = createTools(OTHER_USER_ID);
    const result = await otherTools.updateReminder.execute({
      reminderId,
      title: "Hacked",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("validates duration on update", async () => {
    const result = await tools.updateReminder.execute({
      reminderId,
      duration: 2000,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("24 hours");
  });
});

// ============================================
// deleteReminder
// ============================================
describe("deleteReminder", () => {
  it("deletes an existing reminder", async () => {
    const created = await tools.createReminder.execute({
      title: "To Delete",
      dateTime: "2024-06-01T09:00:00Z",
    });
    const reminderId = created.reminder._id.toString();

    const result = await tools.deleteReminder.execute({ reminderId });
    expect(result.success).toBe(true);

    const doc = await getDb()
      .collection("reminders")
      .findOne({ _id: new ObjectId(reminderId) });
    expect(doc).toBeNull();
  });

  it("user isolation: cannot delete other user's reminder", async () => {
    const created = await tools.createReminder.execute({
      title: "Protected",
      dateTime: "2024-06-01T09:00:00Z",
    });
    const reminderId = created.reminder._id.toString();

    const otherTools = createTools(OTHER_USER_ID);
    const result = await otherTools.deleteReminder.execute({ reminderId });
    expect(result.success).toBe(false);

    // Should still exist
    const doc = await getDb()
      .collection("reminders")
      .findOne({ _id: new ObjectId(reminderId) });
    expect(doc).not.toBeNull();
  });

  it("reports failure for non-existent reminder", async () => {
    const fakeId = new ObjectId().toString();
    const result = await tools.deleteReminder.execute({ reminderId: fakeId });
    expect(result.success).toBe(false);
  });
});

// ============================================
// snoozeReminder
// ============================================
describe("snoozeReminder", () => {
  it("snoozes a pending reminder", async () => {
    const created = await tools.createReminder.execute({
      title: "Snoozable",
      dateTime: new Date(Date.now() + 60000).toISOString(),
    });
    const reminderId = created.reminder._id.toString();

    const result = await tools.snoozeReminder.execute({
      reminderId,
      snoozeDuration: 30,
    });

    expect(result.success).toBe(true);
    expect(result.reminder.status).toBe("snoozed");
    expect(result.snoozedMinutes).toBe(30);
    expect(result.snoozedUntil).toBeDefined();
  });

  it("sets completed=false when snoozing", async () => {
    const created = await tools.createReminder.execute({
      title: "Snooze compat",
      dateTime: new Date(Date.now() + 60000).toISOString(),
    });
    const reminderId = created.reminder._id.toString();

    const result = await tools.snoozeReminder.execute({
      reminderId,
      snoozeDuration: 15,
    });
    expect(result.reminder.completed).toBe(false);
  });

  it("validates status transition — cannot snooze a completed reminder", async () => {
    const created = await tools.createReminder.execute({
      title: "Completed",
      dateTime: "2024-06-01T09:00:00Z",
    });
    const reminderId = created.reminder._id.toString();
    await tools.updateReminder.execute({ reminderId, status: "completed" });

    const result = await tools.snoozeReminder.execute({
      reminderId,
      snoozeDuration: 30,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Cannot snooze");
  });

  it("returns error for non-existent reminder", async () => {
    const fakeId = new ObjectId().toString();
    const result = await tools.snoozeReminder.execute({
      reminderId: fakeId,
      snoozeDuration: 30,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================
// batchCreate
// ============================================
describe("batchCreate", () => {
  it("creates multiple reminders", async () => {
    const result = await tools.batchCreate.execute({
      reminders: [
        { title: "Batch 1", dateTime: "2024-06-01T09:00:00Z" },
        { title: "Batch 2", dateTime: "2024-06-02T09:00:00Z" },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);

    const docs = await getDb()
      .collection("reminders")
      .find({ userId: TEST_USER_ID })
      .toArray();
    expect(docs.length).toBe(2);
  });

  it("rejects more than 50 reminders", async () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => ({
      title: `Overflow ${i}`,
      dateTime: "2024-06-01T09:00:00Z",
    }));

    const result = await tools.batchCreate.execute({ reminders: tooMany });
    expect(result.success).toBe(false);
    expect(result.error).toContain("50");
  });

  it("sets correct default fields on batch items", async () => {
    await tools.batchCreate.execute({
      reminders: [{ title: "Defaults", dateTime: "2024-06-01T09:00:00Z" }],
    });

    const doc = await getDb().collection("reminders").findOne({ title: "Defaults" });
    expect(doc.status).toBe("pending");
    expect(doc.completed).toBe(false);
    expect(doc.userId).toBe(TEST_USER_ID);
    expect(doc.priority).toBe("medium");
  });

  it("rejects empty reminders array", async () => {
    const result = await tools.batchCreate.execute({ reminders: [] });
    expect(result.success).toBe(false);
  });
});

// ============================================
// suggestReminders
// ============================================
describe("suggestReminders", () => {
  it("returns patterns from past reminders", async () => {
    const coll = getDb().collection("reminders");
    const now = new Date();
    await coll.insertMany([
      {
        title: "Morning work",
        dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0),
        userId: TEST_USER_ID,
        category: "work",
        tags: ["work"],
        status: "completed",
        completed: true,
        recurring: false,
        createdAt: now,
      },
      {
        title: "Evening exercise",
        dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0),
        userId: TEST_USER_ID,
        category: "health",
        tags: ["health"],
        status: "pending",
        completed: false,
        recurring: true,
        recurringType: "daily",
        createdAt: now,
      },
    ]);

    const result = await tools.suggestReminders.execute({});
    expect(result.success).toBe(true);
    expect(result.patterns.categoryCount).toHaveProperty("work");
    expect(result.patterns.timeSlots).toHaveProperty("morning");
    expect(result.patterns.timeSlots).toHaveProperty("evening");
    expect(result.patterns.recurringPatterns).toHaveProperty("daily");
    expect(result.suggestions).toBeInstanceOf(Array);
  });

  it("handles empty history", async () => {
    const result = await tools.suggestReminders.execute({ lookbackDays: 7 });
    expect(result.success).toBe(true);
    expect(result.patterns.categoryCount).toEqual({});
  });

  it("user isolation: only analyzes own reminders", async () => {
    const coll = getDb().collection("reminders");
    await coll.insertOne({
      title: "Other user task",
      dateTime: new Date(),
      userId: OTHER_USER_ID,
      category: "work",
      status: "pending",
      completed: false,
      recurring: false,
      createdAt: new Date(),
    });

    const result = await tools.suggestReminders.execute({});
    expect(result.patterns.categoryCount).toEqual({});
  });
});

// ============================================
// findConflicts
// ============================================
describe("findConflicts", () => {
  it("detects overlapping reminders", async () => {
    const coll = getDb().collection("reminders");
    const baseTime = new Date("2024-06-01T10:00:00Z");
    await coll.insertOne({
      title: "Existing meeting",
      dateTime: baseTime,
      duration: 60,
      userId: TEST_USER_ID,
      status: "pending",
      completed: false,
    });

    const result = await tools.findConflicts.execute({
      dateTime: "2024-06-01T10:30:00Z",
      duration: 60,
    });

    expect(result.success).toBe(true);
    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts.length).toBe(1);
    expect(result.suggestedTimes.length).toBeGreaterThan(0);
  });

  it("returns no conflicts when times don't overlap", async () => {
    const coll = getDb().collection("reminders");
    await coll.insertOne({
      title: "Morning task",
      dateTime: new Date("2024-06-01T08:00:00Z"),
      duration: 30,
      userId: TEST_USER_ID,
      status: "pending",
      completed: false,
    });

    const result = await tools.findConflicts.execute({
      dateTime: "2024-06-01T14:00:00Z",
      duration: 60,
    });

    expect(result.success).toBe(true);
    expect(result.hasConflicts).toBe(false);
    expect(result.conflicts.length).toBe(0);
  });

  it("excludes completed reminders from conflict check", async () => {
    const coll = getDb().collection("reminders");
    await coll.insertOne({
      title: "Done meeting",
      dateTime: new Date("2024-06-01T10:00:00Z"),
      duration: 60,
      userId: TEST_USER_ID,
      status: "completed",
      completed: true,
    });

    const result = await tools.findConflicts.execute({
      dateTime: "2024-06-01T10:30:00Z",
      duration: 60,
    });

    expect(result.hasConflicts).toBe(false);
  });

  it("handles missing dateTime gracefully", async () => {
    const result = await tools.findConflicts.execute({
      dateTime: "",
    });
    expect(result.conflicts).toEqual([]);
  });

  it("user isolation: ignores other user's reminders", async () => {
    const coll = getDb().collection("reminders");
    await coll.insertOne({
      title: "Other user meeting",
      dateTime: new Date("2024-06-01T10:00:00Z"),
      duration: 60,
      userId: OTHER_USER_ID,
      status: "pending",
      completed: false,
    });

    const result = await tools.findConflicts.execute({
      dateTime: "2024-06-01T10:30:00Z",
      duration: 60,
    });

    expect(result.hasConflicts).toBe(false);
  });
});

// ============================================
// analyzePatterns
// ============================================
describe("analyzePatterns", () => {
  beforeEach(async () => {
    const coll = getDb().collection("reminders");
    await coll.insertMany([
      {
        title: "Work task 1",
        dateTime: new Date(),
        userId: TEST_USER_ID,
        category: "work",
        status: "completed",
        completed: true,
        createdAt: new Date(),
      },
      {
        title: "Work task 2",
        dateTime: new Date(),
        userId: TEST_USER_ID,
        category: "work",
        status: "pending",
        completed: false,
        createdAt: new Date(),
      },
      {
        title: "Health task",
        dateTime: new Date(),
        userId: TEST_USER_ID,
        category: "health",
        status: "completed",
        completed: true,
        createdAt: new Date(),
      },
    ]);
  });

  it("analyzes frequency", async () => {
    const result = await tools.analyzePatterns.execute({
      analysisType: "frequency",
      period: "month",
    });
    expect(result.success).toBe(true);
    expect(result.analysis.totalReminders).toBe(3);
    expect(result.analysis.averagePerWeek).toBeDefined();
  });

  it("analyzes categories", async () => {
    const result = await tools.analyzePatterns.execute({
      analysisType: "categories",
      period: "month",
    });
    expect(result.success).toBe(true);
    expect(result.analysis.byCategory.work).toBe(2);
    expect(result.analysis.byCategory.health).toBe(1);
  });

  it("analyzes completion rate", async () => {
    const result = await tools.analyzePatterns.execute({
      analysisType: "completion",
      period: "month",
    });
    expect(result.success).toBe(true);
    expect(result.analysis.completionRate).toBe("66.7%");
  });

  it("respects period filter", async () => {
    const coll = getDb().collection("reminders");
    await coll.insertOne({
      title: "Old task",
      dateTime: new Date(),
      userId: TEST_USER_ID,
      category: "work",
      status: "pending",
      completed: false,
      createdAt: new Date("2020-01-01"),
    });

    const weekResult = await tools.analyzePatterns.execute({
      analysisType: "frequency",
      period: "week",
    });
    // Old task's createdAt is outside the week window
    expect(weekResult.analysis.totalReminders).toBe(3);

    const allResult = await tools.analyzePatterns.execute({
      analysisType: "frequency",
      period: "all",
    });
    expect(allResult.analysis.totalReminders).toBe(4);
  });
});

// ============================================
// summarizeUpcoming
// ============================================
describe("summarizeUpcoming", () => {
  it("returns upcoming reminders grouped by date", async () => {
    const coll = getDb().collection("reminders");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    await coll.insertMany([
      {
        title: "Tomorrow task 1",
        dateTime: tomorrow,
        userId: TEST_USER_ID,
        category: "work",
        status: "pending",
        completed: false,
      },
      {
        title: "Tomorrow task 2",
        dateTime: tomorrow,
        userId: TEST_USER_ID,
        category: "personal",
        status: "pending",
        completed: false,
      },
    ]);

    const result = await tools.summarizeUpcoming.execute({
      period: "week",
      groupBy: "date",
    });
    expect(result.success).toBe(true);
    expect(result.total).toBe(2);
  });

  it("groups by category", async () => {
    const coll = getDb().collection("reminders");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    await coll.insertMany([
      {
        title: "Work item",
        dateTime: tomorrow,
        userId: TEST_USER_ID,
        category: "work",
        status: "pending",
        completed: false,
      },
      {
        title: "Health item",
        dateTime: tomorrow,
        userId: TEST_USER_ID,
        category: "health",
        status: "pending",
        completed: false,
      },
    ]);

    const result = await tools.summarizeUpcoming.execute({
      period: "week",
      groupBy: "category",
    });
    expect(result.success).toBe(true);
    expect(result.summary).toHaveProperty("work");
    expect(result.summary).toHaveProperty("health");
  });

  it("excludes completed reminders", async () => {
    const coll = getDb().collection("reminders");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    await coll.insertOne({
      title: "Done task",
      dateTime: tomorrow,
      userId: TEST_USER_ID,
      category: "work",
      status: "completed",
      completed: true,
    });

    const result = await tools.summarizeUpcoming.execute({ period: "week" });
    expect(result.total).toBe(0);
  });

  it("returns empty for no upcoming reminders", async () => {
    const result = await tools.summarizeUpcoming.execute({ period: "today" });
    expect(result.success).toBe(true);
    expect(result.total).toBe(0);
  });
});

// ============================================
// exportReminders
// ============================================
describe("exportReminders", () => {
  beforeEach(async () => {
    const coll = getDb().collection("reminders");
    await coll.insertMany([
      {
        title: "Export test 1",
        description: "Desc 1",
        dateTime: new Date("2024-06-01T09:00:00Z"),
        userId: TEST_USER_ID,
        category: "work",
        tags: ["work"],
        status: "pending",
        completed: false,
        createdAt: new Date(),
      },
      {
        title: "Export test 2",
        description: "Desc 2",
        dateTime: new Date("2024-06-02T09:00:00Z"),
        userId: TEST_USER_ID,
        category: "personal",
        tags: ["personal"],
        status: "completed",
        completed: true,
        createdAt: new Date(),
      },
    ]);
  });

  it("exports as JSON", async () => {
    const result = await tools.exportReminders.execute({ format: "json" });
    expect(result.success).toBe(true);
    expect(result.format).toBe("json");
    expect(result.data).toBeInstanceOf(Array);
    expect(result.data.length).toBe(2);
  });

  it("exports as CSV with headers", async () => {
    const result = await tools.exportReminders.execute({ format: "csv" });
    expect(result.success).toBe(true);
    expect(result.format).toBe("csv");
    expect(result.data).toContain("Title,Description,DateTime,Category,Completed");
    expect(result.data).toContain("Export test 1");
  });

  it("sanitizes CSV fields to prevent formula injection", async () => {
    const coll = getDb().collection("reminders");
    await coll.insertOne({
      title: "=HYPERLINK(evil)",
      description: "+cmd",
      dateTime: new Date("2024-06-03T09:00:00Z"),
      userId: TEST_USER_ID,
      category: "work",
      tags: [],
      status: "pending",
      completed: false,
      createdAt: new Date(),
    });

    const result = await tools.exportReminders.execute({ format: "csv" });
    expect(result.data).toContain("'=HYPERLINK(evil)");
    expect(result.data).toContain("'+cmd");
  });
});

// ============================================
// setQuickReminder
// ============================================
describe("setQuickReminder", () => {
  it("creates a reminder relative to current time", async () => {
    const before = Date.now();
    const result = await tools.setQuickReminder.execute({
      title: "Quick one",
      minutesFromNow: 30,
    });

    expect(result.success).toBe(true);
    expect(result.reminder.title).toBe("Quick one");

    const reminderTime = new Date(result.reminder.dateTime).getTime();
    // Should be ~30 minutes from now (allow 5s tolerance)
    expect(reminderTime).toBeGreaterThanOrEqual(before + 29 * 60 * 1000);
    expect(reminderTime).toBeLessThanOrEqual(before + 31 * 60 * 1000);
  });

  it("inherits default fields from createReminder", async () => {
    const result = await tools.setQuickReminder.execute({
      title: "Quick defaults",
      minutesFromNow: 10,
    });

    expect(result.reminder.status).toBe("pending");
    expect(result.reminder.completed).toBe(false);
    expect(result.reminder.userId).toBe(TEST_USER_ID);
  });

  it("passes tags through to createReminder", async () => {
    const result = await tools.setQuickReminder.execute({
      title: "Tagged quick",
      minutesFromNow: 15,
      tags: ["urgent", "work"],
    });

    expect(result.reminder.tags).toEqual(["urgent", "work"]);
  });
});

// ============================================
// templateCreate
// ============================================
describe("templateCreate", () => {
  it("creates from daily-review template", async () => {
    const result = await tools.templateCreate.execute({
      templateName: "daily-review",
    });

    expect(result.success).toBe(true);
    expect(result.reminder.title).toBe("Daily Review");
    expect(result.reminder.recurring).toBe(true);
    expect(result.reminder.recurringType).toBe("daily");
  });

  it("creates from weekly-meeting template", async () => {
    const result = await tools.templateCreate.execute({
      templateName: "weekly-meeting",
    });

    expect(result.success).toBe(true);
    expect(result.reminder.title).toBe("Weekly Team Meeting");
    expect(result.reminder.recurringType).toBe("weekly");
  });

  it("creates from medication template", async () => {
    const result = await tools.templateCreate.execute({
      templateName: "medication",
    });

    expect(result.success).toBe(true);
    expect(result.reminder.title).toBe("Take Medication");
  });

  it("creates from exercise template", async () => {
    const result = await tools.templateCreate.execute({
      templateName: "exercise",
    });

    expect(result.success).toBe(true);
    expect(result.reminder.title).toBe("Exercise Time");
  });

  it("applies customizations to template", async () => {
    const result = await tools.templateCreate.execute({
      templateName: "daily-review",
      customizations: {
        title: "My Custom Review",
        dateTime: "2024-12-01T20:00:00Z",
      },
    });

    expect(result.success).toBe(true);
    expect(result.reminder.title).toBe("My Custom Review");
  });

  it("sets default dateTime at 9:00 when not provided", async () => {
    const result = await tools.templateCreate.execute({
      templateName: "exercise",
    });

    expect(result.success).toBe(true);
    expect(result.reminder.dateTime).toBeDefined();
  });
});

// ============================================
// askClarification
// ============================================
describe("askClarification", () => {
  it("returns question and context", async () => {
    const result = await tools.askClarification.execute({
      question: "When should this reminder be set?",
      context: "User said 'later' without specifying a time",
    });

    expect(result.success).toBe(true);
    expect(result.question).toBe("When should this reminder be set?");
    expect(result.context).toBe("User said 'later' without specifying a time");
  });

  it("works without context", async () => {
    const result = await tools.askClarification.execute({
      question: "Which task do you mean?",
    });

    expect(result.success).toBe(true);
    expect(result.question).toBe("Which task do you mean?");
    expect(result.context).toBeUndefined();
  });
});

// ============================================
// searchWeb
// ============================================
describe("searchWeb", () => {
  const originalEnv = process.env.PERPLEXITY_API_KEY;

  afterEach(() => {
    process.env.PERPLEXITY_API_KEY = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns error when API key is missing", async () => {
    process.env.PERPLEXITY_API_KEY = "";

    const result = await tools.searchWeb.execute({ query: "weather today" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("API key");
  });

  it("calls Perplexity API and returns result on success", async () => {
    process.env.PERPLEXITY_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "It is sunny today" } }],
        }),
      }),
    );

    const result = await tools.searchWeb.execute({ query: "weather today" });
    expect(result.success).toBe(true);
    expect(result.results[0].snippet).toContain("sunny");
  });

  it("handles API error response", async () => {
    process.env.PERPLEXITY_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        text: async () => "Rate limit exceeded",
      }),
    );

    const result = await tools.searchWeb.execute({ query: "test" });
    expect(result.success).toBe(false);
  });
});
