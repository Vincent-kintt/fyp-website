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

setupApiMocks(getDb);

const { GET } = await import("@/app/api/notes/trash/route.js");
const { POST: RESTORE } = await import(
  "@/app/api/notes/[noteId]/restore/route.js"
);

const TEST_USER = { id: "user-abc", username: "testuser", role: "user" };

beforeAll(async () => {
  await startDb("test_notes_trash_api");
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
    deletedAt: null,
    ...overrides,
  });
  return result.insertedId;
}

describe("GET /api/notes/trash", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const res = await GET();
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("returns only trashed notes", async () => {
    mockSession(TEST_USER);
    await insertNote({ title: "Active Note", deletedAt: null });
    await insertNote({ title: "Trashed Note", deletedAt: new Date() });

    const res = await GET();
    const { body } = await parseResponse(res);

    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Trashed Note");
  });

  it("sorts by deletedAt descending", async () => {
    mockSession(TEST_USER);
    const old = new Date("2026-01-01");
    const recent = new Date("2026-04-01");
    await insertNote({ title: "Old", deletedAt: old });
    await insertNote({ title: "Recent", deletedAt: recent });

    const res = await GET();
    const { body } = await parseResponse(res);

    expect(body.data[0].title).toBe("Recent");
    expect(body.data[1].title).toBe("Old");
  });
});

describe("POST /api/notes/[noteId]/restore", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const noteId = new ObjectId().toString();
    const req = createRequest("POST", `/api/notes/${noteId}/restore`);
    const res = await RESTORE(req, params({ noteId }));
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("restores a trashed note", async () => {
    mockSession(TEST_USER);
    const id = await insertNote({
      title: "Restore Me",
      deletedAt: new Date(),
    });
    const noteId = id.toString();

    const req = createRequest("POST", `/api/notes/${noteId}/restore`);
    const res = await RESTORE(req, params({ noteId }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.success).toBe(true);

    const db = getDb();
    const note = await db.collection("notes").findOne({ _id: id });
    expect(note.deletedAt).toBeNull();
  });

  it("restores descendants along with parent", async () => {
    mockSession(TEST_USER);
    const deletedAt = new Date();
    const parentId = await insertNote({ title: "Parent", deletedAt });
    const childId = await insertNote({
      title: "Child",
      parentId,
      deletedAt,
    });

    const noteId = parentId.toString();
    const req = createRequest("POST", `/api/notes/${noteId}/restore`);
    await RESTORE(req, params({ noteId }));

    const db = getDb();
    const parent = await db.collection("notes").findOne({ _id: parentId });
    const children = await db.collection("notes").find({ parentId }).toArray();
    expect(parent.deletedAt).toBeNull();
    expect(children[0].deletedAt).toBeNull();
  });

  it("restores to root if original parent no longer exists", async () => {
    mockSession(TEST_USER);
    const fakeParentId = new ObjectId();
    const id = await insertNote({
      title: "Orphan",
      parentId: fakeParentId,
      deletedAt: new Date(),
    });

    const noteId = id.toString();
    const req = createRequest("POST", `/api/notes/${noteId}/restore`);
    await RESTORE(req, params({ noteId }));

    const db = getDb();
    const note = await db.collection("notes").findOne({ _id: id });
    expect(note.deletedAt).toBeNull();
    expect(note.parentId).toBeNull();
  });
});
