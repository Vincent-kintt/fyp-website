import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";
import {
  setupApiMocks,
  mockSession,
  createRequest,
  parseResponse,
} from "../helpers/api.js";

// Setup mocks BEFORE importing route handlers
setupApiMocks(getDb);

const { GET, POST, PATCH } = await import("@/app/api/inbox/note/route.js");

const TEST_USER = { id: "user-inbox-a", username: "userA", role: "user" };
const OTHER_USER = { id: "user-inbox-b", username: "userB", role: "user" };

beforeAll(async () => {
  await startDb("test_inbox_note_api");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
});

async function seedInbox(userId, overrides = {}) {
  const db = getDb();
  const now = new Date();
  const result = await db.collection("notes").insertOne({
    userId,
    type: "inbox",
    title: "Inbox",
    parentId: null,
    content: [],
    icon: null,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  });
  return result.insertedId;
}

describe("GET /api/inbox/note", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const req = createRequest("GET", "/api/inbox/note");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 200 + inbox note when one exists for the user", async () => {
    mockSession(TEST_USER);
    const id = await seedInbox(TEST_USER.id);

    const req = createRequest("GET", "/api/inbox/note");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(id.toString());
    expect(body.data.title).toBe("Inbox");
    expect(body.data.content).toEqual([]);
  });

  it("returns 404 + error envelope when no inbox note exists", async () => {
    mockSession(TEST_USER);

    const req = createRequest("GET", "/api/inbox/note");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/not found/i);
  });

  it("isolates users: A's GET does not return B's inbox", async () => {
    mockSession(TEST_USER);
    await seedInbox(OTHER_USER.id, { title: "B inbox" });

    const req = createRequest("GET", "/api/inbox/note");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });

  it("sets Cache-Control: private, no-store on the response", async () => {
    // Auth-scoped responses must never be cached by edge proxies / CDNs —
    // otherwise one user's inbox could leak to another. Verified on the
    // 200 path; the same header is set regardless of body.
    mockSession(TEST_USER);
    await seedInbox(TEST_USER.id);

    const req = createRequest("GET", "/api/inbox/note");
    const res = await GET(req);

    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

describe("POST /api/inbox/note", () => {
  it("creates the inbox note when missing", async () => {
    mockSession(TEST_USER);

    const req = createRequest("POST", "/api/inbox/note");
    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("Inbox");
    expect(body.data.id).toBeDefined();

    // Confirm a single inbox doc exists for the user
    const db = getDb();
    const docs = await db
      .collection("notes")
      .find({ userId: TEST_USER.id, type: "inbox" })
      .toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0]._id.toString()).toBe(body.data.id);
  });

  it("is idempotent: returns the existing inbox note when one exists", async () => {
    mockSession(TEST_USER);
    const existingId = await seedInbox(TEST_USER.id);

    const req = createRequest("POST", "/api/inbox/note");
    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(existingId.toString());

    const db = getDb();
    const count = await db
      .collection("notes")
      .countDocuments({ userId: TEST_USER.id, type: "inbox" });
    expect(count).toBe(1);
  });

  it("POST on existing inbox does not mutate updatedAt", async () => {
    mockSession(TEST_USER);
    const seededUpdatedAt = new Date("2020-01-01T00:00:00.000Z");
    await seedInbox(TEST_USER.id, { updatedAt: seededUpdatedAt });

    const req = createRequest("POST", "/api/inbox/note");
    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(new Date(body.data.updatedAt).toISOString()).toBe(
      seededUpdatedAt.toISOString(),
    );

    // Confirm the DB doc itself was not mutated.
    const db = getDb();
    const doc = await db
      .collection("notes")
      .findOne({ userId: TEST_USER.id, type: "inbox" });
    expect(doc.updatedAt.toISOString()).toBe(seededUpdatedAt.toISOString());
  });
});

describe("PATCH /api/inbox/note", () => {
  it("returns 404 when no inbox note exists (does not auto-create)", async () => {
    mockSession(TEST_USER);

    const req = createRequest("PATCH", "/api/inbox/note", {
      body: { content: [{ type: "paragraph", content: [] }] },
    });
    const res = await PATCH(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body.success).toBe(false);

    const db = getDb();
    const count = await db
      .collection("notes")
      .countDocuments({ userId: TEST_USER.id, type: "inbox" });
    expect(count).toBe(0);
  });
});
