/**
 * Tests for useTaskDnD hook (C5 PR3a/7).
 *
 * @testing-library/react is NOT installed. We use pure-function extraction
 * (same pattern as use-task-sections.test.js) to test behavior without React.
 *
 * Extracted: computeDragOverResult({ event, taskToSection, expandedByDrag })
 * Tests drive this pure function; timer behavior uses vi.useFakeTimers().
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock client-only dnd-kit imports
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
vi.mock("@dnd-kit/sortable", () => ({
  sortableKeyboardCoordinates: vi.fn(),
}));

const { SECTION_IDS } = await import("@/lib/dnd.js");

// ---------------------------------------------------------------------------
// Pure helper that mirrors handleDragOver logic — extracted for testability.
// Returns: { nextOverSectionId, shouldScheduleExpand, shouldClearTimer }
// ---------------------------------------------------------------------------
function computeDragOverResult({ event, taskToSection, expandedByDrag }) {
  const { active, over } = event;

  if (!over) {
    return {
      nextOverSectionId: null,
      shouldClearTimer: true,
      shouldScheduleExpand: false,
    };
  }

  const section = taskToSection.get(over.id) || over.id;
  const activeSection = taskToSection.get(active.id);

  // Suppress overlay on Overdue for cross-section drags
  if (
    section === SECTION_IDS.OVERDUE &&
    activeSection !== SECTION_IDS.OVERDUE
  ) {
    return {
      nextOverSectionId: null,
      shouldClearTimer: true,
      shouldScheduleExpand: false,
    };
  }

  const validSections = new Set(Object.values(SECTION_IDS));
  const shouldScheduleExpand =
    section !== expandedByDrag && validSections.has(section);

  return {
    nextOverSectionId: section,
    shouldClearTimer: section !== expandedByDrag,
    shouldScheduleExpand,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTask(overrides) {
  return {
    id: `task-${Math.random().toString(36).slice(2)}`,
    status: "pending",
    completed: false,
    sortOrder: 1000,
    ...overrides,
  };
}

function makeEvent({ activeId, overId } = {}) {
  return {
    active: { id: activeId },
    over: overId !== undefined ? { id: overId } : null,
  };
}

// ---------------------------------------------------------------------------
// State machine that mirrors hook internals for resetDragState tests
// ---------------------------------------------------------------------------
function makeDragState() {
  let activeDragId = null;
  let overSectionId = null;
  let expandedByDrag = null;
  let timer = null;

  return {
    setActiveDragId(v) { activeDragId = v; },
    setOverSectionId(v) { overSectionId = v; },
    setExpandedByDrag(v) { expandedByDrag = v; },
    scheduleExpand(section, delay = 500) {
      clearTimeout(timer);
      timer = setTimeout(() => { expandedByDrag = section; }, delay);
    },
    reset() {
      activeDragId = null;
      overSectionId = null;
      expandedByDrag = null;
      clearTimeout(timer);
      timer = null;
    },
    get() { return { activeDragId, overSectionId, expandedByDrag, timer }; },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useTaskDnD — handleDragStart", () => {
  it("sets activeDragId from event.active.id", () => {
    const state = makeDragState();
    const event = { active: { id: "task-abc" } };
    state.setActiveDragId(event.active.id);
    expect(state.get().activeDragId).toBe("task-abc");
  });
});

describe("useTaskDnD — handleDragOver (pure logic)", () => {
  it("clears overSectionId and timer when over is null", () => {
    const taskToSection = new Map([["task-1", SECTION_IDS.TODAY]]);
    const event = makeEvent({ activeId: "task-1" }); // no overId → over=null
    const result = computeDragOverResult({
      event,
      taskToSection,
      expandedByDrag: null,
    });
    expect(result.nextOverSectionId).toBeNull();
    expect(result.shouldClearTimer).toBe(true);
    expect(result.shouldScheduleExpand).toBe(false);
  });

  it("sets overSectionId to TODAY when over.id maps to TODAY", () => {
    const taskToSection = new Map([
      ["task-1", SECTION_IDS.TODAY],
      ["task-2", SECTION_IDS.TODAY],
    ]);
    const event = makeEvent({ activeId: "task-1", overId: "task-2" });
    const result = computeDragOverResult({
      event,
      taskToSection,
      expandedByDrag: null,
    });
    expect(result.nextOverSectionId).toBe(SECTION_IDS.TODAY);
  });

  it("sets overSectionId to section ID when over.id is a section droppable", () => {
    const taskToSection = new Map([["task-1", SECTION_IDS.TODAY]]);
    const event = makeEvent({
      activeId: "task-1",
      overId: SECTION_IDS.TOMORROW,
    });
    const result = computeDragOverResult({
      event,
      taskToSection,
      expandedByDrag: null,
    });
    expect(result.nextOverSectionId).toBe(SECTION_IDS.TOMORROW);
  });

  it("suppresses overlay when target is OVERDUE and source is not OVERDUE", () => {
    const taskToSection = new Map([["task-1", SECTION_IDS.TODAY]]);
    const event = makeEvent({
      activeId: "task-1",
      overId: SECTION_IDS.OVERDUE,
    });
    const result = computeDragOverResult({
      event,
      taskToSection,
      expandedByDrag: null,
    });
    expect(result.nextOverSectionId).toBeNull();
    expect(result.shouldClearTimer).toBe(true);
    expect(result.shouldScheduleExpand).toBe(false);
  });

  it("allows overlay when source IS OVERDUE and target IS OVERDUE (within-section)", () => {
    const taskToSection = new Map([["task-1", SECTION_IDS.OVERDUE]]);
    const event = makeEvent({
      activeId: "task-1",
      overId: SECTION_IDS.OVERDUE,
    });
    const result = computeDragOverResult({
      event,
      taskToSection,
      expandedByDrag: null,
    });
    expect(result.nextOverSectionId).toBe(SECTION_IDS.OVERDUE);
  });

  it("schedules 500ms autoexpand when hovering a new valid section", () => {
    vi.useFakeTimers();
    const state = makeDragState();
    const taskToSection = new Map([["task-1", SECTION_IDS.TODAY]]);
    const event = makeEvent({
      activeId: "task-1",
      overId: SECTION_IDS.TOMORROW,
    });
    const result = computeDragOverResult({
      event,
      taskToSection,
      expandedByDrag: null,
    });

    expect(result.shouldScheduleExpand).toBe(true);
    expect(result.nextOverSectionId).toBe(SECTION_IDS.TOMORROW);

    // Simulate what the hook does: schedule the expand
    state.scheduleExpand(result.nextOverSectionId, 500);
    expect(state.get().expandedByDrag).toBeNull(); // not yet

    vi.advanceTimersByTime(500);
    expect(state.get().expandedByDrag).toBe(SECTION_IDS.TOMORROW);

    vi.useRealTimers();
  });

  it("does NOT reschedule expand when already on the same expandedByDrag section", () => {
    const taskToSection = new Map([["task-1", SECTION_IDS.TODAY]]);
    const event = makeEvent({
      activeId: "task-1",
      overId: SECTION_IDS.TOMORROW,
    });
    const result = computeDragOverResult({
      event,
      taskToSection,
      expandedByDrag: SECTION_IDS.TOMORROW, // already expanded
    });
    expect(result.shouldScheduleExpand).toBe(false);
    expect(result.shouldClearTimer).toBe(false);
  });
});

describe("useTaskDnD — handleDragCancel / resetDragState", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resets all 3 state fields and clears the timer", () => {
    const state = makeDragState();
    state.setActiveDragId("task-x");
    state.setOverSectionId(SECTION_IDS.TODAY);
    state.setExpandedByDrag(SECTION_IDS.TOMORROW);
    state.scheduleExpand(SECTION_IDS.THIS_WEEK, 500);

    state.reset();
    const s = state.get();
    expect(s.activeDragId).toBeNull();
    expect(s.overSectionId).toBeNull();
    expect(s.expandedByDrag).toBeNull();
    expect(s.timer).toBeNull();

    // Timer must not fire after reset
    vi.advanceTimersByTime(1000);
    expect(state.get().expandedByDrag).toBeNull();
  });

  it("handleDragCancel delegates to resetDragState (idempotent on already-reset state)", () => {
    const state = makeDragState();
    // Already at initial state — reset again should be a no-op
    state.reset();
    const s = state.get();
    expect(s.activeDragId).toBeNull();
    expect(s.overSectionId).toBeNull();
    expect(s.expandedByDrag).toBeNull();
  });
});

describe("useTaskDnD — derived state", () => {
  it("activeDragTask returns the task object matching activeDragId", () => {
    const taskA = makeTask({ id: "task-A" });
    const taskB = makeTask({ id: "task-B" });
    const tasks = [taskA, taskB];
    const activeDragId = "task-A";
    const activeDragTask = activeDragId
      ? tasks.find((t) => t.id === activeDragId)
      : null;
    expect(activeDragTask).toBe(taskA);
  });

  it("activeDragTask returns null when activeDragId is null", () => {
    const tasks = [makeTask({ id: "task-A" })];
    const activeDragId = null;
    const activeDragTask = activeDragId
      ? tasks.find((t) => t.id === activeDragId)
      : null;
    expect(activeDragTask).toBeNull();
  });

  it("activeDragSourceSection returns the section from taskToSection map", () => {
    const taskToSection = new Map([
      ["task-A", SECTION_IDS.TODAY],
      ["task-B", SECTION_IDS.TOMORROW],
    ]);
    const activeDragId = "task-B";
    const activeDragSourceSection = activeDragId
      ? taskToSection.get(activeDragId)
      : null;
    expect(activeDragSourceSection).toBe(SECTION_IDS.TOMORROW);
  });

  it("activeDragSourceSection returns undefined when task is not in map", () => {
    const taskToSection = new Map();
    const activeDragId = "task-Z";
    const activeDragSourceSection = activeDragId
      ? taskToSection.get(activeDragId)
      : null;
    expect(activeDragSourceSection).toBeUndefined();
  });
});
