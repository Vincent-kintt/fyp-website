// Tests for lib/forms/dateTimeLocal.js — extracted from TaskEditForm.
// Locks the wall-clock formatting used to seed <input type="datetime-local">
// from a Date instance. The function reads LOCAL parts (getFullYear etc.)
// not UTC parts; the H7 fix converts the input string back to UTC via
// naiveToUTC later — see buildSubmitPayload.

import { describe, it, expect } from "vitest";
import { toLocalDateTimeString } from "@/lib/forms/dateTimeLocal.js";

describe("toLocalDateTimeString", () => {
  it("zero-pads single-digit months, days, hours, and minutes", () => {
    // Jan 2, 03:04 local — every part should be 2-digit
    const d = new Date(2026, 0, 2, 3, 4);
    expect(toLocalDateTimeString(d)).toBe("2026-01-02T03:04");
  });

  it("formats two-digit fields without padding artifacts", () => {
    const d = new Date(2026, 10, 15, 13, 45); // Nov 15, 13:45 local
    expect(toLocalDateTimeString(d)).toBe("2026-11-15T13:45");
  });

  it("returns local wall-clock parts (not UTC) — caller's TZ determines digits", () => {
    // The function uses get*() not getUTC*(). To assert this in a TZ-agnostic
    // way we feed a Date built from local parts and confirm the output round-
    // trips those exact parts.
    const d = new Date(2026, 5, 30, 23, 59); // Jun 30 23:59 local
    expect(toLocalDateTimeString(d)).toBe("2026-06-30T23:59");
  });

  it("uses local midnight when given 00:00", () => {
    const d = new Date(2026, 0, 1, 0, 0);
    expect(toLocalDateTimeString(d)).toBe("2026-01-01T00:00");
  });

  it("survives DST-style boundary — locks LOCAL parts regardless of UTC offset", () => {
    // We don't fake-time DST; we just confirm the function reflects whatever
    // LOCAL parts the Date object reports. If the platform's TZ shifts the
    // underlying instant, the LOCAL parts are still what `<input>` expects.
    const d = new Date(2026, 2, 30, 2, 30); // Mar 30 02:30 local (DST-ish)
    expect(toLocalDateTimeString(d)).toBe("2026-03-30T02:30");
  });
});
