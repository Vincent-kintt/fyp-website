import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { migrateNotesSortOrder } from "../../../scripts/migrateNotesSortOrder.js";
import { formatNote } from "@/lib/notes/db.js";

// `compareNotes` is not exported from lib/notes/tree.js — inline the
// equivalent semantics so this test stays a single source of truth for the
// app's wire-side ordering. Must match lib/notes/tree.js exactly:
//   ao = a.sortOrder ?? ""
//   bo = b.sortOrder ?? ""
//   lex compare on (ao, bo), then id tiebreak
function compareNotesLikeApp(a, b) {
  const ao = a.sortOrder ?? "";
  const bo = b.sortOrder ?? "";
  if (ao < bo) return -1;
  if (ao > bo) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

let mongod;
let client;
let db;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  client = new MongoClient(mongod.getUri());
  await client.connect();
  db = client.db("test_mig");
});

afterAll(async () => {
  if (client) await client.close();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await db.collection("notes").deleteMany({});
});

describe("migrateNotesSortOrder mixed-group ordering", () => {
  it("preserves relative order when valid and invalid keys share a parent", async () => {
    // Three notes under same (userId=u, parentId=null):
    //   A: valid "a0"
    //   B: invalid "a91000" (trailing zeros — generateKeyBetween rejects)
    //   C: valid "a5"
    // Current relative lex order (treating invalid as opaque string):
    //   A "a0" < C "a5" < B "a91000"
    // After migration, all three must be valid fractional keys AND
    // preserve that same lex ordering.
    await db.collection("notes").insertMany([
      { _id: 1, userId: "u", parentId: null, title: "A", sortOrder: "a0" },
      { _id: 2, userId: "u", parentId: null, title: "B", sortOrder: "a91000" },
      { _id: 3, userId: "u", parentId: null, title: "C", sortOrder: "a5" },
    ]);

    const summary = await migrateNotesSortOrder(db);
    expect(summary.invalidStrings).toBe(1);

    const docs = await db.collection("notes").find({ userId: "u" }).toArray();
    const byTitle = (t) => docs.find((d) => d.title === t).sortOrder;
    expect(typeof byTitle("A")).toBe("string");
    expect(typeof byTitle("B")).toBe("string");
    expect(typeof byTitle("C")).toBe("string");
    // Lex order must match original (A < C < B):
    expect(byTitle("A") < byTitle("C")).toBe(true);
    expect(byTitle("C") < byTitle("B")).toBe(true);
  });

  it("preserves relative order with extreme-lex invalid keys around valid ones", async () => {
    // Forces failure paths the RNG can't accidentally pass:
    //   D: invalid "!" (lex first, before all fractional keys)
    //   E: valid   "a5"
    //   F: invalid "~" (lex last, after fractional alphabet)
    // Lex ordering originally: D "!" < E "a5" < F "~"
    // After migration, generated keys for D and F must still flank E.
    await db.collection("notes").insertMany([
      { _id: 11, userId: "v", parentId: null, title: "D", sortOrder: "!" },
      { _id: 12, userId: "v", parentId: null, title: "E", sortOrder: "a5" },
      { _id: 13, userId: "v", parentId: null, title: "F", sortOrder: "~" },
    ]);

    const summary = await migrateNotesSortOrder(db);
    expect(summary.invalidStrings).toBe(2);

    const docs = await db.collection("notes").find({ userId: "v" }).toArray();
    const byTitle = (t) => docs.find((d) => d.title === t).sortOrder;
    expect(typeof byTitle("D")).toBe("string");
    expect(typeof byTitle("E")).toBe("string");
    expect(typeof byTitle("F")).toBe("string");
    expect(byTitle("D") < byTitle("E")).toBe(true);
    expect(byTitle("E") < byTitle("F")).toBe(true);
  });

  it("skips entirely when all keys in a group are valid (idempotency)", async () => {
    await db.collection("notes").insertMany([
      { _id: 21, userId: "w", parentId: null, title: "X", sortOrder: "a0" },
      { _id: 22, userId: "w", parentId: null, title: "Y", sortOrder: "a5" },
      { _id: 23, userId: "w", parentId: null, title: "Z", sortOrder: "aV" },
    ]);

    const summary = await migrateNotesSortOrder(db);
    expect(summary.converted).toBe(0);
    expect(summary.skipped).toBe(3);
    expect(summary.invalidStrings).toBe(0);

    // Original keys preserved verbatim.
    const docs = await db.collection("notes").find({ userId: "w" }).toArray();
    expect(docs.find((d) => d.title === "X").sortOrder).toBe("a0");
    expect(docs.find((d) => d.title === "Y").sortOrder).toBe("a5");
    expect(docs.find((d) => d.title === "Z").sortOrder).toBe("aV");
  });

  it("preserves app-visible order across numeric, valid, and invalid keys", async () => {
    // Mixed group under (userId="u2", parentId=null):
    //   doc1: _id="1",      sortOrder=100         (legacy numeric)
    //   doc2: _id="2",      sortOrder=200         (legacy numeric)
    //   doc3: _id="3",      sortOrder="a5"        (valid fractional string)
    //   doc4: _id="4",      sortOrder="a91000"    (invalid string — trailing zeros)
    //
    // formatNote coerces non-string sortOrder to null. compareNotes then
    // treats null as "", and "" < any non-empty string. So pre-migration
    // app-visible order is:
    //   doc1 ("" vs "" → id "1" first)
    //   doc2 ("" vs "" → id "2" second)
    //   doc3 ("a5" — lex before "a91000")
    //   doc4 ("a91000")
    // i.e. numerics first by id, then string keys lex.
    //
    // Migration must preserve that order: after re-keying, all four docs are
    // valid fractional strings, but compareNotes on the new keys MUST give
    // the same total order as compareNotes on the old (formatted) docs.
    await db.collection("notes").insertMany([
      { _id: "1", userId: "u2", parentId: null, title: "doc1", sortOrder: 100 },
      { _id: "2", userId: "u2", parentId: null, title: "doc2", sortOrder: 200 },
      { _id: "3", userId: "u2", parentId: null, title: "doc3", sortOrder: "a5" },
      {
        _id: "4",
        userId: "u2",
        parentId: null,
        title: "doc4",
        sortOrder: "a91000",
      },
    ]);

    // Compute pre-migration app-visible order.
    const preDocs = await db
      .collection("notes")
      .find({ userId: "u2" })
      .toArray();
    const preFormatted = preDocs.map(formatNote);
    const expectedOrder = [...preFormatted]
      .sort(compareNotesLikeApp)
      .map((n) => n.id);
    expect(expectedOrder).toEqual(["1", "2", "3", "4"]);

    const summary = await migrateNotesSortOrder(db);
    expect(summary.invalidStrings).toBe(1);
    expect(summary.converted).toBe(4);

    // Compute post-migration app-visible order.
    const postDocs = await db
      .collection("notes")
      .find({ userId: "u2" })
      .toArray();
    const postFormatted = postDocs.map(formatNote);
    // All four must now be string sortOrder (formatNote keeps them as-is).
    for (const n of postFormatted) {
      expect(typeof n.sortOrder).toBe("string");
    }
    const actualOrder = [...postFormatted]
      .sort(compareNotesLikeApp)
      .map((n) => n.id);
    expect(actualOrder).toEqual(expectedOrder);
  });
});
