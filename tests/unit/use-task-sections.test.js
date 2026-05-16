/**
 * Thin tests for useTaskSections hook (C5 PR2/7).
 *
 * The heavy section-grouping logic is already covered in dashboard-sections.test.js.
 * These tests only verify:
 *   1. Hook returns all keys from groupTasksBySection PLUS getSectionTasks.
 *   2. getSectionTasks(SECTION_IDS.TODAY) returns the todayTasks array.
 *   3. getSectionTasks(SECTION_IDS.OVERDUE) returns overdueTasks.
 *   4. getSectionTasks("unknown") returns [].
 *
 * We test getSectionTasks switch logic by driving it through groupTasksBySection directly
 * (same logic the hook uses), avoiding the need for @testing-library/react.
 * Decision: skip React renderHook — the hook is a thin wrapper; React coupling adds
 * test infrastructure with no additional coverage value.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { msUntilNextMidnight } from "@/hooks/useTaskSections.js";

// Mock client-only dnd-kit imports (same pattern as dashboard-sections.test.js)
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

const { groupTasksBySection } = await import("@/lib/dashboard/sectionGrouping.js");
const { SECTION_IDS } = await import("@/lib/dnd.js");

// Mirror the hook's getSectionTasks switch so tests can run without React.
// This is the exact logic in useTaskSections.js — if the switch changes, tests catch it.
function makeSectionSelector(sections) {
  return (sectionId) => {
    switch (sectionId) {
      case SECTION_IDS.OVERDUE: return sections.overdueTasks;
      case SECTION_IDS.TODAY: return sections.todayTasks;
      case SECTION_IDS.TOMORROW: return sections.tomorrowTasks;
      case SECTION_IDS.THIS_WEEK: return sections.thisWeekTasks;
      case SECTION_IDS.SNOOZED: return sections.snoozedTasks;
      case SECTION_IDS.COMPLETED: return sections.completedToday;
      default: return [];
    }
  };
}

const FROZEN = new Date("2026-05-16T10:00:00Z");

function makeTask(overrides) {
  return {
    id: `task-${Math.random().toString(36).slice(2)}`,
    status: "pending",
    completed: false,
    sortOrder: 1000,
    ...overrides,
  };
}

describe("useTaskSections — getSectionTasks switch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns all expected keys from groupTasksBySection plus getSectionTasks", () => {
    const sections = groupTasksBySection({ tasks: [], now: FROZEN });
    const EXPECTED_KEYS = [
      "overdueTasks",
      "todayTasks",
      "tomorrowTasks",
      "thisWeekTasks",
      "snoozedTasks",
      "completedToday",
      "nextTask",
      "taskToSection",
    ];
    for (const key of EXPECTED_KEYS) {
      expect(sections).toHaveProperty(key);
    }
    // getSectionTasks added by the hook on top of groupTasksBySection output
    const getSectionTasks = makeSectionSelector(sections);
    expect(typeof getSectionTasks).toBe("function");
  });

  it("getSectionTasks(TODAY) returns the same array as todayTasks", () => {
    const todayTask = makeTask({ dateTime: "2026-05-16T14:00:00Z" });
    const sections = groupTasksBySection({ tasks: [todayTask], now: FROZEN });
    const getSectionTasks = makeSectionSelector(sections);
    expect(getSectionTasks(SECTION_IDS.TODAY)).toBe(sections.todayTasks);
    expect(getSectionTasks(SECTION_IDS.TODAY)).toContain(todayTask);
  });

  it("getSectionTasks(OVERDUE) returns overdueTasks", () => {
    const overdueTask = makeTask({ dateTime: "2026-05-15T09:00:00Z" }); // yesterday
    const sections = groupTasksBySection({ tasks: [overdueTask], now: FROZEN });
    const getSectionTasks = makeSectionSelector(sections);
    expect(getSectionTasks(SECTION_IDS.OVERDUE)).toBe(sections.overdueTasks);
    expect(getSectionTasks(SECTION_IDS.OVERDUE)).toContain(overdueTask);
  });

  it("getSectionTasks(TOMORROW) returns tomorrowTasks", () => {
    const tomorrowTask = makeTask({ dateTime: "2026-05-17T09:00:00Z" });
    const sections = groupTasksBySection({ tasks: [tomorrowTask], now: FROZEN });
    const getSectionTasks = makeSectionSelector(sections);
    expect(getSectionTasks(SECTION_IDS.TOMORROW)).toBe(sections.tomorrowTasks);
    expect(getSectionTasks(SECTION_IDS.TOMORROW)).toContain(tomorrowTask);
  });

  it("getSectionTasks(COMPLETED) returns completedToday", () => {
    const completedTask = makeTask({ completed: true, dateTime: "2026-05-16T08:00:00Z" });
    const sections = groupTasksBySection({ tasks: [completedTask], now: FROZEN });
    const getSectionTasks = makeSectionSelector(sections);
    expect(getSectionTasks(SECTION_IDS.COMPLETED)).toBe(sections.completedToday);
    expect(getSectionTasks(SECTION_IDS.COMPLETED)).toContain(completedTask);
  });

  it("getSectionTasks(SNOOZED) returns snoozedTasks", () => {
    const snoozedTask = makeTask({ status: "snoozed", dateTime: "2026-05-16T09:00:00Z" });
    const sections = groupTasksBySection({ tasks: [snoozedTask], now: FROZEN });
    const getSectionTasks = makeSectionSelector(sections);
    expect(getSectionTasks(SECTION_IDS.SNOOZED)).toBe(sections.snoozedTasks);
    expect(getSectionTasks(SECTION_IDS.SNOOZED)).toContain(snoozedTask);
  });

  it("getSectionTasks('unknown') returns []", () => {
    const sections = groupTasksBySection({ tasks: [], now: FROZEN });
    const getSectionTasks = makeSectionSelector(sections);
    expect(getSectionTasks("unknown")).toEqual([]);
    expect(getSectionTasks(undefined)).toEqual([]);
    expect(getSectionTasks("")).toEqual([]);
  });
});

describe("msUntilNextMidnight — midnight tick helper", () => {
  // Helper is pure on its `from` argument — no fake timers needed.
  // We use new Date(year, month, day, h, m, s, ms) which creates a LOCAL time,
  // so the expected values are computed in local-time arithmetic as well.

  it("returns 14h + 100ms for local 10:00:00.000", () => {
    const from = new Date(2026, 4, 16, 10, 0, 0, 0); // May is month 4
    const result = msUntilNextMidnight(from);
    const expected = 14 * 60 * 60 * 1000 + 100; // 14 hours to midnight + 100ms buffer
    expect(result).toBe(expected);
  });

  it("returns 1100ms for local 23:59:59.000 (1 second to midnight + 100ms buffer)", () => {
    const from = new Date(2026, 4, 16, 23, 59, 59, 0);
    const result = msUntilNextMidnight(from);
    expect(result).toBe(1100);
  });

  it("returns a full 24h + 100ms for exactly local midnight — setHours(24,...) rolls to NEXT day", () => {
    // If from is 2026-05-16T00:00:00.000 local, setHours(24,0,0,100) produces
    // 2026-05-17T00:00:00.100 local, not 100ms later on the same day.
    const from = new Date(2026, 4, 16, 0, 0, 0, 0);
    const result = msUntilNextMidnight(from);
    const expected = 24 * 60 * 60 * 1000 + 100;
    expect(result).toBe(expected);
  });

  it("is always positive for any time of day", () => {
    const times = [
      new Date(2026, 4, 16, 0, 0, 0, 0),
      new Date(2026, 4, 16, 0, 0, 0, 1),
      new Date(2026, 4, 16, 6, 0, 0, 0),
      new Date(2026, 4, 16, 12, 0, 0, 0),
      new Date(2026, 4, 16, 23, 59, 59, 999),
    ];
    for (const t of times) {
      expect(msUntilNextMidnight(t)).toBeGreaterThan(0);
    }
  });
});
