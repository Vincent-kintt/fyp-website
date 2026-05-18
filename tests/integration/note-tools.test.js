// M10: integration test for createNoteTools.
//
// Previously this suite used a hand-built mocked MongoDB collection,
// which masked real Mongo behavior (BSON serialization, ObjectId
// equality, findOne semantics). It now runs against
// mongodb-memory-server like every other integration suite in this repo.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { ObjectId } from "mongodb";
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";

vi.mock("@/lib/db.js", () => ({
  getCollection: async (name) => getDb().collection(name),
}));

const { createNoteTools } = await import("@/lib/ai/noteTools.js");

const USER_ID = "user-123";
const OTHER_USER_ID = "user-other";

let tools;

beforeAll(async () => {
  await startDb("test_note_tools");
  tools = createNoteTools(USER_ID);
});

afterAll(async () => {
  await stopDb();
});

beforeEach(async () => {
  await clearDb();
});

function paragraph(text) {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

async function insertNote(overrides = {}) {
  const now = new Date();
  const doc = {
    userId: USER_ID,
    title: "Untitled",
    parentId: null,
    content: [],
    icon: null,
    sortOrder: 1000,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  const { insertedId } = await getDb().collection("notes").insertOne(doc);
  return { ...doc, _id: insertedId };
}

describe("createNoteTools", () => {
  describe("searchNotes", () => {
    it("returns matching notes with snippets", async () => {
      await insertNote({
        title: "Meeting Notes",
        content: [paragraph("Discussion about project timeline")],
        updatedAt: new Date("2026-04-01"),
      });

      const result = await tools.searchNotes.execute({ query: "meeting" });

      expect(result.success).toBe(true);
      expect(result.notes).toHaveLength(1);
      expect(result.notes[0].noteId).toMatch(/^[a-f0-9]{24}$/);
      expect(result.notes[0].title).toBe("Meeting Notes");
      expect(result.notes[0].snippet).toContain("Discussion about project timeline");
      expect(result.notes[0].snippet.length).toBeLessThanOrEqual(200);
    });

    it("scopes search to the authenticated user", async () => {
      await insertNote({ title: "Mine", content: [paragraph("mine")] });
      await insertNote({
        userId: OTHER_USER_ID,
        title: "Mine",
        content: [paragraph("theirs")],
      });

      const result = await tools.searchNotes.execute({ query: "mine" });

      expect(result.success).toBe(true);
      expect(result.notes).toHaveLength(1);
      const fetched = await getDb()
        .collection("notes")
        .findOne({ _id: new ObjectId(result.notes[0].noteId) });
      expect(fetched.userId).toBe(USER_ID);
    });

    it("respects limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        await insertNote({ title: `Test note ${i}` });
      }

      const result = await tools.searchNotes.execute({ query: "test", limit: 3 });

      expect(result.success).toBe(true);
      expect(result.notes).toHaveLength(3);
    });

    it("defaults limit to 5", async () => {
      for (let i = 0; i < 7; i++) {
        await insertNote({ title: `Test note ${i}` });
      }

      const result = await tools.searchNotes.execute({ query: "test" });

      expect(result.success).toBe(true);
      expect(result.notes).toHaveLength(5);
    });

    it("excludes deleted notes", async () => {
      await insertNote({ title: "Active note" });
      await insertNote({ title: "Active note", deletedAt: new Date() });

      const result = await tools.searchNotes.execute({ query: "active" });

      expect(result.success).toBe(true);
      expect(result.notes).toHaveLength(1);
    });

    it("sorts results by updatedAt descending", async () => {
      await insertNote({
        title: "Older note",
        updatedAt: new Date("2026-01-01"),
      });
      await insertNote({
        title: "Newer note",
        updatedAt: new Date("2026-05-01"),
      });

      const result = await tools.searchNotes.execute({ query: "note" });

      expect(result.notes.map((n) => n.title)).toEqual([
        "Newer note",
        "Older note",
      ]);
    });

    it("escapes regex metacharacters in the query", async () => {
      await insertNote({ title: "Plain title" });
      // Query containing regex metacharacters must not match "Plain title".
      const result = await tools.searchNotes.execute({ query: ".*" });

      expect(result.success).toBe(true);
      expect(result.notes).toHaveLength(0);
    });
  });

  describe("readNote", () => {
    it("returns note content as plaintext", async () => {
      const note = await insertNote({
        title: "My Note",
        content: [paragraph("Hello world")],
        updatedAt: new Date("2026-04-01"),
      });

      const result = await tools.readNote.execute({
        noteId: note._id.toString(),
      });

      expect(result.success).toBe(true);
      expect(result.noteId).toBe(note._id.toString());
      expect(result.title).toBe("My Note");
      expect(result.content).toContain("Hello world");
    });

    it("returns error for invalid ObjectId", async () => {
      const result = await tools.readNote.execute({ noteId: "nonexistent" });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("returns error for non-existent note", async () => {
      const result = await tools.readNote.execute({
        noteId: new ObjectId().toString(),
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("scopes read to the authenticated user", async () => {
      const otherNote = await insertNote({
        userId: OTHER_USER_ID,
        title: "Other user note",
        content: [paragraph("secret")],
      });

      const result = await tools.readNote.execute({
        noteId: otherNote._id.toString(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("excludes deleted notes", async () => {
      const deleted = await insertNote({
        title: "Trashed note",
        content: [paragraph("gone")],
        deletedAt: new Date(),
      });

      const result = await tools.readNote.execute({
        noteId: deleted._id.toString(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
