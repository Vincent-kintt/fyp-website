import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";
import {
  setupApiMocks,
  mockSession,
  createRequest,
  params,
  parseResponse,
} from "../helpers/api.js";

// Setup mocks BEFORE importing route handlers
setupApiMocks(getDb);

const { GET, PUT, DELETE, PATCH } = await import(
  "@/app/api/reminders/[id]/route.js"
);

const TEST_USER = { id: "user-abc", username: "testuser", role: "user" };
const OTHER_USER = { id: "user-xyz", username: "otheruser", role: "user" };

async function insertReminder(overrides = {}) {
  const db = getDb();
  const doc = {
    title: "Test Reminder",
    description: "",
    remark: "",
    dateTime: new Date("2026-06-01T09:00:00Z"),
    duration: null,
    category: "personal",
    tags: ["work"],
    recurring: false,
    recurringType: null,
    priority: "medium",
    status: "pending",
    completed: false,
    subtasks: [],
    sortOrder: 0,
    notificationSent: false,
    userId: TEST_USER.id,
    username: TEST_USER.username,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  const result = await db.collection("reminders").insertOne(doc);
  return result.insertedId.toString();
}

beforeAll(async () => {
  await startDb("test_reminder_id_api");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
});

// ---------------------------------------------------------------------------
// GET /api/reminders/[id]
// ---------------------------------------------------------------------------
describe("GET /api/reminders/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const id = new ObjectId().toString();
    const req = createRequest("GET", `/api/reminders/${id}`);
    const res = await GET(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 400 for invalid ObjectId", async () => {
    mockSession(TEST_USER);
    const req = createRequest("GET", "/api/reminders/not-valid");
    const res = await GET(req, params({ id: "not-valid" }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/invalid/i);
  });

  it("returns 404 when reminder does not exist", async () => {
    mockSession(TEST_USER);
    const fakeId = new ObjectId().toString();
    const req = createRequest("GET", `/api/reminders/${fakeId}`);
    const res = await GET(req, params({ id: fakeId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(404);
  });

  it("returns 404 for another user's reminder (user isolation)", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ userId: OTHER_USER.id });
    const req = createRequest("GET", `/api/reminders/${id}`);
    const res = await GET(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(404);
  });

  it("returns 200 with formatted reminder on success", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder();
    const req = createRequest("GET", `/api/reminders/${id}`);
    const res = await GET(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(id);
    expect(body.data.title).toBe("Test Reminder");
    expect(body.data.tags).toEqual(["work"]);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/reminders/[id]
// ---------------------------------------------------------------------------
describe("PUT /api/reminders/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const id = new ObjectId().toString();
    const req = createRequest("PUT", `/api/reminders/${id}`, {
      body: { title: "X", dateTime: new Date().toISOString() },
    });
    const res = await PUT(req, params({ id }));
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("returns 400 when required fields are missing (no dateTime)", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder();
    const req = createRequest("PUT", `/api/reminders/${id}`, {
      body: { title: "Updated" },
    });
    const res = await PUT(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/missing required fields/i);
  });

  it("returns 200 for valid status transition pending→completed", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ status: "pending" });
    const req = createRequest("PUT", `/api/reminders/${id}`, {
      body: {
        title: "Done task",
        dateTime: new Date().toISOString(),
        status: "completed",
      },
    });
    const res = await PUT(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.status).toBe("completed");
    expect(body.data.completed).toBe(true);
  });

  it("returns 400 for invalid status transition completed→snoozed", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ status: "completed", completed: true });
    const req = createRequest("PUT", `/api/reminders/${id}`, {
      body: {
        title: "Snooze attempt",
        dateTime: new Date().toISOString(),
        status: "snoozed",
      },
    });
    const res = await PUT(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/invalid status transition/i);
  });

  it("returns 404 when reminder not found during transition check", async () => {
    mockSession(TEST_USER);
    const fakeId = new ObjectId().toString();
    const req = createRequest("PUT", `/api/reminders/${fakeId}`, {
      body: {
        title: "Ghost",
        dateTime: new Date().toISOString(),
        status: "completed",
      },
    });
    const res = await PUT(req, params({ id: fakeId }));
    const { status } = await parseResponse(res);
    expect(status).toBe(404);
  });

  it("returns 400 when title exceeds 200 characters", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder();
    const req = createRequest("PUT", `/api/reminders/${id}`, {
      body: {
        title: "x".repeat(201),
        dateTime: new Date().toISOString(),
      },
    });
    const res = await PUT(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/200/);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/reminders/[id]
// ---------------------------------------------------------------------------
describe("DELETE /api/reminders/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const id = new ObjectId().toString();
    const req = createRequest("DELETE", `/api/reminders/${id}`);
    const res = await DELETE(req, params({ id }));
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("returns 400 for invalid ObjectId", async () => {
    mockSession(TEST_USER);
    const req = createRequest("DELETE", "/api/reminders/not-valid");
    const res = await DELETE(req, params({ id: "not-valid" }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/invalid/i);
  });

  it("returns 404 for another user's reminder", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ userId: OTHER_USER.id });
    const req = createRequest("DELETE", `/api/reminders/${id}`);
    const res = await DELETE(req, params({ id }));
    const { status } = await parseResponse(res);
    expect(status).toBe(404);
  });

  it("returns 200 with stripped-down response and actually deletes from DB", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder();
    const req = createRequest("DELETE", `/api/reminders/${id}`);
    const res = await DELETE(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(id);
    expect(body.data.title).toBe("Test Reminder");

    // Stripped-down response should NOT contain these fields
    expect(body.data).not.toHaveProperty("status");
    expect(body.data).not.toHaveProperty("subtasks");
    expect(body.data).not.toHaveProperty("sortOrder");

    // Verify document is actually deleted from DB
    const db = getDb();
    const doc = await db
      .collection("reminders")
      .findOne({ _id: new ObjectId(id) });
    expect(doc).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/reminders/[id]
// ---------------------------------------------------------------------------
describe("PATCH /api/reminders/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const id = new ObjectId().toString();
    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { title: "X" },
    });
    const res = await PATCH(req, params({ id }));
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("sets completedAt when transitioning pending→completed", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ status: "pending" });
    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { status: "completed" },
    });
    const res = await PATCH(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.status).toBe("completed");
    expect(body.data.completed).toBe(true);
    expect(body.data.completedAt).toBeTruthy();
  });

  it("sets startedAt when transitioning pending→in_progress", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ status: "pending" });
    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { status: "in_progress" },
    });
    const res = await PATCH(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.status).toBe("in_progress");
    expect(body.data.startedAt).toBeTruthy();
  });

  it("returns 400 for invalid status transition (completed→snoozed)", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ status: "completed", completed: true });
    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { status: "snoozed" },
    });
    const res = await PATCH(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/invalid status transition/i);
  });

  it("returns 400 when snoozing without snoozedUntil", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ status: "pending" });
    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { status: "snoozed" },
    });
    const res = await PATCH(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/snoozedUntil/i);
  });

  it("returns 200 when snoozing with snoozedUntil", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ status: "pending" });
    const snoozedUntil = new Date("2026-07-01T09:00:00Z").toISOString();
    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { status: "snoozed", snoozedUntil },
    });
    const res = await PATCH(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.status).toBe("snoozed");
    expect(body.data.snoozedUntil).toBeTruthy();
  });

  it("clears snoozedUntil when leaving snoozed state", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({
      status: "snoozed",
      snoozedUntil: new Date("2026-07-01T09:00:00Z"),
    });
    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { status: "pending" },
    });
    const res = await PATCH(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.status).toBe("pending");
    expect(body.data.snoozedUntil).toBeNull();
  });

  it("backward-compat: completed:true derives status completed", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ status: "pending" });
    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { completed: true },
    });
    const res = await PATCH(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.completed).toBe(true);
    expect(body.data.status).toBe("completed");
    expect(body.data.completedAt).toBeTruthy();
  });

  it("backward-compat: completed:false derives status pending", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ status: "completed", completed: true });
    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { completed: false },
    });
    const res = await PATCH(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.completed).toBe(false);
    expect(body.data.status).toBe("pending");
  });

  it("partial update: only title, tags, priority", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder();
    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { title: "New Title", tags: ["updated"], priority: "high" },
    });
    const res = await PATCH(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.title).toBe("New Title");
    expect(body.data.tags).toEqual(["updated"]);
    expect(body.data.priority).toBe("high");
    // Original fields should remain unchanged
    expect(body.data.status).toBe("pending");
  });

  it("dateTime update resets notificationSent", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ notificationSent: true });
    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { dateTime: new Date("2026-08-01T10:00:00Z").toISOString() },
    });
    const res = await PATCH(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.notificationSent).toBe(false);
  });

  it("returns 400 for invalid duration", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder();
    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { duration: -5 },
    });
    const res = await PATCH(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("returns 400 when remark exceeds 2000 characters", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder();
    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { remark: "x".repeat(2001) },
    });
    const res = await PATCH(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/2000/);
  });

  it("returns 404 when reminder not found", async () => {
    mockSession(TEST_USER);
    const fakeId = new ObjectId().toString();
    const req = createRequest("PATCH", `/api/reminders/${fakeId}`, {
      body: { title: "Ghost" },
    });
    const res = await PATCH(req, params({ id: fakeId }));
    const { status } = await parseResponse(res);
    expect(status).toBe(404);
  });

  it("returns 404 for another user's reminder (user isolation)", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ userId: OTHER_USER.id });
    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { title: "Hijack attempt" },
    });
    const res = await PATCH(req, params({ id }));
    const { status } = await parseResponse(res);
    expect(status).toBe(404);
  });

  it("backward-compat: completed:false on snoozed reminder preserves snoozed status", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({
      status: "snoozed",
      completed: false,
      snoozedUntil: new Date("2026-07-01T09:00:00Z"),
    });
    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { completed: false },
    });
    const res = await PATCH(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.status).toBe("snoozed");
    expect(body.data.completed).toBe(false);
  });
});
