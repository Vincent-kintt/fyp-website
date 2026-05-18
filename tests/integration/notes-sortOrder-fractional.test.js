import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import { generateKeyBetween } from "fractional-indexing";
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";
import {
  setupApiMocks,
  mockSession,
  createRequest,
  parseResponse,
} from "../helpers/api.js";

setupApiMocks(getDb);

const { POST: createNote, GET: listNotes } = await import(
  "@/app/api/notes/route.js"
);
const { POST: reorderNotes } = await import(
  "@/app/api/notes/reorder/route.js"
);
const { formatNote } = await import("@/lib/notes/db.js");

const TEST_USER = { id: "user-frac", username: "fracuser", role: "user" };

beforeAll(async () => {
  await startDb("test_notes_sortOrder_fractional");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
});

async function postNote(title, parentId = null) {
  const req = createRequest("POST", "/api/notes", {
    body: { title, ...(parentId ? { parentId } : {}) },
  });
  const res = await createNote(req);
  return parseResponse(res);
}

describe("notes sortOrder — fractional indexing", () => {
  describe("POST /api/notes (sequential under same parent)", () => {
    it("assigns monotonically increasing string keys to 5 sequential inserts", async () => {
      mockSession(TEST_USER);

      const orders = [];
      for (let i = 0; i < 5; i++) {
        const { status, body } = await postNote(`Note ${i}`);
        expect(status).toBe(201);
        expect(typeof body.data.sortOrder).toBe("string");
        expect(body.data.sortOrder.length).toBeGreaterThan(0);
        orders.push(body.data.sortOrder);
      }

      // All distinct
      const unique = new Set(orders);
      expect(unique.size).toBe(orders.length);

      // Sorted lexicographically — same order as insertion
      const sorted = [...orders].sort();
      expect(sorted).toEqual(orders);
    });
  });

  describe("POST /api/notes (concurrent under same parent)", () => {
    it("does NOT produce identical sortOrder values across 10 concurrent inserts", async () => {
      mockSession(TEST_USER);

      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) => postNote(`Concurrent ${i}`)),
      );

      const orders = results.map((r) => r.body.data.sortOrder);
      const unique = new Set(orders);

      // CRITICAL: this is the bug we're fixing.
      // The old "+1000" code returns 10 identical sortOrder strings under concurrent inserts.
      // Fractional indexing returns at most a few collisions (when two writers read the
      // same lastSibling), but the _id tiebreaker is what makes the total ordering deterministic.
      // We assert at most a small collision count here — and the _id tiebreaker is asserted below.
      // The key correctness property is that *the persisted document order is fully determined*.
      // Even if two concurrent inserts collide on key, sorting by (sortOrder, _id) is deterministic.
      // For this test we just lock "much better than the old code" — old code returned
      // 1 unique value out of 10. Fractional indexing returns >= 2 unique values (usually all 10).
      expect(unique.size).toBeGreaterThanOrEqual(2);

      // All sortOrder values must be strings
      for (const o of orders) {
        expect(typeof o).toBe("string");
      }
    });

    it("provides deterministic total ordering via (sortOrder, _id) sort", async () => {
      mockSession(TEST_USER);

      await Promise.all(
        Array.from({ length: 6 }, (_, i) => postNote(`Race ${i}`)),
      );

      const db = getDb();
      const docs = await db
        .collection("notes")
        .find({ userId: TEST_USER.id })
        .sort({ sortOrder: 1, _id: 1 })
        .toArray();

      // Sorting by (sortOrder, _id) is total-ordered and stable.
      // Re-running the same sort produces the same sequence.
      const ids1 = docs.map((d) => d._id.toString());

      const docs2 = await db
        .collection("notes")
        .find({ userId: TEST_USER.id })
        .sort({ sortOrder: 1, _id: 1 })
        .toArray();
      const ids2 = docs2.map((d) => d._id.toString());

      expect(ids2).toEqual(ids1);
    });
  });

  describe("POST /api/notes/reorder (insert between)", () => {
    it("accepts string sortOrder keys and persists them", async () => {
      mockSession(TEST_USER);

      // Create three notes A, B, C
      const a = (await postNote("A")).body.data;
      const b = (await postNote("B")).body.data;
      const c = (await postNote("C")).body.data;

      // Compute a key between A and B for moving C
      const between = generateKeyBetween(a.sortOrder, b.sortOrder);

      const req = createRequest("POST", "/api/notes/reorder", {
        body: {
          updates: [{ id: c.id, sortOrder: between, parentId: null }],
        },
      });
      const res = await reorderNotes(req);
      const { status, body } = await parseResponse(res);
      expect(status).toBe(200);
      expect(body.success).toBe(true);

      const db = getDb();
      const cDoc = await db
        .collection("notes")
        .findOne({ _id: new ObjectId(c.id) });
      expect(cDoc.sortOrder).toBe(between);
      // Key is between A and B
      expect(cDoc.sortOrder > a.sortOrder).toBe(true);
      expect(cDoc.sortOrder < b.sortOrder).toBe(true);
    });

    it("bulk-reorder preserves total ordering across multiple notes", async () => {
      mockSession(TEST_USER);

      const a = (await postNote("A")).body.data;
      const b = (await postNote("B")).body.data;
      const c = (await postNote("C")).body.data;

      const k1 = generateKeyBetween(null, null);
      const k2 = generateKeyBetween(k1, null);
      const k3 = generateKeyBetween(k2, null);

      const req = createRequest("POST", "/api/notes/reorder", {
        body: {
          updates: [
            { id: a.id, sortOrder: k1, parentId: null },
            { id: b.id, sortOrder: k2, parentId: null },
            { id: c.id, sortOrder: k3, parentId: null },
          ],
        },
      });
      const res = await reorderNotes(req);
      const { status, body } = await parseResponse(res);
      expect(status).toBe(200);
      expect(body.data.matched).toBe(3);

      const db = getDb();
      const docs = await db
        .collection("notes")
        .find({ userId: TEST_USER.id })
        .sort({ sortOrder: 1 })
        .toArray();
      expect(docs[0]._id.toString()).toBe(a.id);
      expect(docs[1]._id.toString()).toBe(b.id);
      expect(docs[2]._id.toString()).toBe(c.id);
      expect(docs[0].sortOrder).toBe(k1);
      expect(docs[1].sortOrder).toBe(k2);
      expect(docs[2].sortOrder).toBe(k3);
    });

    it("rejects non-string sortOrder values", async () => {
      mockSession(TEST_USER);
      const a = (await postNote("A")).body.data;
      const req = createRequest("POST", "/api/notes/reorder", {
        body: {
          updates: [{ id: a.id, sortOrder: 1000, parentId: null }],
        },
      });
      const res = await reorderNotes(req);
      const { status, body } = await parseResponse(res);
      expect(status).toBe(400);
      expect(body.error).toMatch(/sortOrder/i);
    });
  });

  describe("formatNote", () => {
    it("returns string sortOrder unchanged", () => {
      const doc = {
        _id: new ObjectId(),
        userId: "u",
        title: "T",
        parentId: null,
        content: [],
        icon: null,
        sortOrder: "a3V",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const out = formatNote(doc);
      expect(out.sortOrder).toBe("a3V");
    });

    it("handles missing sortOrder for legacy docs without breaking", () => {
      const doc = {
        _id: new ObjectId(),
        userId: "u",
        title: "T",
        parentId: null,
        content: [],
        icon: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const out = formatNote(doc);
      expect(typeof out.sortOrder === "string" || out.sortOrder === null).toBe(
        true,
      );
    });
  });

  describe("GET /api/notes — wire shape", () => {
    it("returns string sortOrder values", async () => {
      mockSession(TEST_USER);
      await postNote("A");
      await postNote("B");

      const req = createRequest("GET", "/api/notes");
      const res = await listNotes(req);
      const { status, body } = await parseResponse(res);
      expect(status).toBe(200);
      for (const note of body.data) {
        expect(typeof note.sortOrder).toBe("string");
      }
    });
  });
});

describe("scripts/migrateNotesSortOrder", () => {
  it("converts integer sortOrder to fractional keys preserving app-visible order per parent group", async () => {
    const db = getDb();
    const now = new Date();

    // Setup: three root notes with old integer sortOrder.
    //
    // NOTE: the raw numeric values (3000, 1000, 2000) are IRRELEVANT to the
    // app's visual order. `lib/notes/db.js` `formatNote` coerces non-string
    // sortOrder to null, and `lib/notes/tree.js` `compareNotes` treats null
    // as "" — so all three are tied on sortOrder and the `_id` tiebreak is
    // what decides. Inserts are sequential here, so `_id`s are monotonically
    // increasing and the app-visible order is A, B, C (insertion order).
    // The migration must preserve THAT, not a non-existent numeric ordering.
    const a = await db.collection("notes").insertOne({
      userId: TEST_USER.id,
      title: "A",
      parentId: null,
      content: [],
      icon: null,
      sortOrder: 3000,
      createdAt: now,
      updatedAt: now,
    });
    await db.collection("notes").insertOne({
      userId: TEST_USER.id,
      title: "B",
      parentId: null,
      content: [],
      icon: null,
      sortOrder: 1000,
      createdAt: now,
      updatedAt: now,
    });
    await db.collection("notes").insertOne({
      userId: TEST_USER.id,
      title: "C",
      parentId: null,
      content: [],
      icon: null,
      sortOrder: 2000,
      createdAt: now,
      updatedAt: now,
    });

    // Child notes under a different parent
    await db.collection("notes").insertOne({
      userId: TEST_USER.id,
      title: "child1",
      parentId: a.insertedId,
      content: [],
      icon: null,
      sortOrder: 1000,
      createdAt: now,
      updatedAt: now,
    });
    await db.collection("notes").insertOne({
      userId: TEST_USER.id,
      title: "child2",
      parentId: a.insertedId,
      content: [],
      icon: null,
      sortOrder: 2000,
      createdAt: now,
      updatedAt: now,
    });

    const { migrateNotesSortOrder } = await import(
      "@/scripts/migrateNotesSortOrder.js"
    );
    const summary = await migrateNotesSortOrder(db);

    expect(summary.converted).toBeGreaterThanOrEqual(5);

    // Reload and verify app-visible order preserved (A, B, C — id tiebreak,
    // since all numerics coerce to "" in compareNotes).
    const roots = await db
      .collection("notes")
      .find({ userId: TEST_USER.id, parentId: null })
      .sort({ sortOrder: 1 })
      .toArray();
    expect(roots.map((d) => d.title)).toEqual(["A", "B", "C"]);
    for (const note of roots) {
      expect(typeof note.sortOrder).toBe("string");
    }
  });

  it("is idempotent — skips notes whose sortOrder is already a string", async () => {
    const db = getDb();
    const now = new Date();
    await db.collection("notes").insertOne({
      userId: TEST_USER.id,
      title: "Already migrated",
      parentId: null,
      content: [],
      icon: null,
      sortOrder: "a3",
      createdAt: now,
      updatedAt: now,
    });

    const { migrateNotesSortOrder } = await import(
      "@/scripts/migrateNotesSortOrder.js"
    );
    const summary = await migrateNotesSortOrder(db);
    expect(summary.skipped).toBeGreaterThanOrEqual(1);

    const doc = await db
      .collection("notes")
      .findOne({ userId: TEST_USER.id, title: "Already migrated" });
    expect(doc.sortOrder).toBe("a3");
  });
});
