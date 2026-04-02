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
});
