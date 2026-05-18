/**
 * Tests for calendar DnD using the shared executeTaskDragEnd (M6).
 *
 * Locks the calendar's user-visible DnD behavior:
 *   - Slot drop (cal-slot-YYYY-MM-DD-HH:mm) → replaces both date and time
 *   - Day drop (cal-day-YYYY-MM-DD) → keeps original time-of-day
 *   - Optimistic dateTime patch + PATCH + success toast
 *   - Rollback on API error + error toast
 *
 * The handler logic is duplicated here (without the React useCallback shell)
 * because it lives inline in app/[locale]/(calendar)/calendar/page.js — same
 * pattern as use-task-dnd.test.js extracting computeDragOverResult.
 */

import { describe, it, expect, vi } from "vitest";
import { format } from "date-fns";

const { executeTaskDragEnd } = await import("@/lib/dnd/executeTaskDragEnd.js");
const {
  parseDayDropId,
  parseSlotDropId,
  computeNewDateTime,
  computeSlotDateTime,
} = await import("@/lib/dnd.js");

// Mirror of calendar/page.js handleDragEnd body — without React state setter.
async function runCalendarDragEnd({
  event,
  tasks,
  queryClient,
  patchReminderStatus,
  toast,
  t,
}) {
  const { active, over } = event;
  if (!over) return;
  const draggedTask = tasks.find((task) => task.id === active.id);
  if (!draggedTask) return;

  const slotData = parseSlotDropId(over.id);
  let newDateTime;
  let targetDate;
  if (slotData) {
    newDateTime = computeSlotDateTime(slotData);
    targetDate = slotData.date;
  } else {
    targetDate = parseDayDropId(over.id);
    if (!targetDate || !draggedTask.dateTime) return;
    newDateTime = computeNewDateTime(draggedTask.dateTime, targetDate);
  }

  await executeTaskDragEnd({
    activeId: active.id,
    tasks,
    queryClient,
    optimisticPatch: { dateTime: newDateTime },
    apiCall: () => patchReminderStatus(active.id, { dateTime: newDateTime }),
    toast,
    t,
    successKey: "movedTo",
    successParams: { date: format(targetDate, "M/d") },
  });
}

function makeTask(overrides = {}) {
  return {
    id: "t1",
    title: "Sample",
    status: "pending",
    completed: false,
    sortOrder: 1000,
    dateTime: new Date("2026-05-20T09:00:00").toISOString(),
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
  const patchReminderStatus = vi.fn(() => Promise.resolve({}));
  return { queryClient, toast, t, patchReminderStatus, setQueryDataSpy };
}

// ---------------------------------------------------------------------------
// 1. Day drop — preserves time-of-day
// ---------------------------------------------------------------------------
describe("calendar handleDragEnd — day drop", () => {
  it("drag from 5/20 09:00 onto cal-day-2026-05-22 → 5/22 09:00, status untouched", async () => {
    const task = makeTask();
    const tasks = [task];
    const { queryClient, toast, t, patchReminderStatus, setQueryDataSpy } =
      makeMocks(tasks);

    await runCalendarDragEnd({
      event: { active: { id: "t1" }, over: { id: "cal-day-2026-05-22" } },
      tasks,
      queryClient,
      patchReminderStatus,
      toast,
      t,
    });

    // Optimistic update preserves time-of-day (09:00) on the new date
    expect(setQueryDataSpy).toHaveBeenCalledOnce();
    const updated = setQueryDataSpy.mock.calls[0][1].find((x) => x.id === "t1");
    const newDate = new Date(updated.dateTime);
    expect(newDate.getFullYear()).toBe(2026);
    expect(newDate.getMonth()).toBe(4); // May (0-indexed)
    expect(newDate.getDate()).toBe(22);
    expect(newDate.getHours()).toBe(9);
    expect(newDate.getMinutes()).toBe(0);
    // Status untouched
    expect(updated.status).toBe("pending");

    // PATCH fired
    expect(patchReminderStatus).toHaveBeenCalledOnce();
    expect(patchReminderStatus).toHaveBeenCalledWith("t1", {
      dateTime: updated.dateTime,
    });

    // Success toast with M/d format
    expect(toast.success).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith('movedTo:{"date":"5/22"}');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("PATCH error → rollback + toast.error(moveFailed)", async () => {
    const task = makeTask();
    const tasks = [task];
    const { queryClient, toast, t, setQueryDataSpy } = makeMocks(tasks);
    const patchReminderStatus = vi.fn(() => Promise.reject(new Error("fail")));

    await runCalendarDragEnd({
      event: { active: { id: "t1" }, over: { id: "cal-day-2026-05-22" } },
      tasks,
      queryClient,
      patchReminderStatus,
      toast,
      t,
    });

    // Optimistic write then rollback
    expect(setQueryDataSpy).toHaveBeenCalledTimes(2);
    expect(setQueryDataSpy.mock.calls[1][1]).toBe(tasks);
    expect(toast.error).toHaveBeenCalledWith("moveFailed");
    expect(toast.success).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. Slot drop — replaces date AND time
// ---------------------------------------------------------------------------
describe("calendar handleDragEnd — slot drop", () => {
  it("drag from 5/20 09:00 onto cal-slot-2026-05-22-14:30 → 5/22 14:30", async () => {
    const task = makeTask();
    const tasks = [task];
    const { queryClient, toast, t, patchReminderStatus, setQueryDataSpy } =
      makeMocks(tasks);

    await runCalendarDragEnd({
      event: { active: { id: "t1" }, over: { id: "cal-slot-2026-05-22-14:30" } },
      tasks,
      queryClient,
      patchReminderStatus,
      toast,
      t,
    });

    const updated = setQueryDataSpy.mock.calls[0][1].find((x) => x.id === "t1");
    const newDate = new Date(updated.dateTime);
    expect(newDate.getFullYear()).toBe(2026);
    expect(newDate.getMonth()).toBe(4);
    expect(newDate.getDate()).toBe(22);
    expect(newDate.getHours()).toBe(14);
    expect(newDate.getMinutes()).toBe(30);

    expect(patchReminderStatus).toHaveBeenCalledWith("t1", {
      dateTime: updated.dateTime,
    });
    expect(toast.success).toHaveBeenCalledWith('movedTo:{"date":"5/22"}');
  });
});

// ---------------------------------------------------------------------------
// 3. Early returns
// ---------------------------------------------------------------------------
describe("calendar handleDragEnd — early returns", () => {
  it("no over → no side effects", async () => {
    const task = makeTask();
    const tasks = [task];
    const { queryClient, toast, t, patchReminderStatus, setQueryDataSpy } =
      makeMocks(tasks);

    await runCalendarDragEnd({
      event: { active: { id: "t1" }, over: null },
      tasks,
      queryClient,
      patchReminderStatus,
      toast,
      t,
    });

    expect(setQueryDataSpy).not.toHaveBeenCalled();
    expect(patchReminderStatus).not.toHaveBeenCalled();
  });

  it("unrecognized droppable id → no side effects", async () => {
    const task = makeTask();
    const tasks = [task];
    const { queryClient, toast, t, patchReminderStatus, setQueryDataSpy } =
      makeMocks(tasks);

    await runCalendarDragEnd({
      event: { active: { id: "t1" }, over: { id: "random-droppable" } },
      tasks,
      queryClient,
      patchReminderStatus,
      toast,
      t,
    });

    expect(setQueryDataSpy).not.toHaveBeenCalled();
    expect(patchReminderStatus).not.toHaveBeenCalled();
  });
});
