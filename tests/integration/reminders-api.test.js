import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";
import { setupApiMocks, mockSession, createRequest, parseResponse } from "../helpers/api.js";

// Setup mocks BEFORE importing route handlers
setupApiMocks(getDb);

const { GET, POST } = await import("@/app/api/reminders/route.js");

const TEST_USER = { id: "user-abc", username: "testuser", role: "user" };

beforeAll(async () => {
  await startDb("test_reminders_api");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
});

describe("GET /api/reminders", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const req = createRequest("GET", "/api/reminders");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns reminders for authenticated user", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    await db.collection("reminders").insertOne({
      title: "Test task",
      dateTime: new Date(),
      userId: TEST_USER.id,
      tags: ["work"],
      status: "pending",
      completed: false,
      createdAt: new Date(),
    });

    const req = createRequest("GET", "/api/reminders");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Test task");
    expect(body.data[0].id).toBeDefined();
  });

  it("filters by category", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    await db.collection("reminders").insertMany([
      { title: "Work task", dateTime: new Date(), userId: TEST_USER.id, category: "work", tags: ["work"], status: "pending", completed: false, createdAt: new Date() },
      { title: "Personal task", dateTime: new Date(), userId: TEST_USER.id, category: "personal", tags: ["personal"], status: "pending", completed: false, createdAt: new Date() },
    ]);

    const req = createRequest("GET", "/api/reminders", { searchParams: { category: "work" } });
    const res = await GET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Work task");
  });

  it("filters by tag", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    await db.collection("reminders").insertMany([
      { title: "Urgent task", dateTime: new Date(), userId: TEST_USER.id, tags: ["urgent"], status: "pending", completed: false, createdAt: new Date() },
      { title: "Routine task", dateTime: new Date(), userId: TEST_USER.id, tags: ["routine"], status: "pending", completed: false, createdAt: new Date() },
    ]);

    const req = createRequest("GET", "/api/reminders", { searchParams: { tag: "urgent" } });
    const res = await GET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Urgent task");
  });

  it("filters by combined category + tag", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    await db.collection("reminders").insertMany([
      { title: "Work urgent", dateTime: new Date(), userId: TEST_USER.id, category: "work", tags: ["work", "urgent"], status: "pending", completed: false, createdAt: new Date() },
      { title: "Work routine", dateTime: new Date(), userId: TEST_USER.id, category: "work", tags: ["work", "routine"], status: "pending", completed: false, createdAt: new Date() },
    ]);

    const req = createRequest("GET", "/api/reminders", { searchParams: { category: "work", tag: "urgent" } });
    const res = await GET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Work urgent");
  });

  it("filters by type=recurring", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    await db.collection("reminders").insertMany([
      { title: "Daily standup", dateTime: new Date(), userId: TEST_USER.id, tags: ["work"], recurring: true, recurringType: "daily", status: "pending", completed: false, createdAt: new Date() },
      { title: "One-time task", dateTime: new Date(), userId: TEST_USER.id, tags: ["work"], recurring: false, status: "pending", completed: false, createdAt: new Date() },
    ]);

    const req = createRequest("GET", "/api/reminders", { searchParams: { type: "recurring" } });
    const res = await GET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Daily standup");
  });

  it("paginates with page and limit params", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    const docs = Array.from({ length: 5 }, (_, i) => ({
      title: `Task ${i + 1}`,
      dateTime: new Date(Date.now() + i * 60000),
      userId: TEST_USER.id,
      tags: ["work"],
      status: "pending",
      completed: false,
      createdAt: new Date(),
    }));
    await db.collection("reminders").insertMany(docs);

    const req = createRequest("GET", "/api/reminders", {
      searchParams: { page: "1", limit: "2" },
    });
    const res = await GET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 5,
      totalPages: 3,
    });
  });

  it("returns second page correctly", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    const docs = Array.from({ length: 5 }, (_, i) => ({
      title: `Task ${i + 1}`,
      dateTime: new Date(Date.now() + i * 60000),
      userId: TEST_USER.id,
      tags: ["work"],
      status: "pending",
      completed: false,
      createdAt: new Date(),
    }));
    await db.collection("reminders").insertMany(docs);

    const req = createRequest("GET", "/api/reminders", {
      searchParams: { page: "2", limit: "2" },
    });
    const res = await GET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].title).toBe("Task 3");
    expect(body.pagination.page).toBe(2);
  });

  it("returns all results without pagination params (backward compatible)", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    const docs = Array.from({ length: 3 }, (_, i) => ({
      title: `Task ${i + 1}`,
      dateTime: new Date(Date.now() + i * 60000),
      userId: TEST_USER.id,
      tags: ["work"],
      status: "pending",
      completed: false,
      createdAt: new Date(),
    }));
    await db.collection("reminders").insertMany(docs);

    const req = createRequest("GET", "/api/reminders");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data).toHaveLength(3);
    expect(body.pagination).toBeUndefined();
  });

  it("defaults invalid page/limit to sensible values", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    await db.collection("reminders").insertOne({
      title: "Solo task",
      dateTime: new Date(),
      userId: TEST_USER.id,
      tags: ["work"],
      status: "pending",
      completed: false,
      createdAt: new Date(),
    });

    const req = createRequest("GET", "/api/reminders", {
      searchParams: { page: "abc", limit: "-1" },
    });
    const res = await GET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(50);
  });

  it("isolates reminders by user", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    await db.collection("reminders").insertOne({
      title: "Other user task",
      dateTime: new Date(),
      userId: "user-other",
      tags: ["work"],
      status: "pending",
      completed: false,
      createdAt: new Date(),
    });

    const req = createRequest("GET", "/api/reminders");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data).toHaveLength(0);
  });
});

describe("POST /api/reminders", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const req = createRequest("POST", "/api/reminders", {
      body: { title: "Test", dateTime: new Date().toISOString() },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 400 when missing required fields", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/reminders", {
      body: { title: "No date" },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/missing required field/i);
  });

  it("creates reminder with correct defaults", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/reminders", {
      body: { title: "Minimal task", dateTime: new Date().toISOString() },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("pending");
    expect(body.data.completed).toBe(false);
    expect(body.data.sortOrder).toBe(0);
    expect(body.data.notificationSent).toBe(false);
    expect(body.data.priority).toBe("medium");
  });

  it("normalizes tags", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/reminders", {
      body: {
        title: "Tagged task",
        dateTime: new Date().toISOString(),
        tags: ["#Work", "  URGENT  ", "a"],
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(201);
    expect(body.data.tags).toEqual(["work", "urgent"]);
  });

  it("rejects invalid duration", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/reminders", {
      body: { title: "Bad duration", dateTime: new Date().toISOString(), duration: -5 },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("rejects title exceeding 200 chars", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/reminders", {
      body: { title: "x".repeat(201), dateTime: new Date().toISOString() },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/200/);
  });
});
