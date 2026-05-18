import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";
import {
  setupApiMocks,
  mockSession,
  createRequest,
  params,
  parseResponse,
} from "../helpers/api.js";

setupApiMocks(getDb);

const { PUT, PATCH } = await import("@/app/api/reminders/[id]/route.js");

const TEST_USER = { id: "user-h3", username: "h3user", role: "user" };

async function insertReminder(overrides = {}) {
  const db = getDb();
  const doc = {
    title: "Past due reminder",
    description: "",
    remark: "",
    dateTime: new Date("2026-05-10T09:00:00Z"),
    duration: null,
    category: "personal",
    tags: [],
    recurring: false,
    recurringType: null,
    priority: "medium",
    status: "pending",
    completed: false,
    subtasks: [],
    sortOrder: 0,
    notificationSent: true,
    inboxState: "processed",
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
  await startDb("test_reminders_h3");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
});

describe("PUT /api/reminders/[id] — H3: notificationSent only resets on dateTime change", () => {
  it("title-only edit does NOT reset notificationSent", async () => {
    mockSession(TEST_USER);
    const dateTimeIso = "2026-05-10T09:00:00.000Z";
    const id = await insertReminder({
      dateTime: new Date(dateTimeIso),
      notificationSent: true,
    });

    const req = createRequest("PUT", `/api/reminders/${id}`, {
      body: { title: "Renamed only", dateTime: dateTimeIso },
    });
    const res = await PUT(req, params({ id }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.notificationSent).toBe(true);
  });

  it("dateTime change DOES reset notificationSent", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({
      dateTime: new Date("2026-05-10T09:00:00.000Z"),
      notificationSent: true,
    });

    const req = createRequest("PUT", `/api/reminders/${id}`, {
      body: {
        title: "Past due reminder",
        dateTime: "2026-06-01T10:00:00.000Z",
      },
    });
    const res = await PUT(req, params({ id }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.notificationSent).toBe(false);
  });

  it("PATCH title-only does NOT reset notificationSent (regression)", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ notificationSent: true });

    const req = createRequest("PATCH", `/api/reminders/${id}`, {
      body: { title: "Renamed via PATCH" },
    });
    const res = await PATCH(req, params({ id }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data.notificationSent).toBe(true);
  });
});
