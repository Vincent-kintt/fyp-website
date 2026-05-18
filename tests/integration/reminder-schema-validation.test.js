// RED-first tests for P1a — shared reminder zod schema (H5 + L2).
//
// Verifies:
//   H5 — POST/PUT/PATCH all reject malformed dateTime ("not-a-date") with 400.
//   L2 — priority / status / recurringType are strict enums; category is the
//        closed set ["work","personal","health","other"]; PATCH also rejects
//        unknown enum values with 400.
//
// We hit a real (mongodb-memory-server) DB per CLAUDE.md "Mocking the database
// in integration tests has masked migration breakage". The route handlers run
// unmodified.

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

setupApiMocks(getDb);

const { POST } = await import("@/app/api/reminders/route.js");
const { PUT, PATCH } = await import("@/app/api/reminders/[id]/route.js");

const TEST_USER = { id: "user-abc", username: "testuser", role: "user" };

async function insertReminder(overrides = {}) {
  const db = getDb();
  const doc = {
    title: "Seed Reminder",
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
  await startDb("test_reminder_schema_validation");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
});

describe("POST /api/reminders — schema validation (H5 + L2)", () => {
  it("rejects malformed dateTime string with 400 (H5)", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/reminders", {
      body: { title: "Bad date", dateTime: "not-a-date" },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("rejects unknown priority enum with 400 (L2)", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/reminders", {
      body: {
        title: "Bad priority",
        dateTime: "2026-06-01T09:00:00.000Z",
        priority: "extreme",
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("rejects unknown recurringType enum with 400 (L2)", async () => {
    // Canonical set is ["daily","weekly","monthly","yearly"] (TaskEditForm).
    // "biweekly" is not allowed; UI cannot produce it.
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/reminders", {
      body: {
        title: "Bad recurring",
        dateTime: "2026-06-01T09:00:00.000Z",
        recurring: true,
        recurringType: "biweekly",
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("rejects unknown category enum with 400 (L2)", async () => {
    // Canonical set is REMINDER_CATEGORIES = ["work","personal","health"]
    // plus the synthetic "other" used by getMainCategory. "nuclear" is rejected.
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/reminders", {
      body: {
        title: "Bad category",
        dateTime: "2026-06-01T09:00:00.000Z",
        category: "nuclear",
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("rejects unknown status enum on POST with 400 (L2)", async () => {
    // POST does not currently set status from input (always "pending"), but the
    // shared schema makes status optional + enum-validated on POST too. If the
    // client sends a stale status value, fail closed at the boundary.
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/reminders", {
      body: {
        title: "Bad status",
        dateTime: "2026-06-01T09:00:00.000Z",
        status: "doing",
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("accepts canonical happy-path body with 201 (regression lock)", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/reminders", {
      body: {
        title: "Good task",
        dateTime: "2026-06-01T09:00:00.000Z",
        priority: "high",
        status: "pending",
        category: "work",
        tags: ["work"],
        recurring: true,
        recurringType: "weekly",
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.priority).toBe("high");
    expect(body.data.status).toBe("pending");
  });

  it("accepts dateTime with timezone offset (e.g. +08:00)", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/reminders", {
      body: {
        title: "Offset date",
        dateTime: "2026-06-01T09:00:00+08:00",
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(201);
    expect(body.success).toBe(true);
  });
});

describe("PUT /api/reminders/[id] — schema validation (H5 + L2)", () => {
  it("rejects malformed dateTime with 400 (H5)", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder();
    const req = createRequest("PUT", `/api/reminders/${id}`, {
      body: { title: "X", dateTime: "not-a-date" },
    });
    const res = await PUT(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("rejects unknown category with 400 (L2)", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder();
    const req = createRequest("PUT", `/api/reminders/${id}`, {
      body: {
        title: "X",
        dateTime: "2026-06-01T09:00:00.000Z",
        category: "nuclear",
      },
    });
    const res = await PUT(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });
});

describe("PATCH /api/reminders/[id] — schema validation (H5 + L2)", () => {
  it("rejects unknown status enum with 400 (L2)", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder();
    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { status: "doing" },
    });
    const res = await PATCH(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("rejects malformed dateTime with 400 (H5)", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder();
    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { dateTime: "totally-bogus" },
    });
    const res = await PATCH(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("rejects unknown priority with 400 (L2)", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder();
    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { priority: "extreme" },
    });
    const res = await PATCH(req, params({ id }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });
});
