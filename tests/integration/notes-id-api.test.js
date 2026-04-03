import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";
import {
  setupApiMocks,
  mockSession,
  createRequest,
  parseResponse,
  params,
} from "../helpers/api.js";

// Setup mocks BEFORE importing route handlers
setupApiMocks(getDb);

const { GET, PATCH, DELETE } = await import(
  "@/app/api/notes/[noteId]/route.js"
);

const TEST_USER = { id: "user-abc", username: "testuser", role: "user" };

beforeAll(async () => {
  await startDb("test_notes_id_api");
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
    title: "Test Note",
    parentId: null,
    content: [],
    icon: null,
    sortOrder: 1000,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
  return result.insertedId;
}

describe("GET /api/notes/[noteId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const noteId = new ObjectId().toString();
    const req = createRequest("GET", `/api/notes/${noteId}`);
    const res = await GET(req, params({ noteId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns the note with content", async () => {
    mockSession(TEST_USER);
    const content = [{ type: "paragraph", content: "Hello" }];
    const noteObjectId = await insertNote({ title: "My Note", content });
    const noteId = noteObjectId.toString();

    const req = createRequest("GET", `/api/notes/${noteId}`);
    const res = await GET(req, params({ noteId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("My Note");
    expect(body.data.content).toEqual(content);
    expect(body.data.id).toBe(noteId);
  });

  it("returns 404 when note does not exist", async () => {
    mockSession(TEST_USER);
    const noteId = new ObjectId().toString();
    const req = createRequest("GET", `/api/notes/${noteId}`);
    const res = await GET(req, params({ noteId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });

  it("returns 404 when note belongs to another user", async () => {
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
    const noteId = result.insertedId.toString();

    const req = createRequest("GET", `/api/notes/${noteId}`);
    const res = await GET(req, params({ noteId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(404);
  });
});

describe("PATCH /api/notes/[noteId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const noteId = new ObjectId().toString();
    const req = createRequest("PATCH", `/api/notes/${noteId}`, {
      body: { title: "Updated" },
    });
    const res = await PATCH(req, params({ noteId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("updates the title", async () => {
    mockSession(TEST_USER);
    const noteObjectId = await insertNote({ title: "Original" });
    const noteId = noteObjectId.toString();

    const req = createRequest("PATCH", `/api/notes/${noteId}`, {
      body: { title: "Updated Title" },
    });
    const res = await PATCH(req, params({ noteId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("Updated Title");
  });

  it("updates content", async () => {
    mockSession(TEST_USER);
    const noteObjectId = await insertNote();
    const noteId = noteObjectId.toString();
    const newContent = [{ type: "heading", content: "Hello World" }];

    const req = createRequest("PATCH", `/api/notes/${noteId}`, {
      body: { content: newContent },
    });
    const res = await PATCH(req, params({ noteId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.content).toEqual(newContent);
  });

  it("updates parentId", async () => {
    mockSession(TEST_USER);
    const parentObjectId = await insertNote({ title: "Parent" });
    const parentId = parentObjectId.toString();
    const childObjectId = await insertNote({ title: "Child", parentId: null });
    const noteId = childObjectId.toString();

    const req = createRequest("PATCH", `/api/notes/${noteId}`, {
      body: { parentId },
    });
    const res = await PATCH(req, params({ noteId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.data.parentId).toBe(parentId);
  });

  it("returns 404 when note does not exist", async () => {
    mockSession(TEST_USER);
    const noteId = new ObjectId().toString();
    const req = createRequest("PATCH", `/api/notes/${noteId}`, {
      body: { title: "Updated" },
    });
    const res = await PATCH(req, params({ noteId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });
});

describe("DELETE /api/notes/[noteId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const noteId = new ObjectId().toString();
    const req = createRequest("DELETE", `/api/notes/${noteId}`);
    const res = await DELETE(req, params({ noteId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("cascades soft-delete to children and grandchildren", async () => {
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
    const parentId = parentResult.insertedId;

    const childResult = await db.collection("notes").insertOne({
      userId: TEST_USER.id,
      title: "Child",
      parentId,
      content: [],
      icon: null,
      sortOrder: 1000,
      createdAt: now,
      updatedAt: now,
    });
    const childId = childResult.insertedId;

    const grandchildResult = await db.collection("notes").insertOne({
      userId: TEST_USER.id,
      title: "Grandchild",
      parentId: childId,
      content: [],
      icon: null,
      sortOrder: 1000,
      createdAt: now,
      updatedAt: now,
    });

    const noteId = parentId.toString();
    const req = createRequest("DELETE", `/api/notes/${noteId}`);
    const res = await DELETE(req, params({ noteId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.deleted).toBe(3);

    // Verify all 3 notes still exist but have deletedAt set
    const parent = await db
      .collection("notes")
      .findOne({ _id: parentId });
    const child = await db
      .collection("notes")
      .findOne({ _id: childId });
    const grandchild = await db
      .collection("notes")
      .findOne({ _id: grandchildResult.insertedId });
    expect(parent.deletedAt).toBeInstanceOf(Date);
    expect(child.deletedAt).toBeInstanceOf(Date);
    expect(grandchild.deletedAt).toBeInstanceOf(Date);
  });

  it("returns 404 when note does not exist", async () => {
    mockSession(TEST_USER);
    const noteId = new ObjectId().toString();
    const req = createRequest("DELETE", `/api/notes/${noteId}`);
    const res = await DELETE(req, params({ noteId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });
});

describe("DELETE /api/notes/[noteId] - soft delete", () => {
  it("soft deletes a note by setting deletedAt", async () => {
    mockSession(TEST_USER);
    const id = await insertNote({ title: "To Soft Delete" });

    const noteId = id.toString();
    const res = await DELETE(
      createRequest("DELETE", `/api/notes/${noteId}`),
      params({ noteId }),
    );
    const body = await parseResponse(res);

    expect(body.status).toBe(200);
    expect(body.body.success).toBe(true);

    // Verify note still exists in DB but has deletedAt set
    const db = getDb();
    const note = await db.collection("notes").findOne({ _id: id });
    expect(note).not.toBeNull();
    expect(note.deletedAt).toBeInstanceOf(Date);
  });

  it("soft deletes descendants when deleting parent", async () => {
    mockSession(TEST_USER);
    const parentId = await insertNote({ title: "Parent" });
    const childId = await insertNote({
      title: "Child",
      parentId: parentId,
    });

    const noteId = parentId.toString();
    await DELETE(
      createRequest("DELETE", `/api/notes/${noteId}`),
      params({ noteId }),
    );

    const db = getDb();
    const parent = await db.collection("notes").findOne({ _id: parentId });
    const child = await db.collection("notes").findOne({ _id: childId });
    expect(parent.deletedAt).toBeInstanceOf(Date);
    expect(child.deletedAt).toBeInstanceOf(Date);
  });

  it("permanently deletes a note that is already in trash", async () => {
    mockSession(TEST_USER);
    const id = await insertNote({ title: "In Trash", deletedAt: new Date() });

    const noteId = id.toString();
    const res = await DELETE(
      createRequest("DELETE", `/api/notes/${noteId}`),
      params({ noteId }),
    );
    const body = await parseResponse(res);

    expect(body.status).toBe(200);
    expect(body.body.success).toBe(true);

    const db = getDb();
    const note = await db.collection("notes").findOne({ _id: id });
    expect(note).toBeNull();
  });

  it("GET excludes soft-deleted notes", async () => {
    mockSession(TEST_USER);
    await insertNote({ title: "Active" });
    await insertNote({ title: "Deleted", deletedAt: new Date() });

    const { GET: listGET } = await import("@/app/api/notes/route.js");
    const res = await listGET();
    const body = await parseResponse(res);

    expect(body.body.data).toHaveLength(1);
    expect(body.body.data[0].title).toBe("Active");
  });
});
