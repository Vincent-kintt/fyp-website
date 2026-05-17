/**
 * Integration tests for app/api/reminders/wake-snoozed/route.js.
 *
 * Real DB (mongodb-memory-server) — no mocking. Verifies the endpoint is the
 * user-scoped wrapper around `wakeSnoozedTasks`: bulk-wakes only the calling
 * user's expired snoozed reminders, idempotent across multiple POSTs, and
 * inherits the auth-scoped cache contract from `withAuth`.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { ObjectId } from "mongodb";
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";
import {
  setupApiMocks,
  mockSession,
  createRequest,
  parseResponse,
} from "../helpers/api.js";

setupApiMocks(getDb);

const { POST } = await import(
  "@/app/api/reminders/wake-snoozed/route.js"
);

const TEST_USER = { id: "user-wake-a", username: "userA", role: "user" };
const OTHER_USER = { id: "user-wake-b", username: "userB", role: "user" };

beforeAll(async () => {
  await startDb("test_wake_snoozed_api");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
});

async function seedReminder(userId, overrides = {}) {
  const db = getDb();
  const now = new Date();
  const result = await db.collection("reminders").insertOne({
    title: "Seeded",
    userId,
    status: "pending",
    completed: false,
    snoozedUntil: null,
    dateTime: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
  return result.insertedId;
}

describe("POST /api/reminders/wake-snoozed — auth", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const req = createRequest("POST", "/api/reminders/wake-snoozed");
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });
});

describe("POST /api/reminders/wake-snoozed — behavior", () => {
  it("returns { reactivated: 0 } when the user has no snoozed tasks", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/reminders/wake-snoozed");
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.reactivated).toBe(0);
    expect(typeof body.data.timestamp).toBe("string");
  });

  it("wakes only the calling user's expired snoozed tasks", async () => {
    mockSession(TEST_USER);
    const pastDue1 = await seedReminder(TEST_USER.id, {
      title: "Past due 1",
      status: "snoozed",
      completed: true,
      snoozedUntil: new Date(Date.now() - 60_000),
    });
    const pastDue2 = await seedReminder(TEST_USER.id, {
      title: "Past due 2",
      status: "snoozed",
      completed: true,
      snoozedUntil: new Date(Date.now() - 5 * 60_000),
    });
    const future = await seedReminder(TEST_USER.id, {
      title: "Not yet due",
      status: "snoozed",
      completed: true,
      snoozedUntil: new Date(Date.now() + 60 * 60_000),
    });

    const req = createRequest("POST", "/api/reminders/wake-snoozed");
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.reactivated).toBe(2);

    const db = getDb();
    const doc1 = await db.collection("reminders").findOne({ _id: pastDue1 });
    const doc2 = await db.collection("reminders").findOne({ _id: pastDue2 });
    const docFuture = await db
      .collection("reminders")
      .findOne({ _id: future });
    expect(doc1.status).toBe("pending");
    expect(doc1.completed).toBe(false);
    expect(doc1.snoozedUntil).toBeNull();
    expect(doc2.status).toBe("pending");
    expect(docFuture.status).toBe("snoozed");
  });

  it("does not touch other users' snoozed tasks", async () => {
    mockSession(TEST_USER);
    const otherSnoozed = await seedReminder(OTHER_USER.id, {
      title: "Other user past due",
      status: "snoozed",
      completed: true,
      snoozedUntil: new Date(Date.now() - 60_000),
    });

    const req = createRequest("POST", "/api/reminders/wake-snoozed");
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.reactivated).toBe(0);

    const db = getDb();
    const doc = await db
      .collection("reminders")
      .findOne({ _id: otherSnoozed });
    expect(doc.status).toBe("snoozed");
  });

  it("is idempotent — second POST returns reactivated: 0", async () => {
    mockSession(TEST_USER);
    await seedReminder(TEST_USER.id, {
      title: "Past due",
      status: "snoozed",
      completed: true,
      snoozedUntil: new Date(Date.now() - 60_000),
    });

    const first = await POST(
      createRequest("POST", "/api/reminders/wake-snoozed"),
    );
    const firstBody = (await parseResponse(first)).body;
    expect(firstBody.data.reactivated).toBe(1);

    const second = await POST(
      createRequest("POST", "/api/reminders/wake-snoozed"),
    );
    const secondBody = (await parseResponse(second)).body;
    expect(secondBody.data.reactivated).toBe(0);
  });
});

describe("POST /api/reminders/wake-snoozed — auth-scoped cache contract", () => {
  it("sets Cache-Control: private, no-store on 200", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/reminders/wake-snoozed");
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("sets Cache-Control: private, no-store on 401", async () => {
    mockSession(null);
    const req = createRequest("POST", "/api/reminders/wake-snoozed");
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
