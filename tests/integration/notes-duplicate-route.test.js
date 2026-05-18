/**
 * Integration tests for POST /api/notes/[noteId]/duplicate (M2).
 *
 * The old client did three serial fetches — GET, POST, PATCH — and on PATCH
 * failure left a stranded empty "(copy)" note. The server-side duplicate
 * endpoint folds the operation into a single atomic insertOne so the client
 * either gets the duplicate or doesn't.
 */

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

const { POST: duplicateNote } = await import(
  "@/app/api/notes/[noteId]/duplicate/route.js"
);

const TEST_USER = { id: "user-dup", username: "dupuser", role: "user" };

beforeAll(async () => {
  await startDb("test_notes_duplicate_route");
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
    sortOrder: "a0",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  });
  return result.insertedId;
}

describe("POST /api/notes/[noteId]/duplicate", () => {
  it("returns 401 when unauthenticated", async () => {
    mockSession(null);
    const noteId = new ObjectId().toString();
    const req = createRequest("POST", `/api/notes/${noteId}/duplicate`);
    const res = await duplicateNote(req, params({ noteId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 400 when noteId is not a valid ObjectId", async () => {
    mockSession(TEST_USER);
    const req = createRequest("POST", `/api/notes/not-an-id/duplicate`);
    const res = await duplicateNote(req, params({ noteId: "not-an-id" }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("copies title, content, icon, parentId and returns a new note with a fresh _id", async () => {
    mockSession(TEST_USER);
    const content = [{ type: "paragraph", content: "Source body" }];
    const sourceId = await insertNote({
      title: "Source",
      content,
      icon: "doc",
      parentId: null,
      sortOrder: "a1",
    });

    const noteId = sourceId.toString();
    const req = createRequest("POST", `/api/notes/${noteId}/duplicate`);
    const res = await duplicateNote(req, params({ noteId }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.id).not.toBe(noteId);
    expect(body.data.title).toBe("Source (copy)");
    expect(body.data.content).toEqual(content);
    expect(body.data.icon).toBe("doc");
    expect(body.data.parentId).toBeNull();
  });

  it("appends ' (copy)' suffix to the source title", async () => {
    mockSession(TEST_USER);
    const sourceId = await insertNote({ title: "Foo" });
    const noteId = sourceId.toString();

    const req = createRequest("POST", `/api/notes/${noteId}/duplicate`);
    const res = await duplicateNote(req, params({ noteId }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.data.title).toBe("Foo (copy)");
  });

  it("returns 404 when the source note does not exist", async () => {
    mockSession(TEST_USER);
    const noteId = new ObjectId().toString();
    const req = createRequest("POST", `/api/notes/${noteId}/duplicate`);
    const res = await duplicateNote(req, params({ noteId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });

  it("returns 404 when the source note belongs to another user", async () => {
    mockSession(TEST_USER);
    const db = getDb();
    const now = new Date();
    const result = await db.collection("notes").insertOne({
      userId: "other-user",
      title: "Other",
      parentId: null,
      content: [],
      icon: null,
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    const noteId = result.insertedId.toString();

    const req = createRequest("POST", `/api/notes/${noteId}/duplicate`);
    const res = await duplicateNote(req, params({ noteId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(404);
  });

  it("returns 404 when the source note is soft-deleted", async () => {
    mockSession(TEST_USER);
    const sourceId = await insertNote({
      title: "Trashed",
      deletedAt: new Date(),
    });
    const noteId = sourceId.toString();

    const req = createRequest("POST", `/api/notes/${noteId}/duplicate`);
    const res = await duplicateNote(req, params({ noteId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(404);
  });

  it("returns 403 when attempting to duplicate an inbox note", async () => {
    mockSession(TEST_USER);
    const inboxId = await insertNote({ title: "Inbox", type: "inbox" });
    const noteId = inboxId.toString();

    const req = createRequest("POST", `/api/notes/${noteId}/duplicate`);
    const res = await duplicateNote(req, params({ noteId }));
    const { status, body } = await parseResponse(res);
    expect(status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/inbox/i);
  });

  it("preserves the content array verbatim (deep equality)", async () => {
    mockSession(TEST_USER);
    const content = [
      {
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: "Title" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Line " },
          { type: "text", text: "with marks", styles: { bold: true } },
        ],
      },
      { type: "bulletListItem", content: [{ type: "text", text: "Item" }] },
    ];
    const sourceId = await insertNote({ title: "Rich", content });
    const noteId = sourceId.toString();

    const req = createRequest("POST", `/api/notes/${noteId}/duplicate`);
    const res = await duplicateNote(req, params({ noteId }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.data.content).toEqual(content);

    const db = getDb();
    const persisted = await db
      .collection("notes")
      .findOne({ _id: new ObjectId(body.data.id) });
    expect(persisted.content).toEqual(content);
  });

  it("inserts the duplicate between the source and its next sibling using fractional indexing", async () => {
    mockSession(TEST_USER);
    const sourceId = await insertNote({ title: "Source", sortOrder: "a0" });
    const nextId = await insertNote({ title: "Next", sortOrder: "a4" });

    const noteId = sourceId.toString();
    const req = createRequest("POST", `/api/notes/${noteId}/duplicate`);
    const res = await duplicateNote(req, params({ noteId }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(typeof body.data.sortOrder).toBe("string");
    expect(body.data.sortOrder > "a0").toBe(true);
    expect(body.data.sortOrder < "a4").toBe(true);

    // Lexicographic sort places duplicate immediately after source.
    const db = getDb();
    const all = await db
      .collection("notes")
      .find({ userId: TEST_USER.id, parentId: null })
      .sort({ sortOrder: 1 })
      .toArray();
    expect(all.map((d) => d.title)).toEqual(["Source", "Source (copy)", "Next"]);
    expect(all[0]._id.equals(sourceId)).toBe(true);
    expect(all[2]._id.equals(nextId)).toBe(true);
  });

  it("falls back to a key after the source when no next sibling exists", async () => {
    mockSession(TEST_USER);
    const sourceId = await insertNote({ title: "Solo", sortOrder: "a0" });
    const noteId = sourceId.toString();

    const req = createRequest("POST", `/api/notes/${noteId}/duplicate`);
    const res = await duplicateNote(req, params({ noteId }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(typeof body.data.sortOrder).toBe("string");
    expect(body.data.sortOrder > "a0").toBe(true);
  });

  it("inherits parentId from the source so duplicates land in the same folder", async () => {
    mockSession(TEST_USER);
    const folderId = await insertNote({ title: "Folder", parentId: null });
    const sourceId = await insertNote({
      title: "Child",
      parentId: folderId,
      sortOrder: "a0",
    });
    await insertNote({
      title: "Sibling",
      parentId: folderId,
      sortOrder: "a4",
    });

    const noteId = sourceId.toString();
    const req = createRequest("POST", `/api/notes/${noteId}/duplicate`);
    const res = await duplicateNote(req, params({ noteId }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.data.parentId).toBe(folderId.toString());

    // Next-sibling resolution is scoped to (userId, parentId) — the duplicate
    // should slot between Child and Sibling, not against a different folder's
    // chain.
    expect(body.data.sortOrder > "a0").toBe(true);
    expect(body.data.sortOrder < "a4").toBe(true);
  });

  it("sets fresh createdAt/updatedAt and clears deletedAt on the duplicate", async () => {
    mockSession(TEST_USER);
    const old = new Date("2024-01-01T00:00:00Z");
    const sourceId = await insertNote({
      title: "Old",
      createdAt: old,
      updatedAt: old,
    });
    const noteId = sourceId.toString();

    const before = Date.now();
    const req = createRequest("POST", `/api/notes/${noteId}/duplicate`);
    const res = await duplicateNote(req, params({ noteId }));
    const { status, body } = await parseResponse(res);
    const after = Date.now();

    expect(status).toBe(201);
    const createdAt = new Date(body.data.createdAt).getTime();
    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(createdAt).toBeLessThanOrEqual(after);
    expect(body.data.deletedAt).toBeNull();
  });

  it("copies a 2-level subtree: root + children with rewritten parentId", async () => {
    mockSession(TEST_USER);
    const folderId = await insertNote({ title: "Folder", parentId: null, sortOrder: "a0" });
    const childAId = await insertNote({ title: "A", parentId: folderId, sortOrder: "b0" });
    const childBId = await insertNote({ title: "B", parentId: folderId, sortOrder: "b1" });

    const req = createRequest("POST", `/api/notes/${folderId.toString()}/duplicate`);
    const res = await duplicateNote(req, params({ noteId: folderId.toString() }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("Folder (copy)");
    expect(body.data.copiedCount).toBe(3);

    const newRootId = body.data.id;
    const db = getDb();
    const childCopies = await db
      .collection("notes")
      .find({ userId: TEST_USER.id, parentId: new ObjectId(newRootId) })
      .toArray();
    expect(childCopies).toHaveLength(2);
    const titles = childCopies.map((c) => c.title).sort();
    expect(titles).toEqual(["A", "B"]);

    // Source children are untouched.
    const origChildren = await db
      .collection("notes")
      .find({ userId: TEST_USER.id, parentId: folderId })
      .toArray();
    expect(origChildren.map((c) => c._id.toString()).sort()).toEqual(
      [childAId.toString(), childBId.toString()].sort(),
    );
  });

  it("excludes soft-deleted descendants from the copy", async () => {
    mockSession(TEST_USER);
    const folderId = await insertNote({ title: "F", parentId: null });
    await insertNote({ title: "Alive", parentId: folderId, sortOrder: "b0" });
    await insertNote({
      title: "Trashed",
      parentId: folderId,
      sortOrder: "b1",
      deletedAt: new Date(),
    });

    const req = createRequest("POST", `/api/notes/${folderId.toString()}/duplicate`);
    const res = await duplicateNote(req, params({ noteId: folderId.toString() }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.data.copiedCount).toBe(2);

    const db = getDb();
    const childCopies = await db
      .collection("notes")
      .find({ userId: TEST_USER.id, parentId: new ObjectId(body.data.id) })
      .toArray();
    expect(childCopies).toHaveLength(1);
    expect(childCopies[0].title).toBe("Alive");
  });
});
