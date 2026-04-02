import { describe, it, expect, vi } from "vitest";

// Mock client-only dnd-kit imports
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

const {
  computeSortOrders,
  computeNewDateTime,
  getSectionLabel,
  getSectionTargetStatus,
  parseDayDropId,
  SECTION_IDS,
  CALENDAR_DAY_PREFIX,
} = await import("@/lib/dnd.js");

describe("computeSortOrders", () => {
  it("assigns sortOrder in increments of 1000", () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const result = computeSortOrders(items);

    expect(result).toEqual([
      { id: "a", sortOrder: 1000 },
      { id: "b", sortOrder: 2000 },
      { id: "c", sortOrder: 3000 },
    ]);
  });
});

describe("computeNewDateTime", () => {
  it("preserves original hours and minutes when changing date", () => {
    const original = "2026-03-10T14:30:00.000Z";
    const targetDate = new Date("2026-04-05T00:00:00");

    const result = computeNewDateTime(original, targetDate);
    const parsed = new Date(result);

    const originalDate = new Date(original);
    expect(parsed.getHours()).toBe(originalDate.getHours());
    expect(parsed.getMinutes()).toBe(originalDate.getMinutes());
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(3); // April = 3
    expect(parsed.getDate()).toBe(5);
  });
});

describe("getSectionLabel", () => {
  it("returns correct label for all section IDs", () => {
    expect(getSectionLabel(SECTION_IDS.OVERDUE)).toBe("Today");
    expect(getSectionLabel(SECTION_IDS.TODAY)).toBe("Today");
    expect(getSectionLabel(SECTION_IDS.TOMORROW)).toBe("Tomorrow");
    expect(getSectionLabel(SECTION_IDS.THIS_WEEK)).toBe("This Week");
    expect(getSectionLabel(SECTION_IDS.COMPLETED)).toBe("Completed");
    expect(getSectionLabel(SECTION_IDS.SNOOZED)).toBe("Snoozed");
    expect(getSectionLabel("unknown-section")).toBe("");
  });
});

describe("getSectionTargetStatus", () => {
  it("returns correct status objects for each section type", () => {
    expect(getSectionTargetStatus(SECTION_IDS.COMPLETED)).toEqual({
      status: "completed",
      completed: true,
    });
    expect(getSectionTargetStatus(SECTION_IDS.SNOOZED)).toEqual({
      status: "snoozed",
    });
    expect(getSectionTargetStatus(SECTION_IDS.TODAY)).toEqual({
      status: "pending",
      completed: false,
    });
  });
});

describe("parseDayDropId", () => {
  it("parses valid calendar day drop ID into a Date", () => {
    const result = parseDayDropId("cal-day-2026-04-05");

    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3); // April = 3
    expect(result.getDate()).toBe(5);
  });

  it("returns null for null, invalid, or malformed input", () => {
    expect(parseDayDropId(null)).toBeNull();
    expect(parseDayDropId("invalid")).toBeNull();
    expect(parseDayDropId("cal-day-not-a-date")).toBeNull();
  });
});
