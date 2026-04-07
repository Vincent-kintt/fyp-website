import { describe, it, expect } from "vitest";
import { CALENDAR_SLOT_PREFIX, parseSlotDropId, computeSlotDateTime } from "@/lib/dnd";

describe("CALENDAR_SLOT_PREFIX", () => {
  it("is 'cal-slot-'", () => {
    expect(CALENDAR_SLOT_PREFIX).toBe("cal-slot-");
  });
});

describe("parseSlotDropId", () => {
  it("parses a valid slot ID", () => {
    const result = parseSlotDropId("cal-slot-2026-04-07-09:30");
    expect(result).not.toBeNull();
    expect(result.hour).toBe(9);
    expect(result.minute).toBe(30);
    expect(result.date.getFullYear()).toBe(2026);
    expect(result.date.getMonth()).toBe(3); // April = 3
    expect(result.date.getDate()).toBe(7);
  });

  it("parses midnight slot", () => {
    const result = parseSlotDropId("cal-slot-2026-04-07-00:00");
    expect(result.hour).toBe(0);
    expect(result.minute).toBe(0);
  });

  it("parses end-of-day slot", () => {
    const result = parseSlotDropId("cal-slot-2026-04-07-23:30");
    expect(result.hour).toBe(23);
    expect(result.minute).toBe(30);
  });

  it("returns null for day-level IDs", () => {
    expect(parseSlotDropId("cal-day-2026-04-07")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseSlotDropId(null)).toBeNull();
  });

  it("returns null for random string", () => {
    expect(parseSlotDropId("random-string")).toBeNull();
  });

  it("returns null for invalid date", () => {
    expect(parseSlotDropId("cal-slot-invalid-09:30")).toBeNull();
  });
});

describe("computeSlotDateTime", () => {
  it("returns ISO string with correct date and time", () => {
    const result = computeSlotDateTime({
      date: new Date(2026, 3, 7),
      hour: 14,
      minute: 30,
    });
    const d = new Date(result);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(7);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });

  it("handles midnight", () => {
    const result = computeSlotDateTime({
      date: new Date(2026, 3, 7),
      hour: 0,
      minute: 0,
    });
    const d = new Date(result);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });
});
