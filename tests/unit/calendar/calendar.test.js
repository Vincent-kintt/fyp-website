// tests/unit/calendar/calendar.test.js
//
// Unit tests for pure helpers in lib/calendar.js.
// No React, no DOM — pure function calls only.

import { describe, it, expect } from "vitest";
import {
  SLOT_HEIGHT,
  HOUR_HEIGHT,
  MIN_BLOCK_HEIGHT,
  getBlockTop,
  getBlockHeight,
  clipReminderToDay,
  groupOverlappingReminders,
  buildTasksByDate,
  getRemindersForDate,
  formatHourLabel,
} from "@/lib/calendar.js";

// ---------------------------------------------------------------------------
// getBlockTop
// ---------------------------------------------------------------------------

describe("getBlockTop", () => {
  it("returns 0 for midnight", () => {
    expect(getBlockTop("2026-04-07T00:00")).toBe(0);
  });

  it("returns 912 for 9:30 AM (9.5 * 96)", () => {
    expect(getBlockTop("2026-04-07T09:30")).toBe(912);
  });

  it("returns HOUR_HEIGHT * 12 for noon", () => {
    expect(getBlockTop("2026-04-07T12:00")).toBe(12 * HOUR_HEIGHT);
  });

  it("returns correct value for 23:00", () => {
    expect(getBlockTop("2026-04-07T23:00")).toBe(23 * HOUR_HEIGHT);
  });

  it("returns 0 for falsy input", () => {
    expect(getBlockTop(null)).toBe(0);
    expect(getBlockTop("")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getBlockHeight
// ---------------------------------------------------------------------------

describe("getBlockHeight", () => {
  it("returns SLOT_HEIGHT (48) for null duration", () => {
    expect(getBlockHeight(null)).toBe(SLOT_HEIGHT);
    expect(getBlockHeight(undefined)).toBe(SLOT_HEIGHT);
  });

  it("returns 48 for 30-minute duration", () => {
    expect(getBlockHeight(30)).toBe(48);
  });

  it("returns 96 for 60-minute duration", () => {
    expect(getBlockHeight(60)).toBe(96);
  });

  it("returns MIN_BLOCK_HEIGHT (28) for very short durations (5 min)", () => {
    expect(getBlockHeight(5)).toBe(MIN_BLOCK_HEIGHT);
  });

  it("returns MIN_BLOCK_HEIGHT for 0-minute duration", () => {
    expect(getBlockHeight(0)).toBe(MIN_BLOCK_HEIGHT);
  });

  it("returns 144 for 90-minute duration", () => {
    expect(getBlockHeight(90)).toBe(144);
  });
});

// ---------------------------------------------------------------------------
// clipReminderToDay
// ---------------------------------------------------------------------------

describe("clipReminderToDay", () => {
  it("returns full event for same-day reminder", () => {
    const reminder = { dateTime: "2026-04-07T09:00", duration: 60 };
    const result = clipReminderToDay(reminder, "2026-04-07");
    expect(result).not.toBeNull();
    expect(result.startMinute).toBe(9 * 60);
    expect(result.durationMinutes).toBe(60);
    expect(result.clipped).toBe(false);
  });

  it("clips a cross-midnight event on the start day at 23:59", () => {
    // Starts at 23:00, lasts 90 minutes → crosses into next day
    const reminder = { dateTime: "2026-04-07T23:00", duration: 90 };
    const result = clipReminderToDay(reminder, "2026-04-07");
    expect(result).not.toBeNull();
    expect(result.startMinute).toBe(23 * 60);
    // Should be clipped, so durationMinutes < 90
    expect(result.durationMinutes).toBeLessThan(90);
    expect(result.clipped).toBe(true);
  });

  it("returns the next-day remainder portion for cross-midnight event", () => {
    // Starts at 23:00, lasts 90 minutes → 30 min remain on next day (00:00–00:30)
    const reminder = { dateTime: "2026-04-07T23:00", duration: 90 };
    const result = clipReminderToDay(reminder, "2026-04-08");
    expect(result).not.toBeNull();
    expect(result.startMinute).toBe(0); // starts at midnight
    expect(result.clipped).toBe(true);
  });

  it("returns null for an unrelated day", () => {
    const reminder = { dateTime: "2026-04-07T09:00", duration: 60 };
    const result = clipReminderToDay(reminder, "2026-04-09");
    expect(result).toBeNull();
  });

  it("returns null when reminder has no dateTime", () => {
    const reminder = { dateTime: null, duration: 30 };
    expect(clipReminderToDay(reminder, "2026-04-07")).toBeNull();
  });

  it("uses 30-minute default when duration is null", () => {
    const reminder = { dateTime: "2026-04-07T10:00", duration: null };
    const result = clipReminderToDay(reminder, "2026-04-07");
    expect(result).not.toBeNull();
    expect(result.startMinute).toBe(10 * 60);
    expect(result.durationMinutes).toBe(30);
  });

  it("handles an event that spans exactly to midnight (23:30 + 30min)", () => {
    const reminder = { dateTime: "2026-04-07T23:30", duration: 30 };
    const result = clipReminderToDay(reminder, "2026-04-07");
    expect(result).not.toBeNull();
    expect(result.startMinute).toBe(23 * 60 + 30);
  });
});

// ---------------------------------------------------------------------------
// groupOverlappingReminders
// ---------------------------------------------------------------------------

describe("groupOverlappingReminders", () => {
  it("returns empty map for empty input", () => {
    const result = groupOverlappingReminders([]);
    expect(result.size).toBe(0);
  });

  it("assigns column 0 / totalColumns 1 for a single non-overlapping reminder", () => {
    const reminders = [
      { id: "a", dateTime: "2026-04-07T09:00", duration: 30 },
    ];
    const result = groupOverlappingReminders(reminders);
    expect(result.get("a")).toEqual({ column: 0, totalColumns: 1 });
  });

  it("non-overlapping reminders each get their own column 0 / total 1", () => {
    const reminders = [
      { id: "a", dateTime: "2026-04-07T09:00", duration: 30 },
      { id: "b", dateTime: "2026-04-07T10:00", duration: 30 }, // no overlap
    ];
    const result = groupOverlappingReminders(reminders);
    expect(result.get("a")).toEqual({ column: 0, totalColumns: 1 });
    expect(result.get("b")).toEqual({ column: 0, totalColumns: 1 });
  });

  it("two overlapping reminders get totalColumns 2 with distinct columns", () => {
    const reminders = [
      { id: "a", dateTime: "2026-04-07T09:00", duration: 60 },
      { id: "b", dateTime: "2026-04-07T09:30", duration: 60 }, // overlaps a
    ];
    const result = groupOverlappingReminders(reminders);
    const a = result.get("a");
    const b = result.get("b");
    expect(a.totalColumns).toBe(2);
    expect(b.totalColumns).toBe(2);
    expect(a.column).not.toBe(b.column);
    expect([a.column, b.column].sort()).toEqual([0, 1]);
  });

  it("three overlapping reminders all get totalColumns 3", () => {
    const reminders = [
      { id: "a", dateTime: "2026-04-07T09:00", duration: 120 },
      { id: "b", dateTime: "2026-04-07T09:00", duration: 60 },
      { id: "c", dateTime: "2026-04-07T09:30", duration: 60 },
    ];
    const result = groupOverlappingReminders(reminders);
    for (const id of ["a", "b", "c"]) {
      expect(result.get(id).totalColumns).toBe(3);
    }
  });

  it("handles null/undefined input gracefully", () => {
    expect(groupOverlappingReminders(null).size).toBe(0);
    expect(groupOverlappingReminders(undefined).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildTasksByDate
// ---------------------------------------------------------------------------

describe("buildTasksByDate", () => {
  it("returns empty object for empty array", () => {
    expect(buildTasksByDate([])).toEqual({});
  });

  it("groups reminders by date string", () => {
    const reminders = [
      { id: "1", dateTime: "2026-04-07T09:00" },
      { id: "2", dateTime: "2026-04-07T14:00" },
      { id: "3", dateTime: "2026-04-08T10:00" },
    ];
    const result = buildTasksByDate(reminders);
    expect(Object.keys(result).sort()).toEqual(["2026-04-07", "2026-04-08"]);
    expect(result["2026-04-07"]).toHaveLength(2);
    expect(result["2026-04-08"]).toHaveLength(1);
  });

  it("skips reminders without dateTime", () => {
    const reminders = [
      { id: "1", dateTime: null },
      { id: "2", dateTime: "2026-04-07T09:00" },
    ];
    const result = buildTasksByDate(reminders);
    expect(Object.keys(result)).toEqual(["2026-04-07"]);
  });

  it("handles non-array input gracefully", () => {
    expect(buildTasksByDate(null)).toEqual({});
    expect(buildTasksByDate(undefined)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// getRemindersForDate
// ---------------------------------------------------------------------------

describe("getRemindersForDate", () => {
  const reminders = [
    { id: "1", dateTime: "2026-04-07T09:00" },
    { id: "2", dateTime: "2026-04-07T15:30" },
    { id: "3", dateTime: "2026-04-08T10:00" },
    { id: "4", dateTime: null },
  ];

  it("returns reminders matching the given date", () => {
    const date = new Date("2026-04-07");
    const result = getRemindersForDate(reminders, date);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["1", "2"]);
  });

  it("returns empty array when no reminders match the date", () => {
    const date = new Date("2026-04-09");
    const result = getRemindersForDate(reminders, date);
    expect(result).toHaveLength(0);
  });

  it("excludes reminders with null dateTime", () => {
    const date = new Date("2026-04-07");
    const result = getRemindersForDate(reminders, date);
    const ids = result.map((r) => r.id);
    expect(ids).not.toContain("4");
  });

  it("returns empty array for falsy inputs", () => {
    expect(getRemindersForDate(null, new Date())).toHaveLength(0);
    expect(getRemindersForDate(reminders, null)).toHaveLength(0);
    expect(getRemindersForDate(undefined, new Date())).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// formatHourLabel
// ---------------------------------------------------------------------------

describe("formatHourLabel", () => {
  it("zh-TW: formats hour 9 as '9:00'", () => {
    expect(formatHourLabel(9, "zh-TW")).toBe("9:00");
  });

  it("zh-TW: formats hour 0 as '0:00'", () => {
    expect(formatHourLabel(0, "zh-TW")).toBe("0:00");
  });

  it("zh-TW: formats hour 13 as '13:00'", () => {
    expect(formatHourLabel(13, "zh-TW")).toBe("13:00");
  });

  it("en: formats hour 9 as '9 AM'", () => {
    expect(formatHourLabel(9, "en")).toBe("9 AM");
  });

  it("en: formats hour 12 as '12 PM'", () => {
    expect(formatHourLabel(12, "en")).toBe("12 PM");
  });

  it("en: formats hour 0 as '12 AM'", () => {
    expect(formatHourLabel(0, "en")).toBe("12 AM");
  });

  it("en: formats hour 15 as '3 PM'", () => {
    expect(formatHourLabel(15, "en")).toBe("3 PM");
  });

  it("en: formats hour 23 as '11 PM'", () => {
    expect(formatHourLabel(23, "en")).toBe("11 PM");
  });
});
