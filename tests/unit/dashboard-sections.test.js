/**
 * Regression net for dashboard section-grouping logic (C5 PR1/7).
 * Tests the future useTaskSections hook API via the extracted helper.
 * Target: lib/dashboard/sectionGrouping.js (mirrors page.js lines 149-241).
 *
 * Frozen clock: 2026-05-16T10:00:00Z (Saturday, week starts Mon per date-fns)
 *   - "today"     = 2026-05-16
 *   - "yesterday" = 2026-05-15  (overdue)
 *   - "tomorrow"  = 2026-05-17
 *   - "this week" = 2026-05-18..2026-05-17 Mon-Sun; within current week Mon-Sun
 *     Week of 2026-05-16 (Sat): Mon 2026-05-11 .. Sun 2026-05-17
 *     So "this week but not today/tomorrow" = Mon-Fri 2026-05-11..2026-05-14 (past, filtered)
 *     and there is no future same-week day beyond tomorrow that week.
 *     Use next Monday 2026-05-18 for a task that belongs to NEXT week, or
 *     Use Wed 2026-05-13 (past) to confirm it's overdue, not this-week.
 *
 * Actually: isThisWeek uses current locale week. weekStartsOn:1 means
 * the week containing 2026-05-16 (Sat) is Mon 2026-05-11 to Sun 2026-05-17.
 * "This week but not today/tomorrow" = 2026-05-11..2026-05-14 (past dates, filtered by >= startOfDay)
 * and 2026-05-15 (yesterday, past) and 2026-05-16 (today) and 2026-05-17 (tomorrow).
 * So there are no future this-week dates beyond tomorrow in this frozen week.
 *
 * For THIS_WEEK test, freeze clock to Wednesday 2026-05-13T10:00:00Z:
 *   - today     = 2026-05-13 (Wed)
 *   - tomorrow  = 2026-05-14 (Thu)
 *   - this week = Mon-Sun = 2026-05-11..2026-05-17, future non-today/tomorrow = Fri 2026-05-15..Sun 2026-05-17
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock client-only dnd-kit imports (same pattern as dnd.test.js)
vi.mock("@dnd-kit/core", () => ({
  PointerSensor: class {},
  TouchSensor: class {},
  KeyboardSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn(),
  defaultDropAnimationSideEffects: vi.fn(() => ({})),
  pointerWithin: vi.fn(),
  rectIntersection: vi.fn(),
  closestCenter: vi.fn(),
  getFirstCollision: vi.fn(),
}));
vi.mock("@dnd-kit/sortable", () => ({
  sortableKeyboardCoordinates: vi.fn(),
}));

const { groupTasksBySection } = await import(
  "@/lib/dashboard/sectionGrouping.js"
);
const { SECTION_IDS } = await import("@/lib/dnd.js");

// Frozen clock defaults to 2026-05-16T10:00:00Z (Saturday)
const FROZEN_SAT = new Date("2026-05-16T10:00:00Z");
// Wednesday freeze used for THIS_WEEK test (future days remain in the week)
const FROZEN_WED = new Date("2026-05-13T10:00:00Z");

function makeTask(overrides) {
  return {
    id: `task-${Math.random().toString(36).slice(2)}`,
    status: "pending",
    completed: false,
    sortOrder: 1000,
    ...overrides,
  };
}

describe("groupTasksBySection — section placement", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_SAT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Case 1: OVERDUE
  it("places pending task with dateTime < startOfDay(now) in OVERDUE", () => {
    const task = makeTask({ dateTime: "2026-05-15T09:00:00Z" }); // yesterday
    const { taskToSection, overdueTasks } = groupTasksBySection({
      tasks: [task],
      now: FROZEN_SAT,
    });
    expect(taskToSection.get(task.id)).toBe(SECTION_IDS.OVERDUE);
    expect(overdueTasks.map((t) => t.id)).toContain(task.id);
  });

  // Case 2: TODAY
  it("places pending task with isToday(dateTime) in TODAY", () => {
    const task = makeTask({ dateTime: "2026-05-16T14:00:00Z" }); // today afternoon
    const { taskToSection, todayTasks } = groupTasksBySection({
      tasks: [task],
      now: FROZEN_SAT,
    });
    expect(taskToSection.get(task.id)).toBe(SECTION_IDS.TODAY);
    expect(todayTasks.map((t) => t.id)).toContain(task.id);
  });

  // Case 3: TOMORROW
  it("places pending task with isTomorrow(dateTime) in TOMORROW", () => {
    const task = makeTask({ dateTime: "2026-05-17T09:00:00Z" }); // tomorrow
    const { taskToSection, tomorrowTasks } = groupTasksBySection({
      tasks: [task],
      now: FROZEN_SAT,
    });
    expect(taskToSection.get(task.id)).toBe(SECTION_IDS.TOMORROW);
    expect(tomorrowTasks.map((t) => t.id)).toContain(task.id);
  });

  // Case 4: THIS_WEEK (use Wed freeze so Fri-Sat-Sun remain in week and are future)
  it("places pending future same-week (non-today/tomorrow) task in THIS_WEEK", () => {
    vi.setSystemTime(FROZEN_WED); // now = 2026-05-13 Wed
    const task = makeTask({ dateTime: "2026-05-15T09:00:00Z" }); // Fri — same week, future
    const { taskToSection, thisWeekTasks } = groupTasksBySection({
      tasks: [task],
      now: FROZEN_WED,
    });
    expect(taskToSection.get(task.id)).toBe(SECTION_IDS.THIS_WEEK);
    expect(thisWeekTasks.map((t) => t.id)).toContain(task.id);
  });

  // Case 5: SNOOZED — regardless of dateTime
  it("places snoozed non-completed task in SNOOZED regardless of dateTime", () => {
    const task = makeTask({
      status: "snoozed",
      dateTime: "2026-05-16T09:00:00Z", // would be TODAY if not snoozed
    });
    const { taskToSection, snoozedTasks } = groupTasksBySection({
      tasks: [task],
      now: FROZEN_SAT,
    });
    expect(taskToSection.get(task.id)).toBe(SECTION_IDS.SNOOZED);
    expect(snoozedTasks.map((t) => t.id)).toContain(task.id);
    // Must NOT appear in today
    expect(taskToSection.get(task.id)).not.toBe(SECTION_IDS.TODAY);
  });

  // Case 6: COMPLETED_TODAY
  it("places completed task with isToday(dateTime) in COMPLETED (not in completingIds)", () => {
    const task = makeTask({
      completed: true,
      dateTime: "2026-05-16T08:00:00Z",
    });
    const { taskToSection, completedToday } = groupTasksBySection({
      tasks: [task],
      now: FROZEN_SAT,
    });
    expect(taskToSection.get(task.id)).toBe(SECTION_IDS.COMPLETED);
    expect(completedToday.map((t) => t.id)).toContain(task.id);
  });

  it("places completed task whose completedAt is today (but dateTime is not today) in COMPLETED", () => {
    const task = makeTask({
      completed: true,
      dateTime: "2026-05-15T08:00:00Z", // yesterday
      completedAt: "2026-05-16T09:00:00Z", // completed today
    });
    const { taskToSection, completedToday } = groupTasksBySection({
      tasks: [task],
      now: FROZEN_SAT,
    });
    expect(taskToSection.get(task.id)).toBe(SECTION_IDS.COMPLETED);
    expect(completedToday.map((t) => t.id)).toContain(task.id);
  });

  // Case 7: completingIds keeps task in original section during animation
  it("keeps completed+today task in TODAY (not COMPLETED) when in completingIds", () => {
    const task = makeTask({
      completed: true,
      dateTime: "2026-05-16T08:00:00Z",
    });
    const completingIds = new Set([task.id]);
    const { taskToSection, todayTasks, completedToday } = groupTasksBySection({
      tasks: [task],
      completingIds,
      now: FROZEN_SAT,
    });
    expect(taskToSection.get(task.id)).toBe(SECTION_IDS.TODAY);
    expect(todayTasks.map((t) => t.id)).toContain(task.id);
    expect(completedToday.map((t) => t.id)).not.toContain(task.id);
  });
});

describe("groupTasksBySection — nextTask", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_SAT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Case 8a: nextTask = first non-completed today task with dateTime > now
  it("returns first non-completed today task with dateTime > now as nextTask", () => {
    const past = makeTask({ dateTime: "2026-05-16T08:00:00Z", sortOrder: 1000 }); // before 10:00
    const future = makeTask({ dateTime: "2026-05-16T12:00:00Z", sortOrder: 2000 }); // after 10:00
    const { nextTask } = groupTasksBySection({
      tasks: [past, future],
      now: FROZEN_SAT,
    });
    expect(nextTask?.id).toBe(future.id);
  });

  // Case 8b: fall back to first non-completed today task when none is in the future
  it("falls back to first non-completed today task when none is future", () => {
    const a = makeTask({ dateTime: "2026-05-16T07:00:00Z", sortOrder: 1000 });
    const b = makeTask({ dateTime: "2026-05-16T08:00:00Z", sortOrder: 2000 });
    const { nextTask } = groupTasksBySection({
      tasks: [a, b],
      now: FROZEN_SAT,
    });
    // Both are past — fallback: first non-completed today task (lowest sortOrder after sort)
    expect(nextTask?.id).toBe(a.id);
  });

  it("returns undefined nextTask when all today tasks are completed", () => {
    const task = makeTask({ completed: true, dateTime: "2026-05-16T08:00:00Z" });
    // completed = true + not in completingIds → goes to COMPLETED section, not todayTasks
    const { nextTask } = groupTasksBySection({ tasks: [task], now: FROZEN_SAT });
    expect(nextTask).toBeUndefined();
  });
});

describe("groupTasksBySection — sortByOrder within sections", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_SAT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Case 9 (bonus): sortByOrder — sortOrder first, dateTime tiebreaker
  it("sorts tasks within a section by sortOrder then dateTime as tiebreaker", () => {
    const a = makeTask({ dateTime: "2026-05-16T14:00:00Z", sortOrder: 2000 });
    const b = makeTask({ dateTime: "2026-05-16T09:00:00Z", sortOrder: 1000 });
    const c = makeTask({ dateTime: "2026-05-16T11:00:00Z", sortOrder: 1000 }); // same order as b
    const { todayTasks } = groupTasksBySection({
      tasks: [a, b, c],
      now: FROZEN_SAT,
    });
    const ids = todayTasks.map((t) => t.id);
    // b (sortOrder 1000, 09:00) before c (sortOrder 1000, 11:00) before a (sortOrder 2000)
    expect(ids.indexOf(b.id)).toBeLessThan(ids.indexOf(c.id));
    expect(ids.indexOf(c.id)).toBeLessThan(ids.indexOf(a.id));
  });
});

describe("groupTasksBySection — inbox/dateless exclusion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_SAT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Case 10 (bonus): tasks without dateTime are excluded from all date sections
  it("excludes dateless (inbox) tasks from all date sections", () => {
    const inbox = makeTask({ dateTime: null });
    const { taskToSection, overdueTasks, todayTasks, tomorrowTasks, thisWeekTasks, snoozedTasks, completedToday } =
      groupTasksBySection({ tasks: [inbox], now: FROZEN_SAT });
    expect(taskToSection.has(inbox.id)).toBe(false);
    const allSectionTasks = [
      ...overdueTasks,
      ...todayTasks,
      ...tomorrowTasks,
      ...thisWeekTasks,
      ...snoozedTasks,
      ...completedToday,
    ];
    expect(allSectionTasks.find((t) => t.id === inbox.id)).toBeUndefined();
  });
});

describe("groupTasksBySection — snoozed completed task", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_SAT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("excludes snoozed completed task from SNOOZED section", () => {
    const task = makeTask({
      status: "snoozed",
      completed: true,
      dateTime: "2026-05-16T09:00:00Z",
    });
    const { snoozedTasks } = groupTasksBySection({ tasks: [task], now: FROZEN_SAT });
    expect(snoozedTasks.map((t) => t.id)).not.toContain(task.id);
  });

  it("excludes overdue snoozed task from OVERDUE section", () => {
    const task = makeTask({
      status: "snoozed",
      dateTime: "2026-05-15T09:00:00Z", // yesterday = would be overdue
    });
    const { overdueTasks } = groupTasksBySection({ tasks: [task], now: FROZEN_SAT });
    expect(overdueTasks.map((t) => t.id)).not.toContain(task.id);
  });
});
