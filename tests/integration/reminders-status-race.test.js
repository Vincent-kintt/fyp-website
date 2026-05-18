// H2: TOCTOU race in reminder status writes.
//
// PATCH / PUT / AI updateReminder previously read existing.status, validated the
// transition in JS, then wrote with filter {_id, userId}. Two concurrent status
// updates against the same baseline both pass validation and both succeed —
// the second is an invalid transition already authorized.
//
// Fix: when the patch changes status, embed {status: existing.status} in the
// updateOne filter. matchedCount === 0 then surfaces as 409 Conflict.
//
// These tests deterministically simulate the race by intercepting findOne for
// the reminders collection. The interceptor runs the route's read, then
// mutates the DB to a different (still legal) status before resolving — so the
// route's `existing` is stale by the time updateOne fires.

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { ObjectId } from "mongodb";
import { startDb, stopDb, clearDb, getDb } from "../helpers/db.js";
import {
  setupApiMocks,
  mockSession,
  createRequest,
  params,
  parseResponse,
} from "../helpers/api.js";

setupApiMocks(getDb);

const { PATCH, PUT } = await import("@/app/api/reminders/[id]/route.js");
const { createTools } = await import("@/lib/ai/tools.js");

const TEST_USER = { id: "user-h2-race", username: "racer", role: "user" };

async function insertReminder(overrides = {}) {
  const db = getDb();
  const doc = {
    title: "Race Reminder",
    description: "",
    remark: "",
    dateTime: new Date("2026-06-01T09:00:00Z"),
    duration: null,
    category: "personal",
    tags: ["work"],
    recurring: false,
    recurringType: null,
    priority: "medium",
    status: "pending",
    completed: false,
    subtasks: [],
    sortOrder: 0,
    notificationSent: false,
    userId: TEST_USER.id,
    username: TEST_USER.username,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  const result = await db.collection("reminders").insertOne(doc);
  return result.insertedId.toString();
}

// One-shot interceptor: wraps Db.prototype.collection so every collection the
// route asks for (via the mocked getCollection → db.collection) returns a
// proxy whose findOne calls the real read, then runs a "concurrent" mutation
// callback once before resolving. Subsequent findOne calls behave normally.
//
// We patch the prototype because mongodb's Db#collection returns a fresh
// Collection instance per call — patching a single instance would miss the
// one the route obtains via getCollection.
//
// Returns a restore() function that removes the wrapper.
function interceptNextFindOne(mutation) {
  const db = getDb();
  const DbProto = Object.getPrototypeOf(db);
  const realCollection = DbProto.collection;
  let fired = false;

  DbProto.collection = function patchedCollection(name, ...rest) {
    const coll = realCollection.call(this, name, ...rest);
    if (name !== "reminders") return coll;
    const realFindOne = coll.findOne.bind(coll);
    coll.findOne = async function interceptedFindOne(...args) {
      const result = await realFindOne(...args);
      if (!fired) {
        fired = true;
        // Mutate via a fresh collection handle so the side-effect doesn't
        // recurse through the patched findOne.
        await mutation(realCollection.call(db, "reminders"));
      }
      return result;
    };
    return coll;
  };

  return () => {
    DbProto.collection = realCollection;
  };
}

beforeAll(async () => {
  await startDb("test_reminders_status_race");
});
afterAll(async () => {
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
});

// ---------------------------------------------------------------------------
// PATCH race scenarios
// ---------------------------------------------------------------------------
describe("PATCH /api/reminders/[id] — status TOCTOU race", () => {
  it("returns 409 when status changes between read and write", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ status: "pending" });

    // Concurrent writer flips pending → in_progress between the route's read
    // and write. The route's snapshot still says pending, validation passes
    // (pending → completed is allowed), but the DB-side filter must catch
    // that the baseline no longer matches.
    const restore = interceptNextFindOne(async (coll) => {
      await coll.updateOne(
        { _id: new ObjectId(id), userId: TEST_USER.id },
        { $set: { status: "in_progress", completed: false } },
      );
    });

    try {
      const req = createRequest("PATCH", `/api/reminders/${id}`, {
        body: { status: "completed" },
      });
      const res = await PATCH(req, params({ id }));
      const { status, body } = await parseResponse(res);
      expect(status).toBe(409);
      expect(body.error).toMatch(/status changed/i);
    } finally {
      restore();
    }

    // DB should retain the concurrent writer's state, not the racing caller's.
    const final = await getDb()
      .collection("reminders")
      .findOne({ _id: new ObjectId(id) });
    expect(final.status).toBe("in_progress");
  });

  it("does NOT 409 on title-only PATCH even if status raced", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ status: "pending" });

    const restore = interceptNextFindOne(async (coll) => {
      await coll.updateOne(
        { _id: new ObjectId(id), userId: TEST_USER.id },
        { $set: { status: "completed", completed: true } },
      );
    });

    try {
      const req = createRequest("PATCH", `/api/reminders/${id}`, {
        body: { title: "Renamed during race" },
      });
      const res = await PATCH(req, params({ id }));
      const { status, body } = await parseResponse(res);
      expect(status).toBe(200);
      expect(body.data.title).toBe("Renamed during race");
      // The concurrent status change is preserved — title-only PATCH doesn't
      // (and shouldn't) overwrite status.
      expect(body.data.status).toBe("completed");
    } finally {
      restore();
    }
  });

  it("returns 409 when legacy completed boolean races status change", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ status: "pending" });

    const restore = interceptNextFindOne(async (coll) => {
      await coll.updateOne(
        { _id: new ObjectId(id), userId: TEST_USER.id },
        { $set: { status: "in_progress", completed: false } },
      );
    });

    try {
      const req = createRequest("PATCH", `/api/reminders/${id}`, {
        body: { completed: true },
      });
      const res = await PATCH(req, params({ id }));
      const { status, body } = await parseResponse(res);
      expect(status).toBe(409);
      expect(body.error).toMatch(/status changed/i);
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// PUT race scenarios
// ---------------------------------------------------------------------------
describe("PUT /api/reminders/[id] — status TOCTOU race", () => {
  it("returns 409 when status changes between read and write", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ status: "pending" });

    const restore = interceptNextFindOne(async (coll) => {
      await coll.updateOne(
        { _id: new ObjectId(id), userId: TEST_USER.id },
        { $set: { status: "in_progress", completed: false } },
      );
    });

    try {
      const req = createRequest("PUT", `/api/reminders/${id}`, {
        body: {
          title: "Race PUT",
          dateTime: new Date("2026-06-01T09:00:00Z").toISOString(),
          status: "completed",
        },
      });
      const res = await PUT(req, params({ id }));
      const { status, body } = await parseResponse(res);
      expect(status).toBe(409);
      expect(body.error).toMatch(/status changed/i);
    } finally {
      restore();
    }

    const final = await getDb()
      .collection("reminders")
      .findOne({ _id: new ObjectId(id) });
    expect(final.status).toBe("in_progress");
  });

  it("does NOT 409 on PUT without status field when only title raced", async () => {
    mockSession(TEST_USER);
    const id = await insertReminder({ status: "pending" });

    const restore = interceptNextFindOne(async (coll) => {
      await coll.updateOne(
        { _id: new ObjectId(id), userId: TEST_USER.id },
        { $set: { status: "completed", completed: true } },
      );
    });

    try {
      const req = createRequest("PUT", `/api/reminders/${id}`, {
        body: {
          title: "Renamed via PUT",
          dateTime: new Date("2026-06-01T09:00:00Z").toISOString(),
        },
      });
      const res = await PUT(req, params({ id }));
      const { status, body } = await parseResponse(res);
      expect(status).toBe(200);
      expect(body.data.title).toBe("Renamed via PUT");
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// AI updateReminder race scenarios
// ---------------------------------------------------------------------------
describe("AI updateReminder tool — status TOCTOU race", () => {
  it("returns {success:false} when status changes between read and write", async () => {
    const id = await insertReminder({ status: "pending" });
    const tools = createTools(TEST_USER.id);

    const restore = interceptNextFindOne(async (coll) => {
      await coll.updateOne(
        { _id: new ObjectId(id), userId: TEST_USER.id },
        { $set: { status: "in_progress", completed: false } },
      );
    });

    try {
      const result = await tools.updateReminder.execute({
        reminderId: id,
        status: "completed",
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/status changed/i);
    } finally {
      restore();
    }

    const final = await getDb()
      .collection("reminders")
      .findOne({ _id: new ObjectId(id) });
    expect(final.status).toBe("in_progress");
  });

  it("succeeds on non-status-changing AI update even with concurrent status race", async () => {
    const id = await insertReminder({ status: "pending" });
    const tools = createTools(TEST_USER.id);

    const restore = interceptNextFindOne(async (coll) => {
      await coll.updateOne(
        { _id: new ObjectId(id), userId: TEST_USER.id },
        { $set: { status: "completed", completed: true } },
      );
    });

    try {
      const result = await tools.updateReminder.execute({
        reminderId: id,
        title: "AI renamed",
      });
      expect(result.success).toBe(true);
    } finally {
      restore();
    }

    const final = await getDb()
      .collection("reminders")
      .findOne({ _id: new ObjectId(id) });
    expect(final.title).toBe("AI renamed");
    expect(final.status).toBe("completed");
  });
});
