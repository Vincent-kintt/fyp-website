import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";
import {
  setupApiMocks,
  mockSession,
  createRequest,
  parseResponse,
} from "../helpers/api.js";

setupApiMocks(getDb);

const { PATCH } = await import("@/app/api/reminders/reorder/route.js");

const TEST_USER = { id: "user-abc", username: "testuser", role: "user" };

beforeAll(async () => {
  await startDb("test_reorder_api");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
});

async function insertReminder(overrides = {}) {
  const db = getDb();
  const result = await db.collection("reminders").insertOne({
    title: "Task",
    dateTime: new Date(),
    userId: TEST_USER.id,
    tags: [],
    status: "pending",
    completed: false,
    sortOrder: 0,
    notificationSent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  return result.insertedId.toString();
}

describe("PATCH /api/reminders/reorder", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const req = createRequest("PATCH", "/api/reminders/reorder", {
      body: { items: [] },
    });
    const res = await PATCH(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 400 when items array is empty", async () => {
    mockSession(TEST_USER);
    const req = createRequest("PATCH", "/api/reminders/reorder", {
      body: { items: [] },
    });
    const res = await PATCH(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/items array is required/i);
  });

  it("returns 400 when ID is invalid", async () => {
    mockSession(TEST_USER);
    const req = createRequest("PATCH", "/api/reminders/reorder", {
      body: { items: [{ id: "not-valid", sortOrder: 1000 }] },
    });
    const res = await PATCH(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/invalid reminder id/i);
  });

  it("returns 400 when sortOrder is not a number", async () => {
    mockSession(TEST_USER);
    const id = new ObjectId().toString();
    const req = createRequest("PATCH", "/api/reminders/reorder", {
      body: { items: [{ id, sortOrder: "abc" }] },
    });
    const res = await PATCH(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/sortOrder must be a number/i);
  });

  it("updates sortOrder in DB (happy path)", async () => {
    mockSession(TEST_USER);
    const id1 = await insertReminder({ title: "First", sortOrder: 0 });
    const id2 = await insertReminder({ title: "Second", sortOrder: 1000 });

    const req = createRequest("PATCH", "/api/reminders/reorder", {
      body: {
        items: [
          { id: id1, sortOrder: 2000 },
          { id: id2, sortOrder: 1000 },
        ],
      },
    });
    const res = await PATCH(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.matched).toBe(2);

    // Verify DB state
    const db = getDb();
    const r1 = await db
      .collection("reminders")
      .findOne({ _id: new ObjectId(id1) });
    const r2 = await db
      .collection("reminders")
      .findOne({ _id: new ObjectId(id2) });
    expect(r1.sortOrder).toBe(2000);
    expect(r2.sortOrder).toBe(1000);
  });

  it("resets notificationSent when dateTime is updated", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({
      notificationSent: true,
      sortOrder: 0,
    });

    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const req = createRequest("PATCH", "/api/reminders/reorder", {
      body: {
        items: [{ id, sortOrder: 1000, dateTime: futureDate }],
      },
    });
    const res = await PATCH(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.matched).toBe(1);

    // Verify notificationSent was reset
    const db = getDb();
    const doc = await db
      .collection("reminders")
      .findOne({ _id: new ObjectId(id) });
    expect(doc.notificationSent).toBe(false);
    expect(doc.dateTime).toBeInstanceOf(Date);
  });

  it("cannot reorder another user's reminders (user isolation)", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    const result = await db.collection("reminders").insertOne({
      title: "Other user task",
      dateTime: new Date(),
      userId: "other-user",
      tags: [],
      status: "pending",
      completed: false,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const otherId = result.insertedId.toString();

    const req = createRequest("PATCH", "/api/reminders/reorder", {
      body: { items: [{ id: otherId, sortOrder: 5000 }] },
    });
    const res = await PATCH(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.matched).toBe(0);

    // Verify sortOrder unchanged
    const doc = await db
      .collection("reminders")
      .findOne({ _id: result.insertedId });
    expect(doc.sortOrder).toBe(0);
  });

  it("batch reorders multiple items", async () => {
    mockSession(TEST_USER);
    const id1 = await insertReminder({ title: "A", sortOrder: 0 });
    const id2 = await insertReminder({ title: "B", sortOrder: 1000 });
    const id3 = await insertReminder({ title: "C", sortOrder: 2000 });

    const req = createRequest("PATCH", "/api/reminders/reorder", {
      body: {
        items: [
          { id: id1, sortOrder: 3000 },
          { id: id2, sortOrder: 2000 },
          { id: id3, sortOrder: 1000 },
        ],
      },
    });
    const res = await PATCH(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.matched).toBe(3);

    // Verify all updated
    const db = getDb();
    const r1 = await db
      .collection("reminders")
      .findOne({ _id: new ObjectId(id1) });
    const r2 = await db
      .collection("reminders")
      .findOne({ _id: new ObjectId(id2) });
    const r3 = await db
      .collection("reminders")
      .findOne({ _id: new ObjectId(id3) });
    expect(r1.sortOrder).toBe(3000);
    expect(r2.sortOrder).toBe(2000);
    expect(r3.sortOrder).toBe(1000);
  });
});
