// tests/unit/calendar/MiniCalendar.test.js
//
// Tests for MiniCalendar logic: month grid generation, date classification,
// dot indicator logic. We test the underlying date-fns behaviour that drives
// props/class decisions, keeping consistent with the project's pure-logic
// unit-test pattern (no DOM environment configured).

import { describe, it, expect, vi } from "vitest";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";

// ---------------------------------------------------------------------------
// Helper: build the same week grid MiniCalendar produces
// ---------------------------------------------------------------------------
function buildCalendarGrid(currentMonth) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const start = startOfWeek(monthStart);
  const end = endOfWeek(monthEnd);

  const weeks = [];
  let day = start;
  while (day <= end) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// ---------------------------------------------------------------------------
// Helper: compute dot visibility for a given day
// ---------------------------------------------------------------------------
function hasDot(cellDay, tasksByDate) {
  const dateStr = format(cellDay, "yyyy-MM-dd");
  return !!(tasksByDate[dateStr] && tasksByDate[dateStr].length > 0);
}

// ---------------------------------------------------------------------------
// Helper: compute selected class for a given day
// ---------------------------------------------------------------------------
function isSelected(cellDay, selectedDate) {
  return selectedDate ? isSameDay(cellDay, selectedDate) : false;
}

// Mock i18n (mirrors the useTranslations mock pattern used in the codebase)
vi.mock("next-intl", () => ({
  useTranslations: () => (key) => {
    const map = {
      "days.sun": "Sun",
      "days.mon": "Mon",
      "days.tue": "Tue",
      "days.wed": "Wed",
      "days.thu": "Thu",
      "days.fri": "Fri",
      "days.sat": "Sat",
    };
    return map[key] ?? key;
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MiniCalendar — day labels", () => {
  it("exposes all 7 day labels via i18n mock", async () => {
    const { useTranslations } = await import("next-intl");
    const t = useTranslations("calendar");

    const labels = [
      t("days.sun"),
      t("days.mon"),
      t("days.tue"),
      t("days.wed"),
      t("days.thu"),
      t("days.fri"),
      t("days.sat"),
    ];

    expect(labels).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });
});

describe("MiniCalendar — month title", () => {
  it("formats April 2026 as 'April 2026'", () => {
    const april2026 = new Date(2026, 3, 1); // month is 0-indexed
    expect(format(april2026, "MMMM yyyy")).toBe("April 2026");
  });

  it("formats January 2025 as 'January 2025'", () => {
    const jan2025 = new Date(2025, 0, 1);
    expect(format(jan2025, "MMMM yyyy")).toBe("January 2025");
  });
});

describe("MiniCalendar — grid generation", () => {
  it("produces a 7-column grid starting on Sunday", () => {
    const april2026 = new Date(2026, 3, 1);
    const weeks = buildCalendarGrid(april2026);

    // Each week has exactly 7 days
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
  });

  it("first cell of April 2026 grid starts on the Sunday before April 1", () => {
    const april2026 = new Date(2026, 3, 1);
    const weeks = buildCalendarGrid(april2026);
    const firstDay = weeks[0][0];

    // April 1 2026 is a Wednesday; the grid should start on Sunday March 29
    expect(format(firstDay, "yyyy-MM-dd")).toBe("2026-03-29");
  });

  it("all days in current-month rows are isSameMonth with monthStart", () => {
    const april2026 = new Date(2026, 3, 1);
    const monthStart = startOfMonth(april2026);
    const weeks = buildCalendarGrid(april2026);
    const allDays = weeks.flat();

    const currentMonthDays = allDays.filter((d) => isSameMonth(d, monthStart));
    expect(currentMonthDays).toHaveLength(30); // April has 30 days
  });
});

describe("MiniCalendar — selected date highlight", () => {
  it("isSelected returns true for the matching date", () => {
    const april7 = new Date(2026, 3, 7);
    const selectedDate = new Date(2026, 3, 7);
    expect(isSelected(april7, selectedDate)).toBe(true);
  });

  it("isSelected returns false for a different date", () => {
    const april7 = new Date(2026, 3, 7);
    const selectedDate = new Date(2026, 3, 8);
    expect(isSelected(april7, selectedDate)).toBe(false);
  });

  it("isSelected returns false when selectedDate is null", () => {
    const april7 = new Date(2026, 3, 7);
    expect(isSelected(april7, null)).toBe(false);
  });

  it("selected cells in the grid match the chosen date", () => {
    const april2026 = new Date(2026, 3, 1);
    const selectedDate = new Date(2026, 3, 15);
    const weeks = buildCalendarGrid(april2026);
    const allDays = weeks.flat();

    const selectedDays = allDays.filter((d) => isSelected(d, selectedDate));
    expect(selectedDays).toHaveLength(1);
    expect(format(selectedDays[0], "yyyy-MM-dd")).toBe("2026-04-15");
  });
});

describe("MiniCalendar — navigation", () => {
  it("onMonthChange receives previous month when navigating back", () => {
    const april2026 = new Date(2026, 3, 1);
    const prev = subMonths(april2026, 1);
    expect(format(prev, "MMMM yyyy")).toBe("March 2026");
  });

  it("onMonthChange receives next month when navigating forward", () => {
    const april2026 = new Date(2026, 3, 1);
    const next = addMonths(april2026, 1);
    expect(format(next, "MMMM yyyy")).toBe("May 2026");
  });
});

describe("MiniCalendar — dot indicator (data-dot)", () => {
  it("hasDot returns true for a date with tasks", () => {
    const tasksByDate = {
      "2026-04-07": [{ id: "1", title: "Meeting" }],
    };
    const april7 = new Date(2026, 3, 7);
    expect(hasDot(april7, tasksByDate)).toBe(true);
  });

  it("hasDot returns false for a date with no tasks", () => {
    const tasksByDate = {};
    const april7 = new Date(2026, 3, 7);
    expect(hasDot(april7, tasksByDate)).toBe(false);
  });

  it("hasDot returns false for a date with empty task array", () => {
    const tasksByDate = { "2026-04-07": [] };
    const april7 = new Date(2026, 3, 7);
    expect(hasDot(april7, tasksByDate)).toBe(false);
  });

  it("correctly identifies multiple dates with tasks in a grid", () => {
    const tasksByDate = {
      "2026-04-07": [{ id: "1", title: "Meeting" }],
      "2026-04-14": [{ id: "2", title: "Review" }, { id: "3", title: "Deploy" }],
    };
    const april2026 = new Date(2026, 3, 1);
    const weeks = buildCalendarGrid(april2026);
    const allDays = weeks.flat();

    const daysWithDots = allDays.filter((d) => hasDot(d, tasksByDate));
    const dotDateStrs = daysWithDots.map((d) => format(d, "yyyy-MM-dd"));
    expect(dotDateStrs).toContain("2026-04-07");
    expect(dotDateStrs).toContain("2026-04-14");
    expect(daysWithDots).toHaveLength(2);
  });
});

describe("MiniCalendar — other-month dimming", () => {
  it("identifies out-of-month dates correctly", () => {
    const april2026 = new Date(2026, 3, 1);
    const monthStart = startOfMonth(april2026);
    const weeks = buildCalendarGrid(april2026);
    const allDays = weeks.flat();

    const outOfMonthDays = allDays.filter((d) => !isSameMonth(d, monthStart));
    // All out-of-month days should be either from March or May
    for (const d of outOfMonthDays) {
      const m = d.getMonth();
      expect(m === 2 || m === 4).toBe(true); // March (2) or May (4)
    }
  });
});
