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

const { GET: getSubscriptions, POST: postSubscriptions } = await import(
  "@/app/api/rss/route.js"
);
const { GET: getCatalog } = await import("@/app/api/rss/catalog/route.js");
const { DELETE: deleteSubscription } = await import(
  "@/app/api/rss/[subscriptionId]/route.js"
);

const TEST_USER = { id: "user-abc", username: "testuser", role: "user" };
const OTHER_USER = { id: "user-xyz", username: "otheruser", role: "user" };

async function insertFeed(overrides = {}) {
  const db = getDb();
  const doc = {
    url: "https://example.com/feed",
    title: "Example Feed",
    category: "technology",
    isDefault: true,
    ...overrides,
  };
  const result = await db.collection("rssFeeds").insertOne(doc);
  return result.insertedId;
}

async function insertSubscription(userId, feedId, overrides = {}) {
  const db = getDb();
  const doc = {
    userId,
    feedId,
    subscribedAt: new Date(),
    ...overrides,
  };
  const result = await db.collection("rssSubscriptions").insertOne(doc);
  return result.insertedId;
}

beforeAll(async () => {
  await startDb("test_rss_api");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
});

// ---------------------------------------------------------------------------
// GET /api/rss
// ---------------------------------------------------------------------------
describe("GET /api/rss", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const req = createRequest("GET", "/api/rss");
    const res = await getSubscriptions(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns empty array when user has no subscriptions", async () => {
    mockSession(TEST_USER);
    const req = createRequest("GET", "/api/rss");
    const res = await getSubscriptions(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it("returns user's subscriptions with feed details", async () => {
    mockSession(TEST_USER);
    const feedId = await insertFeed({ title: "Hacker News", category: "technology" });
    await insertSubscription(TEST_USER.id, feedId);

    const req = createRequest("GET", "/api/rss");
    const res = await getSubscriptions(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Hacker News");
    expect(body.data[0].category).toBe("technology");
    expect(body.data[0].id).toBeDefined();
  });

  it("does not return other users' subscriptions", async () => {
    mockSession(TEST_USER);
    const feedId = await insertFeed();
    await insertSubscription(OTHER_USER.id, feedId);

    const req = createRequest("GET", "/api/rss");
    const res = await getSubscriptions(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GET /api/rss/catalog
// ---------------------------------------------------------------------------
describe("GET /api/rss/catalog", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const req = createRequest("GET", "/api/rss/catalog");
    const res = await getCatalog(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns empty object when no default feeds", async () => {
    mockSession(TEST_USER);
    const req = createRequest("GET", "/api/rss/catalog");
    const res = await getCatalog(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data).toEqual({});
  });

  it("returns default feeds grouped by category", async () => {
    mockSession(TEST_USER);
    await insertFeed({ title: "TechCrunch", category: "technology" });
    await insertFeed({ title: "Nature News", category: "science" });
    await insertFeed({ title: "Wired", category: "technology" });
    // non-default feed should be excluded
    const db = getDb();
    await db.collection("rssFeeds").insertOne({
      url: "https://custom.com/feed",
      title: "Custom Feed",
      category: "technology",
      isDefault: false,
    });

    const req = createRequest("GET", "/api/rss/catalog");
    const res = await getCatalog(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.technology).toHaveLength(2);
    expect(body.data.science).toHaveLength(1);
    expect(body.data.technology.map((f) => f.title)).toContain("TechCrunch");
    expect(body.data.technology.map((f) => f.title)).toContain("Wired");
  });

  it("each feed entry has id, url, title, category", async () => {
    mockSession(TEST_USER);
    await insertFeed({ url: "https://hn.com/feed", title: "HN", category: "technology" });

    const req = createRequest("GET", "/api/rss/catalog");
    const res = await getCatalog(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    const feed = body.data.technology[0];
    expect(feed.id).toBeDefined();
    expect(feed.url).toBe("https://hn.com/feed");
    expect(feed.title).toBe("HN");
    expect(feed.category).toBe("technology");
  });
});

// ---------------------------------------------------------------------------
// POST /api/rss
// ---------------------------------------------------------------------------
describe("POST /api/rss", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const req = createRequest("POST", "/api/rss", {
      body: { categories: ["technology"] },
    });
    const res = await postSubscriptions(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 400 for empty categories array", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/rss", { body: { categories: [] } });
    const res = await postSubscriptions(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it("returns 400 for invalid category", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/rss", {
      body: { categories: ["nonexistent_category"] },
    });
    const res = await postSubscriptions(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it("returns 400 when no default feeds match the category", async () => {
    mockSession(TEST_USER);
    // valid category but no seeded feeds
    const req = createRequest("POST", "/api/rss", {
      body: { categories: ["technology"] },
    });
    const res = await postSubscriptions(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it("subscribes user to all feeds in category", async () => {
    mockSession(TEST_USER);
    await insertFeed({ title: "Feed A", category: "technology" });
    await insertFeed({ title: "Feed B", category: "technology" });

    const req = createRequest("POST", "/api/rss", {
      body: { categories: ["technology"] },
    });
    const res = await postSubscriptions(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.subscribed).toBe(2);
    expect(body.data.skipped).toBe(0);
  });

  it("skips already-subscribed feeds", async () => {
    mockSession(TEST_USER);
    const feedId = await insertFeed({ title: "Feed A", category: "technology" });
    await insertFeed({ title: "Feed B", category: "technology" });
    await insertSubscription(TEST_USER.id, feedId);

    const req = createRequest("POST", "/api/rss", {
      body: { categories: ["technology"] },
    });
    const res = await postSubscriptions(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.subscribed).toBe(1);
    expect(body.data.skipped).toBe(1);
  });

  it("subscribes to multiple categories at once", async () => {
    mockSession(TEST_USER);
    await insertFeed({ title: "Tech Feed", category: "technology" });
    await insertFeed({ title: "Science Feed", category: "science" });

    const req = createRequest("POST", "/api/rss", {
      body: { categories: ["technology", "science"] },
    });
    const res = await postSubscriptions(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.subscribed).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/rss/[subscriptionId]
// ---------------------------------------------------------------------------
describe("DELETE /api/rss/[subscriptionId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const feedId = await insertFeed();
    const subId = await insertSubscription(TEST_USER.id, feedId);
    const req = createRequest("DELETE", `/api/rss/${subId}`);
    const res = await deleteSubscription(req, params({ subscriptionId: subId.toString() }));
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("returns 400 for malformed subscription ID", async () => {
    mockSession(TEST_USER);
    const req = createRequest("DELETE", "/api/rss/not-an-objectid");
    const res = await deleteSubscription(
      req,
      params({ subscriptionId: "not-an-objectid" })
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it("returns 404 when subscription does not exist", async () => {
    mockSession(TEST_USER);
    const nonExistentId = new ObjectId().toString();
    const req = createRequest("DELETE", `/api/rss/${nonExistentId}`);
    const res = await deleteSubscription(
      req,
      params({ subscriptionId: nonExistentId })
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(404);
  });

  it("returns 404 when subscription belongs to another user", async () => {
    mockSession(TEST_USER);
    const feedId = await insertFeed();
    const subId = await insertSubscription(OTHER_USER.id, feedId);

    const req = createRequest("DELETE", `/api/rss/${subId}`);
    const res = await deleteSubscription(
      req,
      params({ subscriptionId: subId.toString() })
    );
    const { status } = await parseResponse(res);
    expect(status).toBe(404);
  });

  it("deletes the subscription and returns success", async () => {
    mockSession(TEST_USER);
    const feedId = await insertFeed();
    const subId = await insertSubscription(TEST_USER.id, feedId);

    const req = createRequest("DELETE", `/api/rss/${subId}`);
    const res = await deleteSubscription(
      req,
      params({ subscriptionId: subId.toString() })
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.deleted).toBe(true);

    // Verify actually deleted from DB
    const db = getDb();
    const remaining = await db
      .collection("rssSubscriptions")
      .findOne({ _id: subId });
    expect(remaining).toBeNull();
  });
});
