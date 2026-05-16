/**
 * Regression tests for timezone handling across the app.
 * Covers naiveToUTC, formatInTimezone, formatTimezoneParts (dateUtils.js)
 * and getSystemPrompt (prompt.js).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  naiveToUTC,
  formatInTimezone,
  formatTimezoneParts,
  nowAsWallClockIn,
} from "@/lib/ai/dateUtils.js";
import { getSystemPrompt } from "@/lib/ai/prompt.js";

// ─── naiveToUTC ───────────────────────────────────────────────

describe("naiveToUTC", () => {
  describe("null/empty input", () => {
    it("returns null for null input", () => {
      expect(naiveToUTC(null, "Asia/Taipei")).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(naiveToUTC(undefined, "Asia/Taipei")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(naiveToUTC("", "Asia/Taipei")).toBeNull();
    });
  });

  describe("Z-suffixed ISO strings (already absolute)", () => {
    it("parses Z-suffixed string directly, skipping timezone math", () => {
      const result = naiveToUTC("2026-04-09T00:00:00.000Z", "Asia/Taipei");
      expect(result.toISOString()).toBe("2026-04-09T00:00:00.000Z");
    });

    it("handles short Z-suffix format", () => {
      const result = naiveToUTC("2026-04-09T08:00Z", "Asia/Taipei");
      expect(result.getTime()).toBe(new Date("2026-04-09T08:00Z").getTime());
    });

    it("does not double-shift setQuickReminder-style ISO strings", () => {
      // setQuickReminder passes dateTime.toISOString() — e.g., "2026-04-08T07:30:00.000Z"
      // Must NOT be treated as naive 07:30 in Asia/Taipei
      const isoStr = "2026-04-08T07:30:00.000Z";
      const result = naiveToUTC(isoStr, "Asia/Taipei");
      expect(result.toISOString()).toBe(isoStr);
    });
  });

  describe("offset-suffixed strings (already absolute)", () => {
    it("parses +offset string directly", () => {
      const result = naiveToUTC("2026-04-09T08:00+08:00", "Asia/Taipei");
      expect(result.toISOString()).toBe("2026-04-09T00:00:00.000Z");
    });

    it("parses -offset string directly", () => {
      const result = naiveToUTC("2026-04-09T08:00-05:00", "America/New_York");
      expect(result.toISOString()).toBe("2026-04-09T13:00:00.000Z");
    });
  });

  describe("naive strings with timezone (core conversion)", () => {
    it("converts 8 AM Asia/Taipei to UTC midnight", () => {
      // 2026-04-09 08:00 in Asia/Taipei (UTC+8) = 2026-04-09 00:00 UTC
      const result = naiveToUTC("2026-04-09T08:00", "Asia/Taipei");
      expect(result.toISOString()).toBe("2026-04-09T00:00:00.000Z");
    });

    it("converts midnight Asia/Taipei to previous day 16:00 UTC", () => {
      // 2026-04-09 00:00 in Asia/Taipei (UTC+8) = 2026-04-08 16:00 UTC
      const result = naiveToUTC("2026-04-09T00:00", "Asia/Taipei");
      expect(result.toISOString()).toBe("2026-04-08T16:00:00.000Z");
    });

    it("converts 5 PM America/New_York (EDT, UTC-4) correctly", () => {
      // 2026-04-09 17:00 in America/New_York (EDT = UTC-4) = 2026-04-09 21:00 UTC
      const result = naiveToUTC("2026-04-09T17:00", "America/New_York");
      expect(result.toISOString()).toBe("2026-04-09T21:00:00.000Z");
    });

    it("converts noon UTC correctly", () => {
      // 2026-04-09 12:00 in UTC = 2026-04-09 12:00 UTC
      const result = naiveToUTC("2026-04-09T12:00", "UTC");
      expect(result.toISOString()).toBe("2026-04-09T12:00:00.000Z");
    });
  });

  describe("naive strings without timezone (fallback)", () => {
    it("falls back to new Date() when timezone is null", () => {
      const result = naiveToUTC("2026-04-09T08:00", null);
      expect(result).toBeInstanceOf(Date);
      expect(isNaN(result.getTime())).toBe(false);
    });

    it("falls back to new Date() when timezone is undefined", () => {
      const result = naiveToUTC("2026-04-09T08:00", undefined);
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe("invalid date strings", () => {
    it("returns null for garbage string with timezone", () => {
      const result = naiveToUTC("not-a-date", "Asia/Taipei");
      expect(result).toBeNull();
    });

    it("returns Invalid Date for garbage string without timezone", () => {
      const result = naiveToUTC("not-a-date", null);
      expect(isNaN(result.getTime())).toBe(true);
    });
  });

  describe("date-only strings", () => {
    it("defaults time to 00:00 when no T part", () => {
      const result = naiveToUTC("2026-04-09", "Asia/Taipei");
      // 2026-04-09 00:00 Asia/Taipei = 2026-04-08 16:00 UTC
      expect(result.toISOString()).toBe("2026-04-08T16:00:00.000Z");
    });
  });
});

// ─── formatInTimezone ─────────────────────────────────────────

describe("formatInTimezone", () => {
  describe("with IANA timezone", () => {
    it("formats UTC midnight as 08:00 in Asia/Taipei", () => {
      const date = new Date("2026-04-09T00:00:00.000Z");
      const result = formatInTimezone(date, "Asia/Taipei");
      expect(result).toBe("2026-04-09 08:00");
    });

    it("formats UTC noon as 20:00 in Asia/Taipei", () => {
      const date = new Date("2026-04-09T12:00:00.000Z");
      const result = formatInTimezone(date, "Asia/Taipei");
      expect(result).toBe("2026-04-09 20:00");
    });

    it("formats date that crosses day boundary", () => {
      // UTC 20:00 on Apr 9 = Apr 10 04:00 in Asia/Taipei
      const date = new Date("2026-04-09T20:00:00.000Z");
      const result = formatInTimezone(date, "Asia/Taipei");
      expect(result).toBe("2026-04-10 04:00");
    });

    it("formats in UTC timezone", () => {
      const date = new Date("2026-04-09T14:30:00.000Z");
      const result = formatInTimezone(date, "UTC");
      expect(result).toBe("2026-04-09 14:30");
    });
  });

  describe("without timezone (server-local fallback)", () => {
    it("returns a valid formatted string", () => {
      const date = new Date("2026-04-09T14:30:00.000Z");
      const result = formatInTimezone(date, null);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });
  });

  describe("invalid date", () => {
    it("returns 'Invalid date' for NaN date", () => {
      const result = formatInTimezone(new Date("garbage"), "Asia/Taipei");
      expect(result).toBe("Invalid date");
    });

    it("returns 'Invalid date' for NaN date without timezone", () => {
      const result = formatInTimezone(new Date("garbage"), null);
      expect(result).toBe("Invalid date");
    });
  });
});

// ─── formatTimezoneParts ──────────────────────────────────────
// Used by prompt.js getSystemPrompt to split date/time for natural-language
// injection. Same conversion as formatInTimezone, but returns parts not joined.

describe("formatTimezoneParts", () => {
  it("splits UTC time into date+time parts in Asia/Taipei", () => {
    const date = new Date("2026-04-09T00:00:00.000Z");
    expect(formatTimezoneParts(date, "Asia/Taipei")).toEqual({
      date: "2026-04-09",
      time: "08:00",
    });
  });

  it("crosses day boundary correctly", () => {
    const date = new Date("2026-04-09T20:00:00.000Z");
    expect(formatTimezoneParts(date, "Asia/Taipei")).toEqual({
      date: "2026-04-10",
      time: "04:00",
    });
  });

  it("returns local fallback when timezone is null", () => {
    const date = new Date("2026-04-09T14:30:00.000Z");
    const parts = formatTimezoneParts(date, null);
    expect(parts.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parts.time).toMatch(/^\d{2}:\d{2}$/);
  });

  it("returns Invalid for NaN date", () => {
    expect(formatTimezoneParts(new Date("garbage"), "Asia/Taipei")).toEqual({
      date: "Invalid",
      time: "Invalid",
    });
  });
});

// ─── naiveToUTC + formatInTimezone round-trip ─────────────────

describe("round-trip: naiveToUTC → formatInTimezone", () => {
  it("naive 08:00 Asia/Taipei → UTC → format back as 08:00 Asia/Taipei", () => {
    const utcDate = naiveToUTC("2026-04-09T08:00", "Asia/Taipei");
    const displayed = formatInTimezone(utcDate, "Asia/Taipei");
    expect(displayed).toBe("2026-04-09 08:00");
  });

  it("naive 23:30 Asia/Taipei → UTC → format back as 23:30 Asia/Taipei", () => {
    const utcDate = naiveToUTC("2026-04-09T23:30", "Asia/Taipei");
    const displayed = formatInTimezone(utcDate, "Asia/Taipei");
    expect(displayed).toBe("2026-04-09 23:30");
  });

  it("naive 00:00 UTC → UTC → format back as 00:00 UTC", () => {
    const utcDate = naiveToUTC("2026-04-09T00:00", "UTC");
    const displayed = formatInTimezone(utcDate, "UTC");
    expect(displayed).toBe("2026-04-09 00:00");
  });
});

// ─── getSystemPrompt ──────────────────────────────────────────

describe("getSystemPrompt", () => {
  describe("with IANA timezone", () => {
    it("includes timezone in output", () => {
      const prompt = getSystemPrompt({
        userLocation: { timezone: "Asia/Taipei" },
      });
      expect(prompt).toContain("Timezone: Asia/Taipei");
    });

    it("includes today's date formatted for user's timezone", () => {
      const prompt = getSystemPrompt({
        userLocation: { timezone: "Asia/Taipei" },
      });
      // Should contain a date line like "Today: 2026-04-08"
      expect(prompt).toMatch(/Today: \d{4}-\d{2}-\d{2}/);
    });

    it("includes tomorrow's date", () => {
      const prompt = getSystemPrompt({
        userLocation: { timezone: "Asia/Taipei" },
      });
      expect(prompt).toMatch(/Tomorrow: \d{4}-\d{2}-\d{2}/);
    });

    it("today and tomorrow differ by exactly one day", () => {
      const prompt = getSystemPrompt({
        userLocation: { timezone: "Asia/Taipei" },
      });
      const todayMatch = prompt.match(/Today: (\d{4}-\d{2}-\d{2})/);
      const tmrMatch = prompt.match(/Tomorrow: (\d{4}-\d{2}-\d{2})/);
      const today = new Date(todayMatch[1] + "T00:00:00");
      const tmr = new Date(tmrMatch[1] + "T00:00:00");
      const diffMs = tmr.getTime() - today.getTime();
      expect(diffMs).toBe(86400000);
    });
  });

  describe("with tzOffset", () => {
    it("computes UTC+8 timezone string from offset -480", () => {
      const prompt = getSystemPrompt({ tzOffset: -480 });
      expect(prompt).toContain("Timezone: UTC+8");
    });

    it("computes UTC-5 timezone string from offset 300", () => {
      const prompt = getSystemPrompt({ tzOffset: 300 });
      expect(prompt).toContain("Timezone: UTC-5");
    });

    it("computes UTC+5:30 for offset -330 (India)", () => {
      const prompt = getSystemPrompt({ tzOffset: -330 });
      expect(prompt).toContain("Timezone: UTC+5:30");
    });
  });

  describe("fallback (no timezone info)", () => {
    it("still produces a valid prompt with date fields", () => {
      const prompt = getSystemPrompt({});
      expect(prompt).toMatch(/Today: \d{4}-\d{2}-\d{2}/);
      expect(prompt).toMatch(/Tomorrow: \d{4}-\d{2}-\d{2}/);
      expect(prompt).toMatch(/Current Time: \d{2}:\d{2}/);
      expect(prompt).toMatch(/Timezone: UTC[+-]/);
    });
  });

  describe("timezone rule in prompt", () => {
    it("instructs AI to use local timezone for dateTime output", () => {
      const prompt = getSystemPrompt({
        userLocation: { timezone: "Asia/Taipei" },
      });
      expect(prompt).toContain("local timezone");
      expect(prompt).toContain("YYYY-MM-DDTHH:mm");
    });
  });
});

// ─── nowAsWallClockIn ─────────────────────────────────────────
// Returns a Date encoded in server-local TZ whose getXxx() values match what a
// clock in the given IANA timezone shows right now. Used by parse-task to give
// chrono-node a "user-local now" reference without changing server TZ.

describe("nowAsWallClockIn", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns wall-clock parts for Asia/Taipei (UTC+8, no DST)", () => {
    vi.setSystemTime(new Date("2026-05-16T10:00:00Z"));
    const d = nowAsWallClockIn("Asia/Taipei");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4); // May
    expect(d.getDate()).toBe(16);
    expect(d.getHours()).toBe(18); // 10:00 UTC + 8 = 18:00 in Taipei
    expect(d.getMinutes()).toBe(0);
  });

  it("returns wall-clock parts for America/New_York during EST (UTC-5)", () => {
    // 2026-02-01 noon UTC = 07:00 EST in New York
    vi.setSystemTime(new Date("2026-02-01T12:00:00Z"));
    const d = nowAsWallClockIn("America/New_York");
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(7);
  });

  it("handles US DST spring-forward (2026-03-08)", () => {
    // 2026-03-08 06:30 UTC -> 01:30 EST in NY (still standard time)
    vi.setSystemTime(new Date("2026-03-08T06:30:00Z"));
    expect(nowAsWallClockIn("America/New_York").getHours()).toBe(1);
    // 2026-03-08 07:30 UTC -> 03:30 EDT in NY (clocks jumped to 03:00 at 02:00 local)
    vi.setSystemTime(new Date("2026-03-08T07:30:00Z"));
    expect(nowAsWallClockIn("America/New_York").getHours()).toBe(3);
  });

  it("handles US DST fall-back (2026-11-01)", () => {
    // 2026-11-01 05:30 UTC -> 01:30 EDT in NY (before fall back at 02:00)
    vi.setSystemTime(new Date("2026-11-01T05:30:00Z"));
    expect(nowAsWallClockIn("America/New_York").getHours()).toBe(1);
    // 2026-11-01 06:30 UTC -> 01:30 EST in NY (after fall back, second occurrence of 01:30)
    vi.setSystemTime(new Date("2026-11-01T06:30:00Z"));
    expect(nowAsWallClockIn("America/New_York").getHours()).toBe(1);
  });

  it("falls back to server clock when timezone is null/undefined/empty", () => {
    vi.setSystemTime(new Date("2026-05-16T10:00:00Z"));
    const ref = new Date();
    expect(nowAsWallClockIn(null).getTime()).toBe(ref.getTime());
    expect(nowAsWallClockIn(undefined).getTime()).toBe(ref.getTime());
    expect(nowAsWallClockIn("").getTime()).toBe(ref.getTime());
  });

  it("crosses day boundary correctly (UTC late, Tokyo next-day morning)", () => {
    // 2026-05-16 22:30 UTC -> 2026-05-17 07:30 in Tokyo (UTC+9, no DST)
    vi.setSystemTime(new Date("2026-05-16T22:30:00Z"));
    const d = nowAsWallClockIn("Asia/Tokyo");
    expect(d.getDate()).toBe(17);
    expect(d.getHours()).toBe(7);
    expect(d.getMinutes()).toBe(30);
  });
});
