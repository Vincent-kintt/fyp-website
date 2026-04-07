/**
 * Regression tests for timezone handling across the app.
 * Covers naiveToUTC, formatInTimezone (tools.js) and getSystemPrompt (prompt.js).
 */
import { describe, it, expect, vi } from "vitest";

// Mock db module — tools.js imports it at top level
vi.mock("@/lib/db.js", () => ({
  getCollection: vi.fn(),
}));

const { naiveToUTC, formatInTimezone } = await import("@/lib/ai/tools.js");
const { getSystemPrompt } = await import("@/lib/ai/prompt.js");

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
