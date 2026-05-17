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

    // Verify notificationSent flipped, notifiedAt set, no lease residue.
    const doc = await db
      .collection("reminders")
      .findOne({ _id: reminderId });
    expect(doc.notificationSent).toBe(true);
    expect(doc.notifiedAt).toBeInstanceOf(Date);
    expect(doc.notificationLeaseUntil).toBeUndefined();
  });

  it("no subs: claim still flips notificationSent (fire-and-forget); second cron skips reminder", async () => {
    const db = getDb();
    const reminderId = new ObjectId();
    await db.collection("reminders").insertOne({
      _id: reminderId,
      title: "No sub task",
      dateTime: new Date(Date.now() - 60000),
      userId: "user-no-sub",
      status: "pending",
      notificationSent: false,
    });
    // No push_subscriptions for this user.

    let req = createCronRequest("/api/cron/notify", CRON_SECRET);
    let res = await notifyGET(req);
    let parsed = await parseResponse(res);
    expect(parsed.status).toBe(200);
    expect(parsed.body.processed).toBe(1);
    expect(parsed.body.no_subs).toBe(1);
    expect(parsed.body.sent).toBe(0);

    // Reminder IS claimed — no retro-delivery across crons.
    let doc = await db
      .collection("reminders")
      .findOne({ _id: reminderId });
    expect(doc.notificationSent).toBe(true);
    expect(doc.notifiedAt).toBeInstanceOf(Date);
    expect(doc.notificationLeaseUntil).toBeUndefined();

    // Second cron tick: even if user later enabled push, the reminder is
    // already claimed and won't be re-picked.
    await db.collection("push_subscriptions").insertOne({
      userId: "user-no-sub",
      endpoint: "https://push.example.com/late",
      keys: { p256dh: "k1", auth: "k2" },
      updatedAt: new Date(),
    });

    req = createCronRequest("/api/cron/notify", CRON_SECRET);
    res = await notifyGET(req);
    parsed = await parseResponse(res);
    expect(parsed.body.processed).toBe(0);
    expect(parsed.body.sent).toBe(0);
    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  it("all 410: cleans subs AND claims reminder (no retro-delivery)", async () => {
    const db = getDb();
    const reminderId = new ObjectId();
    await db.collection("reminders").insertOne({
      _id: reminderId,
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

    let req = createCronRequest("/api/cron/notify", CRON_SECRET);
    let res = await notifyGET(req);
    let parsed = await parseResponse(res);
    expect(parsed.status).toBe(200);
    expect(parsed.body.cleaned).toBe(1);
    expect(parsed.body.all_gone).toBe(1);
    expect(parsed.body.sent).toBe(0);

    const sub = await db
      .collection("push_subscriptions")
      .findOne({ _id: subId });
    expect(sub).toBeNull();

    // Reminder IS claimed despite nothing being delivered — per RFC 8030,
    // we don't retro-deliver after a transport-level cleanup.
    const doc = await db
      .collection("reminders")
      .findOne({ _id: reminderId });
    expect(doc.notificationSent).toBe(true);
    expect(doc.notificationLeaseUntil).toBeUndefined();

    // Second cron: reminder no longer eligible.
    req = createCronRequest("/api/cron/notify", CRON_SECRET);
    res = await notifyGET(req);
    parsed = await parseResponse(res);
    expect(parsed.body.processed).toBe(0);
  });

  it("transient 500 exhausted: claims reminder, failed=1, no cross-cron retry", async () => {
    const db = getDb();
    const reminderId = new ObjectId();
    await db.collection("reminders").insertOne({
      _id: reminderId,
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

    let req = createCronRequest("/api/cron/notify", CRON_SECRET);
    let res = await notifyGET(req);
    let parsed = await parseResponse(res);
    expect(parsed.status).toBe(200);
    expect(parsed.body.failed).toBe(1);
    expect(parsed.body.sent).toBe(0);
    // Default retry policy: 3 in-tick attempts before giving up.
    expect(sendPushNotification).toHaveBeenCalledTimes(3);

    let doc = await db
      .collection("reminders")
      .findOne({ _id: reminderId });
    expect(doc.notificationSent).toBe(true);
    expect(doc.notificationLeaseUntil).toBeUndefined();

    // Push provider recovers; second cron does NOT retry — fire-and-forget.
    sendPushNotification.mockClear();
    sendPushNotification.mockResolvedValue({
      success: true,
      statusCode: 201,
    });
    req = createCronRequest("/api/cron/notify", CRON_SECRET);
    res = await notifyGET(req);
    parsed = await parseResponse(res);
    expect(parsed.body.processed).toBe(0);
    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  it("partial success: one ok, one 410, one 500 — claims reminder, cleans stale sub, counts failure", async () => {
    const db = getDb();
    const reminderId = new ObjectId();
    await db.collection("reminders").insertOne({
      _id: reminderId,
      title: "Partial",
      dateTime: new Date(Date.now() - 60000),
      userId: "user-mixed",
      status: "pending",
      notificationSent: false,
    });
    const goneId = new ObjectId();
    await db.collection("push_subscriptions").insertMany([
      {
        userId: "user-mixed",
        endpoint: "https://push.example.com/ok",
        keys: { p256dh: "k1", auth: "k2" },
        updatedAt: new Date(),
      },
      {
        _id: goneId,
        userId: "user-mixed",
        endpoint: "https://push.example.com/gone",
        keys: { p256dh: "k1", auth: "k2" },
        updatedAt: new Date(),
      },
      {
        userId: "user-mixed",
        endpoint: "https://push.example.com/err",
        keys: { p256dh: "k1", auth: "k2" },
        updatedAt: new Date(),
      },
    ]);

    // ok succeeds first try; 410 terminal first try; 500 fails 3x (exhaust).
    sendPushNotification
      .mockResolvedValueOnce({ success: true, statusCode: 201 })
      .mockResolvedValueOnce({ success: false, statusCode: 410 })
      .mockResolvedValue({ success: false, statusCode: 500, error: "x" });

    const req = createCronRequest("/api/cron/notify", CRON_SECRET);
    const res = await notifyGET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.sent).toBe(1);
    expect(body.cleaned).toBe(1);
    expect(body.failed).toBe(1);
    expect(body.partial_success).toBe(1);

    // 410 sub deleted; reminder marked sent.
    const gone = await db
      .collection("push_subscriptions")
      .findOne({ _id: goneId });
    expect(gone).toBeNull();
    const doc = await db
      .collection("reminders")
      .findOne({ _id: reminderId });
    expect(doc.notificationSent).toBe(true);
    expect(doc.notifiedAt).toBeInstanceOf(Date);
  });

  it("concurrent crons: only one claim wins, no double-send", async () => {
    const db = getDb();
    const reminderId = new ObjectId();
    await db.collection("reminders").insertOne({
      _id: reminderId,
      title: "Race",
      dateTime: new Date(Date.now() - 60_000),
      userId: "user-race",
      status: "pending",
      notificationSent: false,
    });
    await db.collection("push_subscriptions").insertOne({
      userId: "user-race",
      endpoint: "https://push.example.com/race",
      keys: { p256dh: "k1", auth: "k2" },
      updatedAt: new Date(),
    });

    sendPushNotification.mockResolvedValue({
      success: true,
      statusCode: 201,
    });

    const req1 = createCronRequest("/api/cron/notify", CRON_SECRET);
    const req2 = createCronRequest("/api/cron/notify", CRON_SECRET);
    const [res1, res2] = await Promise.all([notifyGET(req1), notifyGET(req2)]);
    const p1 = await parseResponse(res1);
    const p2 = await parseResponse(res2);

    // Exactly one cron processes the reminder; the other sees it already
    // claimed and counts processed=0.
    const sentTotal = (p1.body.sent ?? 0) + (p2.body.sent ?? 0);
    const processedTotal =
      (p1.body.processed ?? 0) + (p2.body.processed ?? 0);
    expect(sentTotal).toBe(1);
    expect(processedTotal).toBe(1);
    expect(sendPushNotification).toHaveBeenCalledTimes(1);

    const doc = await db
      .collection("reminders")
      .findOne({ _id: reminderId });
    expect(doc.notificationSent).toBe(true);
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
