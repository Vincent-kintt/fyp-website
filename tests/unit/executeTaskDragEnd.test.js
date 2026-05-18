/**
 * Tests for executeTaskDragEnd (M6 — shared orchestration core).
 *
 * The shared core handles snapshot / optimistic write / API call / rollback.
 * Callers (dashboard and calendar) supply context-specific apiCall + patch.
 *
 * No React rendering — pure async function with all side effects injected.
 */

import { describe, it, expect, vi } from "vitest";

// reminderKeys is the same import path as dashboard / calendar use
const { reminderKeys } = await import("@/lib/queryKeys.js");
const { executeTaskDragEnd } = await import("@/lib/dnd/executeTaskDragEnd.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides = {}) {
  const id = overrides.id ?? `task-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    title: `Task ${id}`,
    status: "pending",
    completed: false,
    sortOrder: 1000,
    dateTime: new Date("2026-05-16T09:00:00Z").toISOString(),
    snoozedUntil: null,
    ...overrides,
  };
}

function makeMocks(originalTasks) {
  const setQueryDataSpy = vi.fn();
  const queryClient = {
    getQueryData: vi.fn(() => originalTasks),
    setQueryData: setQueryDataSpy,
  };
  const toast = { error: vi.fn(), success: vi.fn(), warning: vi.fn() };
  const t = vi.fn((key, params) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
  );
  return { queryClient, toast, t, setQueryDataSpy };
}

// ---------------------------------------------------------------------------
// 1. Single-task optimistic patch — success path
// ---------------------------------------------------------------------------
describe("executeTaskDragEnd — single-task optimistic patch", () => {
  it("snapshots, writes optimistic update, calls apiCall, fires success toast", async () => {
    const task = makeTask({ id: "t1" });
    const originalTasks = [task];
    const { queryClient, toast, t, setQueryDataSpy } = makeMocks(originalTasks);
    const apiCall = vi.fn(() => Promise.resolve({}));

    await executeTaskDragEnd({
      activeId: "t1",
      tasks: originalTasks,
      queryClient,
      optimisticPatch: { dateTime: "2026-05-20T09:00:00.000Z" },
      apiCall,
      toast,
      t,
      successKey: "movedTo",
      successParams: { date: "5/20" },
    });

    // Snapshot taken first
    expect(queryClient.getQueryData).toHaveBeenCalledWith(reminderKeys.list({}));

    // Optimistic update applied: matching task is patched, others unchanged
    expect(setQueryDataSpy).toHaveBeenCalledOnce();
    const [key, updated] = setQueryDataSpy.mock.calls[0];
    expect(key).toEqual(reminderKeys.list({}));
    const updatedTask = updated.find((x) => x.id === "t1");
    expect(updatedTask.dateTime).toBe("2026-05-20T09:00:00.000Z");
    expect(updatedTask.title).toBe(task.title); // other fields preserved

    // apiCall fired
    expect(apiCall).toHaveBeenCalledOnce();

    // Success toast with translated key + params
    expect(toast.success).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith(
      'movedTo:{"date":"5/20"}',
    );
    expect(toast.error).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. Single-task — apiCall rejects → rollback + error toast
// ---------------------------------------------------------------------------
describe("executeTaskDragEnd — rollback on apiCall rejection", () => {
  it("rolls back optimistic update and fires error toast", async () => {
    const task = makeTask({ id: "t1" });
    const originalTasks = [task];
    const { queryClient, toast, t, setQueryDataSpy } = makeMocks(originalTasks);
    const apiCall = vi.fn(() => Promise.reject(new Error("network")));

    await executeTaskDragEnd({
      activeId: "t1",
      tasks: originalTasks,
      queryClient,
      optimisticPatch: { dateTime: "2026-05-20T09:00:00.000Z" },
      apiCall,
      toast,
      t,
      successKey: "movedTo",
      successParams: { date: "5/20" },
      errorKey: "moveFailed",
    });

    // setQueryData called twice: optimistic then rollback
    expect(setQueryDataSpy).toHaveBeenCalledTimes(2);
    expect(setQueryDataSpy.mock.calls[1][0]).toEqual(reminderKeys.list({}));
    expect(setQueryDataSpy.mock.calls[1][1]).toBe(originalTasks); // identity preserved

    // Error toast
    expect(toast.error).toHaveBeenCalledOnce();
    expect(toast.error).toHaveBeenCalledWith("moveFailed");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("uses default errorKey 'moveFailed' when not provided", async () => {
    const task = makeTask({ id: "t1" });
    const originalTasks = [task];
    const { queryClient, toast, t } = makeMocks(originalTasks);
    const apiCall = vi.fn(() => Promise.reject(new Error("network")));

    await executeTaskDragEnd({
      activeId: "t1",
      tasks: originalTasks,
      queryClient,
      optimisticPatch: { dateTime: "2026-05-20T09:00:00.000Z" },
      apiCall,
      toast,
      t,
      successKey: "movedTo",
      successParams: { date: "5/20" },
    });

    expect(toast.error).toHaveBeenCalledWith("moveFailed");
  });
});

// ---------------------------------------------------------------------------
// 3. Full-list replacement via optimisticTasks (e.g. within-section reorder)
// ---------------------------------------------------------------------------
describe("executeTaskDragEnd — full-list replacement mode", () => {
  it("writes optimisticTasks directly when provided; skips per-task merge", async () => {
    const t1 = makeTask({ id: "t1", sortOrder: 1000 });
    const t2 = makeTask({ id: "t2", sortOrder: 2000 });
    const t3 = makeTask({ id: "t3", sortOrder: 3000 });
    const originalTasks = [t1, t2, t3];
    const { queryClient, toast, t, setQueryDataSpy } = makeMocks(originalTasks);

    // Caller already computed the reordered list (with new sortOrders)
    const reorderedList = [
      { ...t2, sortOrder: 1000 },
      { ...t3, sortOrder: 2000 },
      { ...t1, sortOrder: 3000 },
    ];
    const apiCall = vi.fn(() => Promise.resolve({}));

    await executeTaskDragEnd({
      activeId: "t1",
      tasks: originalTasks,
      queryClient,
      optimisticTasks: reorderedList,
      apiCall,
      toast,
      t,
      // No successKey provided → silent success (e.g. within-section reorder)
    });

    expect(setQueryDataSpy).toHaveBeenCalledOnce();
    expect(setQueryDataSpy.mock.calls[0][1]).toBe(reorderedList);
    expect(apiCall).toHaveBeenCalledOnce();
    // No success toast when successKey is absent
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("rolls back via originalTasks identity on failure (full-list mode)", async () => {
    const t1 = makeTask({ id: "t1", sortOrder: 1000 });
    const originalTasks = [t1];
    const { queryClient, toast, t, setQueryDataSpy } = makeMocks(originalTasks);
    const apiCall = vi.fn(() => Promise.reject(new Error("fail")));

    await executeTaskDragEnd({
      activeId: "t1",
      tasks: originalTasks,
      queryClient,
      optimisticTasks: [{ ...t1, sortOrder: 5000 }],
      apiCall,
      toast,
      t,
      errorKey: "reorderFailed",
    });

    expect(setQueryDataSpy).toHaveBeenCalledTimes(2);
    expect(setQueryDataSpy.mock.calls[1][1]).toBe(originalTasks);
    expect(toast.error).toHaveBeenCalledWith("reorderFailed");
  });
});

// ---------------------------------------------------------------------------
// 4. Calendar context characterization — date drop preserving time-of-day
// ---------------------------------------------------------------------------
describe("executeTaskDragEnd — calendar date drop characterization", () => {
  it("drops task from 5/20 09:00 onto 5/22 → time preserved, status untouched", async () => {
    const task = makeTask({
      id: "t1",
      dateTime: new Date("2026-05-20T09:00:00").toISOString(),
    });
    const originalTasks = [task];
    const { queryClient, toast, t, setQueryDataSpy } = makeMocks(originalTasks);

    // Calendar caller computes newDateTime keeping the original time-of-day.
    // Here we simulate the result computed by computeNewDateTime(orig, 5/22).
    const newDateTime = (() => {
      const orig = new Date(task.dateTime);
      const target = new Date("2026-05-22T00:00:00");
      target.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
      return target.toISOString();
    })();

    const apiCall = vi.fn(() => Promise.resolve({}));

    await executeTaskDragEnd({
      activeId: "t1",
      tasks: originalTasks,
      queryClient,
      optimisticPatch: { dateTime: newDateTime },
      apiCall,
      toast,
      t,
      successKey: "movedTo",
      successParams: { date: "5/22" },
    });

    const optimistic = setQueryDataSpy.mock.calls[0][1].find((x) => x.id === "t1");
    expect(optimistic.dateTime).toBe(newDateTime);
    // Status untouched (calendar drops never change status)
    expect(optimistic.status).toBe("pending");
    expect(optimistic.completed).toBe(false);
    expect(optimistic.snoozedUntil).toBeNull();

    expect(apiCall).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith('movedTo:{"date":"5/22"}');
  });
});

// ---------------------------------------------------------------------------
// 5. Early returns
// ---------------------------------------------------------------------------
describe("executeTaskDragEnd — early returns", () => {
  it("missing activeId returns without side effects", async () => {
    const { queryClient, toast, t, setQueryDataSpy } = makeMocks([]);
    const apiCall = vi.fn();

    await executeTaskDragEnd({
      activeId: null,
      tasks: [],
      queryClient,
      optimisticPatch: { dateTime: "x" },
      apiCall,
      toast,
      t,
      successKey: "movedTo",
    });

    expect(setQueryDataSpy).not.toHaveBeenCalled();
    expect(apiCall).not.toHaveBeenCalled();
  });

  it("task not found in list returns without side effects", async () => {
    const originalTasks = [makeTask({ id: "t1" })];
    const { queryClient, toast, t, setQueryDataSpy } = makeMocks(originalTasks);
    const apiCall = vi.fn();

    await executeTaskDragEnd({
      activeId: "t-missing",
      tasks: originalTasks,
      queryClient,
      optimisticPatch: { dateTime: "x" },
      apiCall,
      toast,
      t,
      successKey: "movedTo",
    });

    expect(setQueryDataSpy).not.toHaveBeenCalled();
    expect(apiCall).not.toHaveBeenCalled();
  });
});
