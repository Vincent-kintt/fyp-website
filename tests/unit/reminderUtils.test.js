import { describe, it, expect } from "vitest";
import { ObjectId } from "mongodb";
import {
  formatReminder,
  normalizeSubtasks,
  apiSuccess,
  apiError,
  validateReminderFields,
} from "@/lib/reminderUtils.js";

describe("formatReminder", () => {
  it("maps _id to id and returns all fields correctly", () => {
    const oid = new ObjectId();
    const now = new Date().toISOString();
    const doc = {
      _id: oid,
      title: "Buy groceries",
      description: "Milk, eggs, bread",
      remark: "Use coupons",
      dateTime: now,
      duration: 30,
      tags: ["shopping"],
      category: "personal",
      recurring: false,
      recurringType: null,
      status: "pending",
      completed: false,
      snoozedUntil: null,
      startedAt: null,
      completedAt: null,
      priority: "high",
      subtasks: [{ id: "st-1", title: "Milk", completed: false }],
      sortOrder: 2000,
      notificationSent: false,
      username: "alice",
      createdAt: now,
      updatedAt: now,
    };

    const result = formatReminder(doc);

    expect(result.id).toBe(oid.toString());
    expect(result).not.toHaveProperty("_id");
    expect(result.title).toBe("Buy groceries");
    expect(result.description).toBe("Milk, eggs, bread");
    expect(result.remark).toBe("Use coupons");
    expect(result.priority).toBe("high");
    expect(result.sortOrder).toBe(2000);
    expect(result.subtasks).toEqual([{ id: "st-1", title: "Milk", completed: false }]);
  });

  it("applies defaults for missing fields", () => {
    const oid = new ObjectId();
    const doc = {
      _id: oid,
      title: "Minimal task",
      description: "",
      dateTime: null,
      recurring: false,
      recurringType: null,
      completed: false,
      username: "bob",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = formatReminder(doc);

    expect(result.remark).toBe("");
    expect(result.duration).toBeNull();
    expect(result.snoozedUntil).toBeNull();
    expect(result.priority).toBe("medium");
    expect(result.subtasks).toEqual([]);
    expect(result.sortOrder).toBe(0);
  });

  it("derives status from completed when status field is missing", () => {
    const oid = new ObjectId();
    const doc = {
      _id: oid,
      title: "Done task",
      description: "",
      dateTime: null,
      recurring: false,
      recurringType: null,
      completed: true,
      username: "carol",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = formatReminder(doc);

    expect(result.status).toBe("completed");
  });
});

describe("normalizeSubtasks", () => {
  it("converts string array to objects with title, completed=false, id starting with st-", () => {
    const result = normalizeSubtasks(["Task A", "Task B"]);

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Task A");
    expect(result[0].completed).toBe(false);
    expect(result[0].id).toMatch(/^st-/);
    expect(result[1].title).toBe("Task B");
    expect(result[1].completed).toBe(false);
    expect(result[1].id).toMatch(/^st-/);
  });

  it("preserves existing ids on object input", () => {
    const input = [{ id: "my-id", title: "Task", completed: true }];
    const result = normalizeSubtasks(input);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("my-id");
    expect(result[0].title).toBe("Task");
    expect(result[0].completed).toBe(true);
  });

  it("generates new ids when preserveIds is false", () => {
    const input = [{ id: "old-id", title: "Task", completed: false }];
    const result = normalizeSubtasks(input, { preserveIds: false });

    expect(result[0].id).not.toBe("old-id");
    expect(result[0].id).toMatch(/^st-/);
  });

  it("uses batchIndex in generated ids", () => {
    const result = normalizeSubtasks(["Task"], { batchIndex: 5 });

    expect(result[0].id).toMatch(/-5-0$/);
  });

  it("returns empty array for non-array input", () => {
    expect(normalizeSubtasks(null)).toEqual([]);
    expect(normalizeSubtasks(undefined)).toEqual([]);
    expect(normalizeSubtasks("string")).toEqual([]);
  });
});

describe("apiSuccess / apiError", () => {
  it("apiSuccess returns status 200 with success body", async () => {
    const res = apiSuccess({ foo: "bar" });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, data: { foo: "bar" } });
  });

  it("apiSuccess accepts custom status code", async () => {
    const res = apiSuccess({}, 201);

    expect(res.status).toBe(201);
  });

  it("apiError returns error status and body", async () => {
    const res = apiError("Not found", 404);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ success: false, error: "Not found" });
  });
});

describe("validateReminderFields", () => {
  it("returns null for valid fields", () => {
    const result = validateReminderFields({
      title: "Valid title",
      description: "Some description",
      remark: "A remark",
      tags: ["tag1", "tag2"],
    });

    expect(result).toBeNull();
  });

  it("rejects title longer than 200 characters", async () => {
    const result = validateReminderFields({
      title: "x".repeat(201),
    });

    expect(result).not.toBeNull();
    expect(result.status).toBe(400);
    const body = await result.json();
    expect(body.success).toBe(false);
  });

  it("rejects description > 5000 and remark > 2000 characters", async () => {
    const descResult = validateReminderFields({
      description: "x".repeat(5001),
    });
    expect(descResult).not.toBeNull();
    expect(descResult.status).toBe(400);

    const remarkResult = validateReminderFields({
      remark: "x".repeat(2001),
    });
    expect(remarkResult).not.toBeNull();
    expect(remarkResult.status).toBe(400);
  });

  it("rejects tags with more than 20 items", async () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
    const result = validateReminderFields({ tags });

    expect(result).not.toBeNull();
    expect(result.status).toBe(400);
    const body = await result.json();
    expect(body.success).toBe(false);
  });
});
