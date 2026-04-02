import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";
import {
  setupApiMocks,
  mockSession,
  createRequest,
  parseResponse,
} from "../helpers/api.js";

// Setup mocks BEFORE importing route handlers
setupApiMocks(getDb);

const { POST } = await import("@/app/api/notes/reorder/route.js");

const TEST_USER = { id: "user-abc", username: "testuser", role: "user" };

beforeAll(async () => {
  await startDb("test_notes_reorder_api");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
});

async function insertNote(overrides = {}) {
  const db = getDb();
  const now = new Date();
  const result = await db.collection("notes").insertOne({
    userId: TEST_USER.id,
    title: "Note",
    parentId: null,
    content: [],
    icon: null,
    sortOrder: 1000,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
  return result.insertedId.toString();
}

describe("POST /api/notes/reorder", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const req = createRequest("POST", "/api/notes/reorder", {
      body: { updates: [] },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("rejects empty updates array", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/notes/reorder", {
      body: { updates: [] },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/updates array is required/i);
  });

  it("batch updates sortOrder and parentId", async () => {
    mockSession(TEST_USER);
    const id1 = await insertNote({ title: "Note A", sortOrder: 1000 });
    const id2 = await insertNote({ title: "Note B", sortOrder: 2000 });

    const req = createRequest("POST", "/api/notes/reorder", {
      body: {
        updates: [
          { id: id1, sortOrder: 3000, parentId: null },
          { id: id2, sortOrder: 1000, parentId: id1 },
        ],
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.matched).toBe(2);

    // Verify DB state
    const db = getDb();
    const n1 = await db.collection("notes").findOne({ _id: new ObjectId(id1) });
    const n2 = await db.collection("notes").findOne({ _id: new ObjectId(id2) });
    expect(n1.sortOrder).toBe(3000);
    expect(n1.parentId).toBeNull();
    expect(n2.sortOrder).toBe(1000);
    expect(n2.parentId.toString()).toBe(id1);
  });

  it("cannot reorder another user's notes (user isolation)", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    const now = new Date();
    const result = await db.collection("notes").insertOne({
      userId: "other-user",
      title: "Other Note",
      parentId: null,
      content: [],
      icon: null,
      sortOrder: 1000,
      createdAt: now,
      updatedAt: now,
    });
    const otherId = result.insertedId.toString();

    const req = createRequest("POST", "/api/notes/reorder", {
      body: { updates: [{ id: otherId, sortOrder: 9999, parentId: null }] },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.matched).toBe(0);

    // Verify sortOrder unchanged
    const doc = await db.collection("notes").findOne({ _id: result.insertedId });
    expect(doc.sortOrder).toBe(1000);
  });
});
