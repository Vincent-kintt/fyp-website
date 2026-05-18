/**
 * Tests for `executeDeleteTask` and `executeUndoTask` (H6).
 *
 * Per CLAUDE.md "Hooks that mix React state with side effects: extract the
 * side-effect body to a top-level `execute*` async function with dependency
 * injection; test that directly." Same shape as `executeDragEnd`.
 *
 * The behaviour under test:
 *
 * - `executeDeleteTask` snapshots the cache + the to-be-deleted task,
 *   optimistically removes it, and fires `fetch DELETE` IMMEDIATELY (no
 *   setTimeout). It then shows a 5s undo toast whose `onClick` calls
 *   `executeUndoTask` with the snapshot. On failure it restores the cache.
 *
 * - `executeUndoTask` maps the snapshot to a clean POST payload (no
 *   server-derived fields like `id`, `_id`, `completedAt`, `username`,
 *   `userId`, `notificationSent`, timestamps) and calls
 *   `createReminder.mutateAsync(payload)`.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  }),
}));

const { executeDeleteTask, executeUndoTask } = await import(
  "@/hooks/useTasks.js"
);
const { reminderKeys } = await import("@/lib/queryKeys.js");

function makeTask(overrides = {}) {
  return {
    id: "t1",
    title: "Buy milk",
    description: "",
    dateTime: "2026-05-18T09:00:00.000Z",
    status: "pending",
    completed: false,
    completedAt: null,
    snoozedUntil: null,
    sortOrder: 1000,
    tags: [],
    category: "personal",
    priority: "medium",
    recurring: false,
    recurringType: null,
    subtasks: [],
    remark: "",
    inboxState: "processed",
    duration: null,
    ...overrides,
  };
}

function makeT() {
  return vi.fn((key) => key);
}

function makeToast() {
  // The factory toast — `toast(message, options)` — plus methods.
  const fn = vi.fn();
  fn.error = vi.fn();
  fn.success = vi.fn();
  fn.warning = vi.fn();
  return fn;
}

// ---------------------------------------------------------------------------
// executeDeleteTask — immediate fetch DELETE
// ---------------------------------------------------------------------------
describe("executeDeleteTask — fires fetch DELETE immediately", () => {
  it("fetch DELETE is invoked during the awaited call (NOT deferred by setTimeout) and the optimistic cache update happens before fetch", async () => {
    const target = makeTask({ id: "t1" });
    const other = makeTask({ id: "t2" });
    const previous = [target, other];

    const queryClient = {
      cancelQueries: vi.fn(() => Promise.resolve()),
      getQueryData: vi.fn(() => previous),
      setQueryData: vi.fn(),
      invalidateQueries: vi.fn(),
    };

    // Record call ordering between setQueryData and fetch.
    const callLog = [];
    queryClient.setQueryData.mockImplementation((...args) => {
      callLog.push({ name: "setQueryData", args });
    });
    const fetch = vi.fn((...args) => {
      callLog.push({ name: "fetch", args });
      return Promise.resolve({ ok: true });
    });

    const toast = makeToast();
    const t = makeT();
    const createReminder = { mutateAsync: vi.fn(() => Promise.resolve({})) };

    // Spy on setTimeout — H6 is specifically about removing setTimeout
    // deferral, so the test enforces it's not used to schedule the DELETE.
    const setTimeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(() => {
        throw new Error(
          "executeDeleteTask must NOT use setTimeout to defer the DELETE call",
        );
      });

    try {
      await executeDeleteTask({
        id: "t1",
        queryClient,
        fetch,
        reminderKeys,
        toast,
        t,
        createReminder,
      });
    } finally {
      setTimeoutSpy.mockRestore();
    }

    // fetch was called with the expected args.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/reminders/t1", {
      method: "DELETE",
    });

    // Optimistic update (filter out the deleted task) precedes fetch.
    const optimisticCall = callLog.find((c) => c.name === "setQueryData");
    const fetchCall = callLog.find((c) => c.name === "fetch");
    expect(callLog.indexOf(optimisticCall)).toBeLessThan(
      callLog.indexOf(fetchCall),
    );
    const [keyArg, updater] = optimisticCall.args;
    expect(keyArg).toEqual(reminderKeys.list({}));
    const newList = typeof updater === "function" ? updater(previous) : updater;
    expect(newList).toEqual([other]);

    // Undo toast displayed for 5 seconds.
    expect(toast).toHaveBeenCalledTimes(1);
    const [, toastOpts] = toast.mock.calls[0];
    expect(toastOpts.duration).toBe(5000);
    expect(typeof toastOpts.action.onClick).toBe("function");

    // onSettled invalidates.
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: reminderKeys.all,
    });

    expect(toast.error).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// executeDeleteTask — fetch failure rolls back
// ---------------------------------------------------------------------------
describe("executeDeleteTask — fetch failure", () => {
  it("restores the cache snapshot and shows the deleteFailed error toast", async () => {
    const target = makeTask({ id: "t1" });
    const other = makeTask({ id: "t2" });
    const previous = [target, other];

    const queryClient = {
      cancelQueries: vi.fn(() => Promise.resolve()),
      getQueryData: vi.fn(() => previous),
      setQueryData: vi.fn(),
      invalidateQueries: vi.fn(),
    };

    const fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
    const toast = makeToast();
    const t = makeT();
    const createReminder = { mutateAsync: vi.fn() };

    await executeDeleteTask({
      id: "t1",
      queryClient,
      fetch,
      reminderKeys,
      toast,
      t,
      createReminder,
    });

    // setQueryData called twice: optimistic remove + rollback to snapshot.
    expect(queryClient.setQueryData).toHaveBeenCalledTimes(2);
    expect(queryClient.setQueryData.mock.calls[1][0]).toEqual(
      reminderKeys.list({}),
    );
    expect(queryClient.setQueryData.mock.calls[1][1]).toBe(previous);

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("deleteFailed");

    // No undo toast on failure.
    expect(toast).not.toHaveBeenCalled();

    // No compensating mutation triggered on this path.
    expect(createReminder.mutateAsync).not.toHaveBeenCalled();
  });

  it("restores the cache snapshot and shows the error toast when fetch throws", async () => {
    const target = makeTask({ id: "t1" });
    const previous = [target];

    const queryClient = {
      cancelQueries: vi.fn(() => Promise.resolve()),
      getQueryData: vi.fn(() => previous),
      setQueryData: vi.fn(),
      invalidateQueries: vi.fn(),
    };

    const fetch = vi.fn(() => Promise.reject(new Error("network")));
    const toast = makeToast();
    const t = makeT();
    const createReminder = { mutateAsync: vi.fn() };

    await executeDeleteTask({
      id: "t1",
      queryClient,
      fetch,
      reminderKeys,
      toast,
      t,
      createReminder,
    });

    expect(queryClient.setQueryData).toHaveBeenCalledTimes(2);
    expect(queryClient.setQueryData.mock.calls[1][1]).toBe(previous);
    expect(toast.error).toHaveBeenCalledWith("deleteFailed");
    expect(toast).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// executeUndoTask — compensating mutation
// ---------------------------------------------------------------------------
describe("executeUndoTask — compensating mutation", () => {
  it("calls createReminder.mutateAsync with a sanitized POST payload (no id/_id/completedAt/username/userId/server timestamps)", async () => {
    const snapshot = {
      id: "t1",
      _id: "abc123",
      userId: "u1",
      username: "alice",
      title: "Buy milk",
      description: "low fat",
      remark: "",
      dateTime: "2026-05-18T09:00:00.000Z",
      duration: null,
      category: "personal",
      tags: ["shopping"],
      recurring: false,
      recurringType: null,
      priority: "medium",
      subtasks: [],
      inboxState: "processed",
      sortOrder: 2500,
      status: "completed",
      completed: true,
      completedAt: "2026-05-17T08:00:00.000Z",
      snoozedUntil: null,
      notificationSent: true,
      createdAt: "2026-05-15T10:00:00.000Z",
      updatedAt: "2026-05-17T08:00:00.000Z",
    };

    const createReminder = {
      mutateAsync: vi.fn(() => Promise.resolve({ id: "new-id" })),
    };
    const toast = makeToast();
    const t = makeT();

    await executeUndoTask({ snapshot, createReminder, toast, t });

    expect(createReminder.mutateAsync).toHaveBeenCalledTimes(1);
    const [payload] = createReminder.mutateAsync.mock.calls[0];

    // Server-derived fields must be dropped.
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("_id");
    expect(payload).not.toHaveProperty("userId");
    expect(payload).not.toHaveProperty("username");
    expect(payload).not.toHaveProperty("completedAt");
    expect(payload).not.toHaveProperty("notificationSent");
    expect(payload).not.toHaveProperty("createdAt");
    expect(payload).not.toHaveProperty("updatedAt");
    // status/completed are server-derived from the lifecycle — a fresh
    // re-create should start clean, not as completed.
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("completed");

    // Editable fields preserved.
    expect(payload.title).toBe("Buy milk");
    expect(payload.description).toBe("low fat");
    expect(payload.dateTime).toBe("2026-05-18T09:00:00.000Z");
    expect(payload.tags).toEqual(["shopping"]);
    expect(payload.category).toBe("personal");
    expect(payload.priority).toBe("medium");
    expect(payload.sortOrder).toBe(2500);
  });
});
