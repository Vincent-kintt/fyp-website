/**
 * Tests for `formatDateTime` — pure relative-date formatter extracted from
 * QuickAdd.jsx. Six branches:
 *   1. today + time
 *   2. tomorrow + time
 *   3. day-after-tomorrow ("tomorrow +1 ...")
 *   4. within a week → day name
 *   5. further out (same year or other) → month/day
 *   6. null / missing input
 *
 * Locale + `t` are explicit params now (previously closure-captured).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatDateTime } from "@/lib/quickAdd/formatDateTime.js";

const t = (key) => key; // identity translation — keys are the assertion target

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formatDateTime", () => {
  it("returns null for missing input", () => {
    expect(formatDateTime(null, { t, language: "en" })).toBeNull();
    expect(formatDateTime(undefined, { t, language: "en" })).toBeNull();
    expect(formatDateTime("", { t, language: "en" })).toBeNull();
  });

  it("formats 'today' + time when the date is today", () => {
    const now = new Date(2026, 4, 18, 8, 0, 0); // May 18 2026 08:00 local
    vi.setSystemTime(now);

    // Target: same day at 14:30 local
    const target = new Date(2026, 4, 18, 14, 30, 0);

    const out = formatDateTime(target.toISOString(), { t, language: "en", now });

    expect(out).toMatch(/^today /);
    // 24h or 12h depending on language; "en" => 12h (hour12: false per code? checked below)
    // For "en", `hour12: language !== "en"` = false → 24h "14:30"
    expect(out).toContain("14:30");
  });

  it("formats 'tomorrow' + time when the date is the next day", () => {
    const now = new Date(2026, 4, 18, 8, 0, 0);
    vi.setSystemTime(now);

    const target = new Date(2026, 4, 19, 9, 0, 0); // May 19

    const out = formatDateTime(target.toISOString(), { t, language: "en", now });

    expect(out).toMatch(/^tomorrow /);
    expect(out).toContain("09:00");
  });

  it("formats 'tomorrow +1' for the day after tomorrow", () => {
    const now = new Date(2026, 4, 18, 8, 0, 0);
    vi.setSystemTime(now);

    const target = new Date(2026, 4, 20, 17, 0, 0); // May 20

    const out = formatDateTime(target.toISOString(), { t, language: "en", now });

    expect(out).toContain("tomorrow +1");
    expect(out).toContain("17:00");
  });

  it("formats with day-of-week within the next week", () => {
    // now = Mon May 18 2026; target = Fri May 22 = within 7 days (excluding +1)
    const now = new Date(2026, 4, 18, 8, 0, 0);
    vi.setSystemTime(now);

    const target = new Date(2026, 4, 22, 10, 0, 0); // Friday

    const out = formatDateTime(target.toISOString(), { t, language: "en", now });

    // Should contain a long weekday name, NOT "today"/"tomorrow"
    expect(out).not.toMatch(/today|tomorrow/);
    expect(out).toMatch(/Friday/);
    expect(out).toContain("10:00");
  });

  it("formats month/day for a date further out (same or other year)", () => {
    const now = new Date(2026, 4, 18, 8, 0, 0);
    vi.setSystemTime(now);

    // Target ≥ 7 days out → falls into the long-date branch (toLocaleString
    // with month/day/hour/minute). The exact format depends on Intl, so
    // assert it includes the month abbrev + day number and a time component.
    const target = new Date(2026, 10, 3, 15, 0, 0); // Nov 3 2026

    const out = formatDateTime(target.toISOString(), { t, language: "en", now });

    expect(out).not.toMatch(/today|tomorrow/);
    expect(out).toMatch(/Nov/);
    expect(out).toMatch(/3/);
  });

  it("respects zh-TW locale formatting", () => {
    const now = new Date(2026, 4, 18, 8, 0, 0);
    vi.setSystemTime(now);

    const target = new Date(2026, 4, 18, 14, 30, 0); // today 14:30

    const out = formatDateTime(target.toISOString(), { t, language: "zh", now });

    // Today branch with zh locale: hour12 true so includes AM/PM marker
    expect(out).toMatch(/^today /);
    // zh-TW 12-hour clock renders 下午 / 上午 markers
    expect(out).toMatch(/下午|上午|PM|AM/);
  });
});
