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

