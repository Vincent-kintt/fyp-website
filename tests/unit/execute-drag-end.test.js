/**
 * Tests for executeDragEnd (C5 PR3b/7).
 *
 * executeDragEnd is a pure async function with all side effects injected,
 * so no React rendering is needed — plain vitest with mocks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock client-only dnd-kit imports used by useTaskDnD.js module
vi.mock("@dnd-kit/core", () => ({
  PointerSensor: class {},
  TouchSensor: class {},
  KeyboardSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  defaultDropAnimationSideEffects: vi.fn(() => ({})),
  pointerWithin: vi.fn(() => []),
  rectIntersection: vi.fn(() => []),
  closestCenter: vi.fn(() => []),
  getFirstCollision: vi.fn(() => null),
}));
vi.mock("@dnd-kit/sortable", async () => {
  const actual = await vi.importActual("@dnd-kit/sortable");
  return {
    ...actual,
    sortableKeyboardCoordinates: vi.fn(),
  };
});

// Mock sonner — executeDragEnd uses the injected toast, but the hook imports sonner
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

const { executeDragEnd } = await import("@/hooks/useTaskDnD.js");
const { SECTION_IDS } = await import("@/lib/dnd.js");

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

function makeEvent({ activeId, overId } = {}) {
  return {
    active: { id: activeId },
    over: overId !== undefined ? { id: overId } : null,
  };
}

function makeMocks(extraTasks = []) {
  const task1 = makeTask({ id: "t1", sortOrder: 1000 });
  const task2 = makeTask({ id: "t2", sortOrder: 2000 });
  const task3 = makeTask({ id: "t3", sortOrder: 3000 });
  const originalTasks = [task1, task2, task3, ...extraTasks];

  const setQueryDataSpy = vi.fn();
  const queryClient = {
    getQueryData: vi.fn(() => originalTasks),
    setQueryData: setQueryDataSpy,
  };
  const toast = { error: vi.fn(), success: vi.fn(), warning: vi.fn() };
  const t = vi.fn((key, params) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
  );
  const reorderReminders = vi.fn(() => Promise.resolve({}));
  const patchReminderStatus = vi.fn(() => Promise.resolve({}));

  return {
    task1,
    task2,
    task3,
    originalTasks,
    queryClient,
    toast,
    t,
    reorderReminders,
    patchReminderStatus,
    setQueryDataSpy,
  };
}

// ---------------------------------------------------------------------------
// 1. Within-section reorder — success
// ---------------------------------------------------------------------------
describe("executeDragEnd — within-section reorder", () => {
  it("success: reorders tasks optimistically and calls reorderReminders", async () => {
    const { task1, task2, task3, originalTasks, queryClient, toast, t, reorderReminders, patchReminderStatus, setQueryDataSpy } = makeMocks();

    const tasks = [task1, task2, task3];
    const taskToSection = new Map([
      ["t1", SECTION_IDS.TODAY],
      ["t2", SECTION_IDS.TODAY],
      ["t3", SECTION_IDS.TODAY],
    ]);
    // getSectionTasks returns TODAY tasks in order
    const getSectionTasks = vi.fn(() => [task1, task2, task3]);

    // Drag t1 over t3 (move task1 to position 2)
    const event = makeEvent({ activeId: "t1", overId: "t3" });

    await executeDragEnd({
      event,
      tasks,
      taskToSection,
      getSectionTasks,
      queryClient,
      reorderReminders,
      patchReminderStatus,
      toast,
      t,
    });

    // setQueryData called once with optimistically reordered tasks
    expect(setQueryDataSpy).toHaveBeenCalledOnce();
    const updatedTasks = setQueryDataSpy.mock.calls[0][1];
    // After arrayMove([t1,t2,t3], 0, 2) → [t2, t3, t1], sortOrders 1000/2000/3000
    const ids = updatedTasks.map((t) => t.id);
    expect(ids).toContain("t1");
    expect(ids).toContain("t2");
    expect(ids).toContain("t3");
    // Check the task originally at index 0 (t1) moved, confirm sortOrders applied
    const t2entry = updatedTasks.find((t) => t.id === "t2");
    const t3entry = updatedTasks.find((t) => t.id === "t3");
    const t1entry = updatedTasks.find((t) => t.id === "t1");
    expect(t2entry.sortOrder).toBe(1000);
    expect(t3entry.sortOrder).toBe(2000);
    expect(t1entry.sortOrder).toBe(3000);

    // reorderReminders called with computeSortOrders output
    expect(reorderReminders).toHaveBeenCalledOnce();
    const sortUpdates = reorderReminders.mock.calls[0][0];
    // computeSortOrders assigns sortOrder = (index+1)*1000
    expect(sortUpdates).toEqual([
      { id: "t2", sortOrder: 1000 },
      { id: "t3", sortOrder: 2000 },
      { id: "t1", sortOrder: 3000 },
    ]);

    // No toast on success
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(patchReminderStatus).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 2. Within-section reorder — API failure rollback
  // ---------------------------------------------------------------------------
  it("failure: rolls back to originalTasks and shows reorderFailed toast", async () => {
    const { task1, task2, task3, originalTasks, queryClient, toast, t, patchReminderStatus, setQueryDataSpy } = makeMocks();

    const reorderReminders = vi.fn(() => Promise.reject(new Error("network error")));
    const tasks = [task1, task2, task3];
    const taskToSection = new Map([
      ["t1", SECTION_IDS.TODAY],
      ["t2", SECTION_IDS.TODAY],
      ["t3", SECTION_IDS.TODAY],
    ]);
    const getSectionTasks = vi.fn(() => [task1, task2, task3]);
    const event = makeEvent({ activeId: "t1", overId: "t3" });

    await executeDragEnd({
      event,
      tasks,
      taskToSection,
      getSectionTasks,
      queryClient,
      reorderReminders,
      patchReminderStatus,
      toast,
      t,
    });

    // setQueryData called twice: optimistic then rollback
    expect(setQueryDataSpy).toHaveBeenCalledTimes(2);
    expect(setQueryDataSpy.mock.calls[1][1]).toBe(originalTasks);

    // toast.error with reorderFailed key
    expect(toast.error).toHaveBeenCalledOnce();
    expect(toast.error).toHaveBeenCalledWith("reorderFailed");
    expect(toast.success).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. Cross-section date move (Today → Tomorrow) — success
// ---------------------------------------------------------------------------
describe("executeDragEnd — cross-section date move", () => {
  it("Today → Tomorrow success: optimistic update with newDateTime, reorderReminders called, toast.success", async () => {
    const { task1, originalTasks, queryClient, toast, t, reorderReminders, patchReminderStatus, setQueryDataSpy } = makeMocks();

    const tasks = [task1];
    const taskToSection = new Map([["t1", SECTION_IDS.TODAY]]);
    const getSectionTasks = vi.fn(() => [task1]);
    const event = makeEvent({ activeId: "t1", overId: SECTION_IDS.TOMORROW });

    await executeDragEnd({
      event,
      tasks,
      taskToSection,
      getSectionTasks,
      queryClient,
      reorderReminders,
      patchReminderStatus,
      toast,
      t,
    });

    // setQueryData called once with optimistically updated task
    expect(setQueryDataSpy).toHaveBeenCalledOnce();
    const updatedTasks = setQueryDataSpy.mock.calls[0][1];
    const updatedTask = updatedTasks.find((t) => t.id === "t1");
    // dateTime should be updated (different from original)
    expect(updatedTask.dateTime).toBeDefined();
    expect(updatedTask.dateTime).not.toBe(task1.dateTime);

    // reorderReminders called with [{id, sortOrder, dateTime}]
    expect(reorderReminders).toHaveBeenCalledOnce();
    const reorderArg = reorderReminders.mock.calls[0][0];
    expect(reorderArg).toHaveLength(1);
    expect(reorderArg[0].id).toBe("t1");
    expect(reorderArg[0].sortOrder).toBe(task1.sortOrder);
    expect(reorderArg[0].dateTime).toBe(updatedTask.dateTime);

    // toast.success called
    expect(toast.success).toHaveBeenCalledOnce();
    expect(patchReminderStatus).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 4. Cross-section date move — API failure rollback
  // ---------------------------------------------------------------------------
  it("Today → Tomorrow failure: rollback + toast.error(moveFailed)", async () => {
    const { task1, originalTasks, queryClient, toast, t, patchReminderStatus, setQueryDataSpy } = makeMocks();

    const reorderReminders = vi.fn(() => Promise.reject(new Error("API error")));
    const tasks = [task1];
    const taskToSection = new Map([["t1", SECTION_IDS.TODAY]]);
    const getSectionTasks = vi.fn(() => [task1]);
    const event = makeEvent({ activeId: "t1", overId: SECTION_IDS.TOMORROW });

    await executeDragEnd({
      event,
      tasks,
      taskToSection,
      getSectionTasks,
      queryClient,
      reorderReminders,
      patchReminderStatus,
      toast,
      t,
    });

    expect(setQueryDataSpy).toHaveBeenCalledTimes(2);
    expect(setQueryDataSpy.mock.calls[1][1]).toBe(originalTasks);
    expect(toast.error).toHaveBeenCalledWith("moveFailed");
    expect(toast.success).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5. Cross-section to COMPLETED — success
// ---------------------------------------------------------------------------
describe("executeDragEnd — move to COMPLETED", () => {
  it("success: optimistic completed=true, patchReminderStatus called, toast.success", async () => {
    const { task1, queryClient, toast, t, reorderReminders, patchReminderStatus, setQueryDataSpy } = makeMocks();

    const tasks = [task1];
    const taskToSection = new Map([["t1", SECTION_IDS.TODAY]]);
    const getSectionTasks = vi.fn(() => [task1]);
    const event = makeEvent({ activeId: "t1", overId: SECTION_IDS.COMPLETED });

    const beforeCall = Date.now();
    await executeDragEnd({
      event,
      tasks,
      taskToSection,
      getSectionTasks,
      queryClient,
      reorderReminders,
      patchReminderStatus,
      toast,
      t,
    });
    const afterCall = Date.now();

    expect(setQueryDataSpy).toHaveBeenCalledOnce();
    const updatedTasks = setQueryDataSpy.mock.calls[0][1];
    const updatedTask = updatedTasks.find((t) => t.id === "t1");
    expect(updatedTask.status).toBe("completed");
    expect(updatedTask.completed).toBe(true);
    expect(updatedTask.completedAt).toBeDefined();
    // completedAt should be a recent ISO string
    const completedAtMs = new Date(updatedTask.completedAt).getTime();
    expect(completedAtMs).toBeGreaterThanOrEqual(beforeCall);
    expect(completedAtMs).toBeLessThanOrEqual(afterCall);

    expect(patchReminderStatus).toHaveBeenCalledOnce();
    const [patchId, patchBody] = patchReminderStatus.mock.calls[0];
    expect(patchId).toBe("t1");
    expect(patchBody.status).toBe("completed");
    expect(patchBody.completed).toBe(true);

    expect(toast.success).toHaveBeenCalledOnce();
    expect(reorderReminders).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 6. Cross-section to COMPLETED — failure rollback
  // ---------------------------------------------------------------------------
  it("failure: rollback + toast.error(moveFailed)", async () => {
    const { task1, originalTasks, queryClient, toast, t, reorderReminders, setQueryDataSpy } = makeMocks();

    const patchReminderStatus = vi.fn(() => Promise.reject(new Error("fail")));
    const tasks = [task1];
    const taskToSection = new Map([["t1", SECTION_IDS.TODAY]]);
    const getSectionTasks = vi.fn(() => [task1]);
    const event = makeEvent({ activeId: "t1", overId: SECTION_IDS.COMPLETED });

    await executeDragEnd({
      event,
      tasks,
      taskToSection,
      getSectionTasks,
      queryClient,
      reorderReminders,
      patchReminderStatus,
      toast,
      t,
    });

    expect(setQueryDataSpy).toHaveBeenCalledTimes(2);
    expect(setQueryDataSpy.mock.calls[1][1]).toBe(originalTasks);
    expect(toast.error).toHaveBeenCalledWith("moveFailed");
    expect(toast.success).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7. Cross-section to SNOOZED — success
// ---------------------------------------------------------------------------
describe("executeDragEnd — move to SNOOZED", () => {
  it("success: snoozedUntil set from getDefaultSnoozeUntil, patchReminderStatus called", async () => {
    const { task1, queryClient, toast, t, reorderReminders, patchReminderStatus, setQueryDataSpy } = makeMocks();

    const tasks = [task1];
    const taskToSection = new Map([["t1", SECTION_IDS.TODAY]]);
    const getSectionTasks = vi.fn(() => [task1]);
    const event = makeEvent({ activeId: "t1", overId: SECTION_IDS.SNOOZED });

    await executeDragEnd({
      event,
      tasks,
      taskToSection,
      getSectionTasks,
      queryClient,
      reorderReminders,
      patchReminderStatus,
      toast,
      t,
    });

    expect(setQueryDataSpy).toHaveBeenCalledOnce();
    const updatedTasks = setQueryDataSpy.mock.calls[0][1];
    const updatedTask = updatedTasks.find((t) => t.id === "t1");
    expect(updatedTask.status).toBe("snoozed");
    expect(updatedTask.snoozedUntil).toBeDefined();
    // snoozedUntil should be a valid future ISO string
    expect(new Date(updatedTask.snoozedUntil).getTime()).toBeGreaterThan(Date.now());

    expect(patchReminderStatus).toHaveBeenCalledOnce();
    const [patchId, patchBody] = patchReminderStatus.mock.calls[0];
    expect(patchId).toBe("t1");
    expect(patchBody.status).toBe("snoozed");
    expect(patchBody.snoozedUntil).toBe(updatedTask.snoozedUntil);

    expect(toast.success).toHaveBeenCalledOnce();
    expect(reorderReminders).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 8. From COMPLETED back to Today (status reset + date change)
// ---------------------------------------------------------------------------
describe("executeDragEnd — from COMPLETED to date section", () => {
  it("success: status reset to pending, patchReminderStatus with {status, completed, dateTime}", async () => {
    const completedTask = makeTask({
      id: "t1",
      status: "completed",
      completed: true,
      completedAt: new Date("2026-05-15T10:00:00Z").toISOString(),
      snoozedUntil: null,
      // Use yesterday's dateTime so computeNewDateTime to TODAY yields a different string
      dateTime: new Date("2026-05-15T09:00:00Z").toISOString(),
    });
    const originalTasks = [completedTask];
    const setQueryDataSpy = vi.fn();
    const queryClient = {
      getQueryData: vi.fn(() => originalTasks),
      setQueryData: setQueryDataSpy,
    };
    const toast = { error: vi.fn(), success: vi.fn(), warning: vi.fn() };
    const t = vi.fn((key, params) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    );
    const reorderReminders = vi.fn(() => Promise.resolve({}));
    const patchReminderStatus = vi.fn(() => Promise.resolve({}));

    const tasks = [completedTask];
    const taskToSection = new Map([["t1", SECTION_IDS.COMPLETED]]);
    const getSectionTasks = vi.fn(() => [completedTask]);
    const event = makeEvent({ activeId: "t1", overId: SECTION_IDS.TODAY });

    await executeDragEnd({
      event,
      tasks,
      taskToSection,
      getSectionTasks,
      queryClient,
      reorderReminders,
      patchReminderStatus,
      toast,
      t,
    });

    expect(setQueryDataSpy).toHaveBeenCalledOnce();
    const updatedTasks = setQueryDataSpy.mock.calls[0][1];
    const updatedTask = updatedTasks.find((t) => t.id === "t1");
    expect(updatedTask.status).toBe("pending");
    expect(updatedTask.completed).toBe(false);
    expect(updatedTask.snoozedUntil).toBeNull();
    expect(updatedTask.dateTime).toBeDefined();
    // dateTime should be updated to today
    expect(updatedTask.dateTime).not.toBe(completedTask.dateTime);

    expect(patchReminderStatus).toHaveBeenCalledOnce();
    const [patchId, patchBody] = patchReminderStatus.mock.calls[0];
    expect(patchId).toBe("t1");
    expect(patchBody.status).toBe("pending");
    expect(patchBody.completed).toBe(false);
    expect(patchBody.dateTime).toBe(updatedTask.dateTime);

    expect(toast.success).toHaveBeenCalledOnce();
    expect(reorderReminders).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 9. Block drag TO OVERDUE
// ---------------------------------------------------------------------------
describe("executeDragEnd — block drop TO OVERDUE", () => {
  it("early return with no setQueryData or fetch calls", async () => {
    const { task1, queryClient, toast, t, reorderReminders, patchReminderStatus, setQueryDataSpy } = makeMocks();

    const tasks = [task1];
    const taskToSection = new Map([["t1", SECTION_IDS.TODAY]]);
    const getSectionTasks = vi.fn(() => [task1]);
    const event = makeEvent({ activeId: "t1", overId: SECTION_IDS.OVERDUE });

    await executeDragEnd({
      event,
      tasks,
      taskToSection,
      getSectionTasks,
      queryClient,
      reorderReminders,
      patchReminderStatus,
      toast,
      t,
    });

    expect(setQueryDataSpy).not.toHaveBeenCalled();
    expect(reorderReminders).not.toHaveBeenCalled();
    expect(patchReminderStatus).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 10. Block status↔status (Completed → Snoozed)
// ---------------------------------------------------------------------------
describe("executeDragEnd — block status↔status transition", () => {
  it("Completed → Snoozed: toast.warning(restoreFirst), no setQueryData, no fetch", async () => {
    const completedTask = makeTask({
      id: "t1",
      status: "completed",
      completed: true,
    });
    const originalTasks = [completedTask];
    const setQueryDataSpy = vi.fn();
    const queryClient = {
      getQueryData: vi.fn(() => originalTasks),
      setQueryData: setQueryDataSpy,
    };
    const toast = { error: vi.fn(), success: vi.fn(), warning: vi.fn() };
    const t = vi.fn((key) => key);
    const reorderReminders = vi.fn(() => Promise.resolve({}));
    const patchReminderStatus = vi.fn(() => Promise.resolve({}));

    const tasks = [completedTask];
    const taskToSection = new Map([["t1", SECTION_IDS.COMPLETED]]);
    const getSectionTasks = vi.fn(() => [completedTask]);
    const event = makeEvent({ activeId: "t1", overId: SECTION_IDS.SNOOZED });

    await executeDragEnd({
      event,
      tasks,
      taskToSection,
      getSectionTasks,
      queryClient,
      reorderReminders,
      patchReminderStatus,
      toast,
      t,
    });

    expect(toast.warning).toHaveBeenCalledOnce();
    expect(toast.warning).toHaveBeenCalledWith("restoreFirst");
    expect(setQueryDataSpy).not.toHaveBeenCalled();
    expect(reorderReminders).not.toHaveBeenCalled();
    expect(patchReminderStatus).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("Snoozed → Completed: toast.warning(restoreFirst), no side effects", async () => {
    const snoozedTask = makeTask({
      id: "t1",
      status: "snoozed",
      snoozedUntil: new Date("2026-05-17T09:00:00Z").toISOString(),
    });
    const originalTasks = [snoozedTask];
    const setQueryDataSpy = vi.fn();
    const queryClient = {
      getQueryData: vi.fn(() => originalTasks),
      setQueryData: setQueryDataSpy,
    };
    const toast = { error: vi.fn(), success: vi.fn(), warning: vi.fn() };
    const t = vi.fn((key) => key);
    const reorderReminders = vi.fn(() => Promise.resolve({}));
    const patchReminderStatus = vi.fn(() => Promise.resolve({}));

    const tasks = [snoozedTask];
    const taskToSection = new Map([["t1", SECTION_IDS.SNOOZED]]);
    const getSectionTasks = vi.fn(() => [snoozedTask]);
    const event = makeEvent({ activeId: "t1", overId: SECTION_IDS.COMPLETED });

    await executeDragEnd({
      event,
      tasks,
      taskToSection,
      getSectionTasks,
      queryClient,
      reorderReminders,
      patchReminderStatus,
      toast,
      t,
    });

    expect(toast.warning).toHaveBeenCalledWith("restoreFirst");
    expect(setQueryDataSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 11. No `over` or active.id === over.id: early return
// ---------------------------------------------------------------------------
describe("executeDragEnd — early return conditions", () => {
  it("no over: early return, no calls", async () => {
    const { task1, queryClient, toast, t, reorderReminders, patchReminderStatus, setQueryDataSpy } = makeMocks();
    const tasks = [task1];
    const taskToSection = new Map([["t1", SECTION_IDS.TODAY]]);
    const getSectionTasks = vi.fn(() => [task1]);
    const event = makeEvent({ activeId: "t1" }); // no overId

    await executeDragEnd({
      event,
      tasks,
      taskToSection,
      getSectionTasks,
      queryClient,
      reorderReminders,
      patchReminderStatus,
      toast,
      t,
    });

    expect(setQueryDataSpy).not.toHaveBeenCalled();
    expect(reorderReminders).not.toHaveBeenCalled();
    expect(patchReminderStatus).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("active.id === over.id: early return, no calls", async () => {
    const { task1, queryClient, toast, t, reorderReminders, patchReminderStatus, setQueryDataSpy } = makeMocks();
    const tasks = [task1];
    const taskToSection = new Map([["t1", SECTION_IDS.TODAY]]);
    const getSectionTasks = vi.fn(() => [task1]);
    const event = makeEvent({ activeId: "t1", overId: "t1" }); // same id

    await executeDragEnd({
      event,
      tasks,
      taskToSection,
      getSectionTasks,
      queryClient,
      reorderReminders,
      patchReminderStatus,
      toast,
      t,
    });

    expect(setQueryDataSpy).not.toHaveBeenCalled();
    expect(reorderReminders).not.toHaveBeenCalled();
    expect(patchReminderStatus).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 12. Source/target section unresolved: early return
// ---------------------------------------------------------------------------
describe("executeDragEnd — missing source/target section", () => {
  it("source section not in map: early return", async () => {
    const { task1, queryClient, toast, t, reorderReminders, patchReminderStatus, setQueryDataSpy } = makeMocks();
    const tasks = [task1];
    // task1 not in taskToSection map
    const taskToSection = new Map();
    const getSectionTasks = vi.fn(() => [task1]);
    const event = makeEvent({ activeId: "t1", overId: SECTION_IDS.TODAY });

    await executeDragEnd({
      event,
      tasks,
      taskToSection,
      getSectionTasks,
      queryClient,
      reorderReminders,
      patchReminderStatus,
      toast,
      t,
    });

    expect(setQueryDataSpy).not.toHaveBeenCalled();
    expect(reorderReminders).not.toHaveBeenCalled();
  });

  it("target resolves to unknown section ID: early return", async () => {
    const { task1, queryClient, toast, t, reorderReminders, patchReminderStatus, setQueryDataSpy } = makeMocks();
    const tasks = [task1];
    const taskToSection = new Map([["t1", SECTION_IDS.TODAY]]);
    const getSectionTasks = vi.fn(() => [task1]);
    // over.id is not a task in map AND not a valid section ID
    const event = makeEvent({ activeId: "t1", overId: "unknown-droppable" });

    await executeDragEnd({
      event,
      tasks,
      taskToSection,
      getSectionTasks,
      queryClient,
      reorderReminders,
      patchReminderStatus,
      toast,
      t,
    });

    expect(setQueryDataSpy).not.toHaveBeenCalled();
    expect(reorderReminders).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 13 (Bonus). Missing draggedTask in cross-section — early return
// ---------------------------------------------------------------------------
describe("executeDragEnd — missing draggedTask in cross-section", () => {
  it("cross-section with task not in tasks array: early return", async () => {
    const { queryClient, toast, t, reorderReminders, patchReminderStatus, setQueryDataSpy } = makeMocks();
    const tasks = []; // empty — active.id not found
    const taskToSection = new Map([["t1", SECTION_IDS.TODAY]]);
    const getSectionTasks = vi.fn(() => []);
    const event = makeEvent({ activeId: "t1", overId: SECTION_IDS.TOMORROW });

    await executeDragEnd({
      event,
      tasks,
      taskToSection,
      getSectionTasks,
      queryClient,
      reorderReminders,
      patchReminderStatus,
      toast,
      t,
    });

    expect(setQueryDataSpy).not.toHaveBeenCalled();
    expect(reorderReminders).not.toHaveBeenCalled();
    expect(patchReminderStatus).not.toHaveBeenCalled();
  });
});
