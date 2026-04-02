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

const { GET, POST } = await import("@/app/api/notes/route.js");

const TEST_USER = { id: "user-abc", username: "testuser", role: "user" };

beforeAll(async () => {
  await startDb("test_notes_api");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
});

describe("GET /api/notes", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const req = createRequest("GET", "/api/notes");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns only the current user's notes", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    const now = new Date();
    await db.collection("notes").insertMany([
      {
        userId: TEST_USER.id,
        title: "My Note",
        parentId: null,
        content: [],
        icon: null,
        sortOrder: 1000,
        createdAt: now,
        updatedAt: now,
      },
      {
        userId: "other-user",
        title: "Other Note",
        parentId: null,
        content: [],
        icon: null,
        sortOrder: 1000,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const req = createRequest("GET", "/api/notes");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("My Note");
  });

  it("sorts notes by updatedAt descending", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    const older = new Date("2024-01-01T00:00:00Z");
    const newer = new Date("2024-06-01T00:00:00Z");
    await db.collection("notes").insertMany([
      {
        userId: TEST_USER.id,
        title: "Old Note",
        parentId: null,
        content: [],
        icon: null,
        sortOrder: 1000,
        createdAt: older,
        updatedAt: older,
      },
      {
        userId: TEST_USER.id,
        title: "New Note",
        parentId: null,
        content: [],
        icon: null,
        sortOrder: 2000,
        createdAt: newer,
        updatedAt: newer,
      },
    ]);

    const req = createRequest("GET", "/api/notes");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data[0].title).toBe("New Note");
    expect(body.data[1].title).toBe("Old Note");
  });
});

describe("POST /api/notes", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const req = createRequest("POST", "/api/notes", {
      body: { title: "New Note" },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("creates a root-level note", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/notes", {
      body: { title: "Root Note" },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("Root Note");
    expect(body.data.parentId).toBeNull();
    expect(body.data.sortOrder).toBe(1000);
    expect(body.data.id).toBeDefined();
  });

  it("creates a child note with parentId", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    const now = new Date();
    const parentResult = await db.collection("notes").insertOne({
      userId: TEST_USER.id,
      title: "Parent",
      parentId: null,
      content: [],
      icon: null,
      sortOrder: 1000,
      createdAt: now,
      updatedAt: now,
    });
    const parentId = parentResult.insertedId.toString();

    const req = createRequest("POST", "/api/notes", {
      body: { title: "Child Note", parentId },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("Child Note");
    expect(body.data.parentId).toBe(parentId);
  });

  it("auto-increments sortOrder for siblings", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    const now = new Date();
    await db.collection("notes").insertOne({
      userId: TEST_USER.id,
      title: "First",
      parentId: null,
      content: [],
      icon: null,
      sortOrder: 1000,
      createdAt: now,
      updatedAt: now,
    });

    const req = createRequest("POST", "/api/notes", {
      body: { title: "Second" },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(201);
    expect(body.data.sortOrder).toBe(2000);
  });

  it("rejects empty title", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/notes", {
      body: { title: "  " },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("rejects title exceeding 200 characters", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", "/api/notes", {
      body: { title: "x".repeat(201) },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/200/);
  });
});
