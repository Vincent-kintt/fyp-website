import { describe, it, expect } from "vitest";
import { buildReminderDoc } from "@/lib/reminders/buildReminderDoc.js";

const SESSION = {
  user: { id: "user-abc", username: "alice" },
};

function makeExisting(overrides = {}) {
  return {
    _id: "fakeobjectid",
    userId: "user-abc",
    username: "alice",
    title: "Original Title",
    description: "",
    remark: "",
    dateTime: new Date("2026-05-20T01:00:00Z"),
    duration: null,
    category: "personal",
    tags: [],
    recurring: false,
    recurringType: null,
    priority: "medium",
    status: "pending",
    completed: false,
    subtasks: [],
    sortOrder: 0,
    notificationSent: false,
    inboxState: "processed",
    createdAt: new Date("2026-05-01T00:00:00Z"),
    updatedAt: new Date("2026-05-01T00:00:00Z"),
    ...overrides,
  };
}

describe("buildReminderDoc — create mode", () => {
  it("returns insert payload with defaults", () => {
    const out = buildReminderDoc({
      mode: "create",
      patch: { title: "x" },
      session: SESSION,
    });
    expect(out.title).toBe("x");
    expect(out.status).toBe("pending");
    expect(out.completed).toBe(false);
    expect(out.inboxState).toBe("processed");
    expect(out.notificationSent).toBe(false);
    expect(out.userId).toBe("user-abc");
    expect(out.username).toBe("alice");
    expect(out.createdAt).toBeInstanceOf(Date);
    expect(out.updatedAt).toBeInstanceOf(Date);
    expect(out.dateTime).toBeNull();
    expect(out.category).toBe("personal");
    expect(out.tags).toEqual([]);
    expect(out.recurring).toBe(false);
    expect(out.recurringType).toBeNull();
    expect(out.priority).toBe("medium");
    expect(out.duration).toBeNull();
    expect(out.subtasks).toEqual([]);
    expect(out.sortOrder).toBe(0);
    expect(out.description).toBe("");
    expect(out.remark).toBe("");
  });

  it("create mode converts ISO dateTime to Date", () => {
    const out = buildReminderDoc({
      mode: "create",
      patch: { title: "x", dateTime: "2026-06-10T03:00:00Z" },
      session: SESSION,
    });
    expect(out.dateTime).toBeInstanceOf(Date);
    expect(out.dateTime.getTime()).toBe(
      new Date("2026-06-10T03:00:00Z").getTime(),
    );
  });

  it("create mode allows inboxState override", () => {
    const out = buildReminderDoc({
      mode: "create",
      patch: { title: "x", inboxState: "inbox" },
      session: SESSION,
    });
    expect(out.inboxState).toBe("inbox");
  });

  it("create mode derives category from tags when not provided", () => {
    const out = buildReminderDoc({
      mode: "create",
      patch: { title: "x", tags: ["work"] },
      session: SESSION,
    });
    expect(out.category).toBe("work");
  });

  it("create mode sets recurringType to null when recurring is false", () => {
    const out = buildReminderDoc({
      mode: "create",
      patch: { title: "x", recurring: false, recurringType: "daily" },
      session: SESSION,
    });
    expect(out.recurringType).toBeNull();
  });
});

describe("buildReminderDoc — put mode (H3 fix)", () => {
  it("put with same dateTime does NOT reset notificationSent (H3)", () => {
    const existing = makeExisting({
      dateTime: new Date("2026-05-20T01:00:00Z"),
    });
    const out = buildReminderDoc({
      mode: "put",
      existing,
      patch: { title: "new", dateTime: "2026-05-20T01:00:00Z" },
    });
    expect(out).not.toHaveProperty("notificationSent");
  });

  it("put with changed dateTime DOES reset notificationSent", () => {
    const existing = makeExisting({
      dateTime: new Date("2026-05-20T01:00:00Z"),
    });
    const out = buildReminderDoc({
      mode: "put",
      existing,
      patch: { title: "new", dateTime: "2026-05-20T02:00:00Z" },
    });
    expect(out.notificationSent).toBe(false);
  });

  it("put preserves PUT body shape — recurring:false forces recurringType:null", () => {
    const existing = makeExisting();
    const out = buildReminderDoc({
      mode: "put",
      existing,
      patch: {
        title: "x",
        recurring: false,
        recurringType: "daily",
      },
    });
    expect(out.recurring).toBe(false);
    expect(out.recurringType).toBeNull();
  });

  it("put with status applies completed derivation", () => {
    const existing = makeExisting({ status: "pending" });
    const out = buildReminderDoc({
      mode: "put",
      existing,
      patch: { title: "done", status: "completed" },
    });
    expect(out.status).toBe("completed");
    expect(out.completed).toBe(true);
  });

  it("put without dateTime sets dateTime null (PUT is full body)", () => {
    const existing = makeExisting();
    const out = buildReminderDoc({
      mode: "put",
      existing,
      patch: { title: "x" },
    });
    expect(out.dateTime).toBeNull();
  });

  it("put inboxState promotion: inbox + new dateTime → processed", () => {
    const existing = makeExisting({
      inboxState: "inbox",
      dateTime: null,
    });
    const out = buildReminderDoc({
      mode: "put",
      existing,
      patch: { title: "x", dateTime: "2026-06-10T03:00:00Z" },
    });
    expect(out.inboxState).toBe("processed");
  });

  it("put inboxState not promoted on title-only edit (no dateTime, no completion)", () => {
    const existing = makeExisting({
      inboxState: "inbox",
      dateTime: null,
    });
    const out = buildReminderDoc({
      mode: "put",
      existing,
      patch: { title: "renamed" },
    });
    expect(out).not.toHaveProperty("inboxState");
  });

  it("put inboxState promotion: inbox + completed status → processed", () => {
    const existing = makeExisting({ inboxState: "inbox", status: "pending" });
    const out = buildReminderDoc({
      mode: "put",
      existing,
      patch: { title: "x", status: "completed" },
    });
    expect(out.inboxState).toBe("processed");
  });
});

describe("buildReminderDoc — patch mode (sparse semantics)", () => {
  it("patch without dateTime does NOT touch notificationSent", () => {
    const existing = makeExisting();
    const out = buildReminderDoc({
      mode: "patch",
      existing,
      patch: { title: "new" },
    });
    expect(out).not.toHaveProperty("notificationSent");
  });

  it("patch with dateTime (same value) does NOT reset notificationSent", () => {
    const existing = makeExisting({
      dateTime: new Date("2026-05-20T01:00:00Z"),
    });
    const out = buildReminderDoc({
      mode: "patch",
      existing,
      patch: { dateTime: "2026-05-20T01:00:00Z" },
    });
    expect(out).not.toHaveProperty("notificationSent");
  });

  it("patch with dateTime (different value) DOES reset notificationSent", () => {
    const existing = makeExisting({
      dateTime: new Date("2026-05-20T01:00:00Z"),
    });
    const out = buildReminderDoc({
      mode: "patch",
      existing,
      patch: { dateTime: "2026-05-20T02:00:00Z" },
    });
    expect(out.notificationSent).toBe(false);
    expect(out.dateTime).toBeInstanceOf(Date);
  });

  it("patch sparse semantic: only tags + updatedAt, nothing else", () => {
    const existing = makeExisting();
    const out = buildReminderDoc({
      mode: "patch",
      existing,
      patch: { tags: ["work"] },
    });
    const keys = Object.keys(out).sort();
    expect(keys).toEqual(["tags", "updatedAt"].sort());
    expect(out.tags).toEqual(["work"]);
  });

  it("patch with status applies derived completed + completedAt stamp", () => {
    const existing = makeExisting({ status: "pending" });
    const out = buildReminderDoc({
      mode: "patch",
      existing,
      patch: { status: "completed" },
    });
    expect(out.status).toBe("completed");
    expect(out.completed).toBe(true);
    expect(out.completedAt).toBeInstanceOf(Date);
  });

  it("patch with status in_progress stamps startedAt", () => {
    const existing = makeExisting({ status: "pending" });
    const out = buildReminderDoc({
      mode: "patch",
      existing,
      patch: { status: "in_progress" },
    });
    expect(out.status).toBe("in_progress");
    expect(out.startedAt).toBeInstanceOf(Date);
  });

  it("patch clears snoozedUntil when transitioning out of snoozed", () => {
    const existing = makeExisting({
      status: "snoozed",
      snoozedUntil: new Date("2026-05-21T00:00:00Z"),
    });
    const out = buildReminderDoc({
      mode: "patch",
      existing,
      patch: { status: "pending" },
    });
    expect(out.snoozedUntil).toBeNull();
  });

  it("patch with status snoozed sets snoozedUntil from patch", () => {
    const existing = makeExisting({ status: "pending" });
    const out = buildReminderDoc({
      mode: "patch",
      existing,
      patch: { status: "snoozed", snoozedUntil: "2026-05-22T00:00:00Z" },
    });
    expect(out.status).toBe("snoozed");
    expect(out.snoozedUntil).toBeInstanceOf(Date);
  });

  it("patch with completed:true (legacy) maps to status completed", () => {
    const existing = makeExisting({ status: "pending", completed: false });
    const out = buildReminderDoc({
      mode: "patch",
      existing,
      patch: { completed: true },
    });
    expect(out.completed).toBe(true);
    expect(out.status).toBe("completed");
    expect(out.completedAt).toBeInstanceOf(Date);
  });

  it("patch with completed:false (legacy, was completed) maps to status pending", () => {
    const existing = makeExisting({ status: "completed", completed: true });
    const out = buildReminderDoc({
      mode: "patch",
      existing,
      patch: { completed: false },
    });
    expect(out.completed).toBe(false);
    expect(out.status).toBe("pending");
  });

  it("patch inbox promotion via dateTime set", () => {
    const existing = makeExisting({
      inboxState: "inbox",
      dateTime: null,
    });
    const out = buildReminderDoc({
      mode: "patch",
      existing,
      patch: { dateTime: "2026-06-10T03:00:00Z" },
    });
    expect(out.inboxState).toBe("processed");
  });

  it("patch inbox NOT promoted on title-only edit", () => {
    const existing = makeExisting({ inboxState: "inbox", dateTime: null });
    const out = buildReminderDoc({
      mode: "patch",
      existing,
      patch: { title: "x" },
    });
    expect(out).not.toHaveProperty("inboxState");
  });
});

describe("buildReminderDoc — input contract", () => {
  it("throws when mode is invalid", () => {
    expect(() =>
      buildReminderDoc({ mode: "wat", patch: { title: "x" } }),
    ).toThrow();
  });

  it("throws when mode is create but session is missing", () => {
    expect(() =>
      buildReminderDoc({ mode: "create", patch: { title: "x" } }),
    ).toThrow();
  });

  it("throws when mode is put but existing is missing", () => {
    expect(() =>
      buildReminderDoc({ mode: "put", patch: { title: "x" } }),
    ).toThrow();
  });
});
