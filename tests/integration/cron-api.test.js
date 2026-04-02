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
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";

// NOTE: Do NOT import from ../helpers/api.js here — its module-level
// vi.mock("@/lib/db.js") would conflict with ours below.

// Mock db — must be at module level (Vitest hoists vi.mock)
vi.mock("@/lib/db.js", () => ({
  getCollection: async (name) => {
    const { getDb: _getDb } = await import("../helpers/db.js");
    return _getDb().collection(name);
  },
}));

function createCronRequest(pathname, secret) {
  const url = new URL(pathname, "http://localhost:3000");
  const headers = {};
  if (secret) {
    headers["authorization"] = `Bearer ${secret}`;
  }
  return new Request(url.toString(), { method: "GET", headers });
}

async function parseResponse(response) {
  const status = response.status;
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status, body };
}

// Mock push notifications
vi.mock("@/lib/push.js", () => ({
  sendPushNotification: vi.fn(),
}));

// Import routes AFTER mocks
const { GET: notifyGET } = await import("@/app/api/cron/notify/route.js");
const { GET: unsnoozeGET } = await import("@/app/api/cron/unsnooze/route.js");
const { GET: cleanupGET } = await import(
  "@/app/api/cron/cleanup-subscriptions/route.js"
);
const { sendPushNotification } = await import("@/lib/push.js");

const CRON_SECRET = "test-cron-secret";

beforeAll(async () => {
  vi.stubEnv("CRON_SECRET", CRON_SECRET);
  await startDb("test_cron_api");
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// cron/notify
// ---------------------------------------------------------------------------
describe("GET /api/cron/notify", () => {
  it("returns 401 without CRON_SECRET header", async () => {
    const req = createCronRequest("/api/cron/notify");
    const res = await notifyGET(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("returns 401 with wrong CRON_SECRET", async () => {
    const req = createCronRequest("/api/cron/notify", "wrong-secret");
    const res = await notifyGET(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("returns 401 when CRON_SECRET env is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const req = createCronRequest("/api/cron/notify", CRON_SECRET);
    const res = await notifyGET(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
    // Restore for subsequent tests
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
  });

  it("sends notification for due reminder (happy path)", async () => {
    const db = getDb();
    const reminderId = new ObjectId();
    await db.collection("reminders").insertOne({
      _id: reminderId,
      title: "Due task",
      dateTime: new Date(Date.now() - 60000), // 1 min ago
      userId: "user-1",
      status: "pending",
      notificationSent: false,
    });
    await db.collection("push_subscriptions").insertOne({
      userId: "user-1",
      endpoint: "https://push.example.com/abc",
      keys: { p256dh: "key1", auth: "key2" },
      updatedAt: new Date(),
    });

    sendPushNotification.mockResolvedValue({
      success: true,
      statusCode: 201,
    });

    const req = createCronRequest("/api/cron/notify", CRON_SECRET);
    const res = await notifyGET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.sent).toBe(1);

    // Verify notificationSent flipped in DB
    const doc = await db
      .collection("reminders")
      .findOne({ _id: reminderId });
    expect(doc.notificationSent).toBe(true);
  });

  it("skips reminder with no push subscriptions", async () => {
    const db = getDb();
    await db.collection("reminders").insertOne({
      title: "No sub task",
      dateTime: new Date(Date.now() - 60000),
      userId: "user-no-sub",
      status: "pending",
      notificationSent: false,
    });
    // No push_subscriptions for this user

    const req = createCronRequest("/api/cron/notify", CRON_SECRET);
    const res = await notifyGET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.processed).toBe(1);
    expect(body.sent).toBe(0);
  });

  it("cleans up expired subscriptions (410)", async () => {
    const db = getDb();
    await db.collection("reminders").insertOne({
      title: "Cleanup task",
      dateTime: new Date(Date.now() - 60000),
      userId: "user-expired",
      status: "pending",
      notificationSent: false,
    });
    const subId = new ObjectId();
    await db.collection("push_subscriptions").insertOne({
      _id: subId,
      userId: "user-expired",
      endpoint: "https://push.example.com/gone",
      keys: { p256dh: "k1", auth: "k2" },
      updatedAt: new Date(),
    });

    sendPushNotification.mockResolvedValue({
      success: false,
      statusCode: 410,
    });

    const req = createCronRequest("/api/cron/notify", CRON_SECRET);
    const res = await notifyGET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.cleaned).toBe(1);

    // Verify subscription deleted
    const sub = await db
      .collection("push_subscriptions")
      .findOne({ _id: subId });
    expect(sub).toBeNull();
  });

  it("counts failed pushes", async () => {
    const db = getDb();
    await db.collection("reminders").insertOne({
      title: "Fail task",
      dateTime: new Date(Date.now() - 60000),
      userId: "user-fail",
      status: "in_progress",
      notificationSent: false,
    });
    await db.collection("push_subscriptions").insertOne({
      userId: "user-fail",
      endpoint: "https://push.example.com/err",
      keys: { p256dh: "k1", auth: "k2" },
      updatedAt: new Date(),
    });

    sendPushNotification.mockResolvedValue({
      success: false,
      statusCode: 500,
      error: "err",
    });

    const req = createCronRequest("/api/cron/notify", CRON_SECRET);
    const res = await notifyGET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.failed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// cron/unsnooze
// ---------------------------------------------------------------------------
describe("GET /api/cron/unsnooze", () => {
  it("returns 401 without CRON_SECRET header", async () => {
    const req = createCronRequest("/api/cron/unsnooze");
    const res = await unsnoozeGET(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("reactivates expired snoozed reminders", async () => {
    const db = getDb();
    const id = new ObjectId();
    await db.collection("reminders").insertOne({
      _id: id,
      title: "Snoozed past",
      status: "snoozed",
      completed: true,
      snoozedUntil: new Date(Date.now() - 60000), // expired
      userId: "user-1",
    });

    const req = createCronRequest("/api/cron/unsnooze", CRON_SECRET);
    const res = await unsnoozeGET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.reactivated).toBe(1);

    const doc = await db.collection("reminders").findOne({ _id: id });
    expect(doc.status).toBe("pending");
    expect(doc.completed).toBe(false);
    expect(doc.snoozedUntil).toBeNull();
  });

  it("does NOT reactivate non-expired snoozed reminders", async () => {
    const db = getDb();
    const id = new ObjectId();
    await db.collection("reminders").insertOne({
      _id: id,
      title: "Snoozed future",
      status: "snoozed",
      completed: true,
      snoozedUntil: new Date(Date.now() + 86400000), // tomorrow
      userId: "user-1",
    });

    const req = createCronRequest("/api/cron/unsnooze", CRON_SECRET);
    const res = await unsnoozeGET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.reactivated).toBe(0);

    // Verify still snoozed
    const doc = await db.collection("reminders").findOne({ _id: id });
    expect(doc.status).toBe("snoozed");
  });
});

// ---------------------------------------------------------------------------
// cron/cleanup-subscriptions
// ---------------------------------------------------------------------------
describe("GET /api/cron/cleanup-subscriptions", () => {
  it("returns 401 without CRON_SECRET header", async () => {
    const req = createCronRequest("/api/cron/cleanup-subscriptions");
    const res = await cleanupGET(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("deletes subscriptions older than 30 days", async () => {
    const db = getDb();
    const oldId = new ObjectId();
    const recentId = new ObjectId();
    const thirtyOneDaysAgo = new Date(
      Date.now() - 31 * 24 * 60 * 60 * 1000,
    );

    await db.collection("push_subscriptions").insertMany([
      {
        _id: oldId,
        userId: "user-1",
        endpoint: "https://push.example.com/old",
        keys: { p256dh: "k1", auth: "k2" },
        updatedAt: thirtyOneDaysAgo,
      },
      {
        _id: recentId,
        userId: "user-1",
        endpoint: "https://push.example.com/new",
        keys: { p256dh: "k1", auth: "k2" },
        updatedAt: new Date(),
      },
    ]);

    const req = createCronRequest(
      "/api/cron/cleanup-subscriptions",
      CRON_SECRET,
    );
    const res = await cleanupGET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.deleted).toBe(1);

    // Verify only old one deleted
    const old = await db
      .collection("push_subscriptions")
      .findOne({ _id: oldId });
    const recent = await db
      .collection("push_subscriptions")
      .findOne({ _id: recentId });
    expect(old).toBeNull();
    expect(recent).not.toBeNull();
  });
});
