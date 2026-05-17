/**
 * Unit tests for app/api/inbox/note/route.js POST race-handling.
 *
 * The route's POST does `findOneAndUpdate({ userId, type: "inbox" }, ..., { upsert: true })`.
 * Under the partial unique index `{ userId, type } where type === "inbox"`,
 * MongoDB's upsert is atomic and normally swallows duplicate-key races. But
 * edge cases (e.g. write conflicts under heavy load) can still surface
 * `E11000` — the route must catch that, re-read the existing doc, and return
 * 200 instead of letting `withAuth` map the throw to a 500.
 *
 * Integration tests can't deterministically reproduce E11000 from a single
 * thread because `findOneAndUpdate` with upsert handles existing docs by
 * updating instead of throwing — so we mock the collection here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getNotesCollectionMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: (...args) => authMock(...args),
}));

vi.mock("@/lib/notes/db", () => ({
  getNotesCollection: (...args) => getNotesCollectionMock(...args),
  formatNote: (doc) => ({
    id: doc._id.toString(),
    userId: doc.userId,
    title: doc.title,
    parentId: doc.parentId ? doc.parentId.toString() : null,
    content: doc.content || [],
    icon: doc.icon || null,
    sortOrder: doc.sortOrder || 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    deletedAt: doc.deletedAt || null,
    extractedTasks: doc.extractedTasks || null,
    confirmedTasks: doc.confirmedTasks || null,
  }),
}));

const { POST } = await import("@/app/api/inbox/note/route.js");

let consoleErrorSpy;

beforeEach(() => {
  authMock.mockReset();
  getNotesCollectionMock.mockReset();
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

async function readJson(res) {
  const text = await res.text();
  return JSON.parse(text);
}

function makeRequest() {
  return new Request("http://localhost/api/inbox/note", { method: "POST" });
}

describe("POST /api/inbox/note — E11000 race handling", () => {
  it("returns existing doc when upsert races to E11000", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });

    const existing = {
      _id: { toString: () => "existing-inbox-id" },
      userId: "u1",
      title: "Inbox",
      parentId: null,
      content: [],
      icon: null,
      sortOrder: 0,
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
      updatedAt: new Date("2020-01-01T00:00:00.000Z"),
      deletedAt: null,
    };

    const err = Object.assign(new Error("E11000 duplicate key error"), {
      code: 11000,
    });

    const findOneAndUpdate = vi.fn().mockRejectedValue(err);
    const findOne = vi.fn().mockResolvedValue(existing);

    getNotesCollectionMock.mockResolvedValue({
      findOneAndUpdate,
      findOne,
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("existing-inbox-id");
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledWith({ userId: "u1", type: "inbox" });
  });

  it("rethrows non-E11000 errors (lets withAuth map to 500)", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });

    const err = Object.assign(new Error("network down"), { code: "ENETDOWN" });
    const findOneAndUpdate = vi.fn().mockRejectedValue(err);
    const findOne = vi.fn();

    getNotesCollectionMock.mockResolvedValue({
      findOneAndUpdate,
      findOne,
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    expect(findOne).not.toHaveBeenCalled();
  });

  it("falls through to 500 when E11000 fires but follow-up findOne returns null", async () => {
    // Defensive: if findOne returns null after an E11000 (extremely unlikely
    // but possible if the racing winner is later deleted), don't pretend
    // success — let the error bubble so the client retries.
    authMock.mockResolvedValue({ user: { id: "u1" } });

    const err = Object.assign(new Error("E11000 duplicate key error"), {
      code: 11000,
    });
    const findOneAndUpdate = vi.fn().mockRejectedValue(err);
    const findOne = vi.fn().mockResolvedValue(null);

    getNotesCollectionMock.mockResolvedValue({
      findOneAndUpdate,
      findOne,
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    expect(findOne).toHaveBeenCalledTimes(1);
  });
});
