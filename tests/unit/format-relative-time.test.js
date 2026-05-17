import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatRelativeTime } from "@/lib/format.js";

const NOW = new Date("2026-05-17T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formatRelativeTime", () => {
  it("returns an empty string for null input", () => {
    expect(formatRelativeTime(null, "en")).toBe("");
  });

  it("returns an empty string for undefined input", () => {
    expect(formatRelativeTime(undefined, "en")).toBe("");
  });

  it("returns an empty string for an invalid date string", () => {
    expect(formatRelativeTime("not-a-date", "en")).toBe("");
  });

  it("returns a minute-bearing phrase for ~5 minutes ago in English", () => {
    const fiveMinAgo = new Date(NOW.getTime() - 5 * 60 * 1000);
    const result = formatRelativeTime(fiveMinAgo, "en");
    expect(result).toMatch(/minute/);
    // No suffix expected (caller wraps with t("editedAgo", { time }))
    expect(result).not.toMatch(/ago/);
  });

  it("returns a relative phrase (not toLocaleDateString) for 8 days ago", () => {
    const eightDaysAgo = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(eightDaysAgo, "en");
    // The pre-extraction code returned date.toLocaleDateString() for >=7 days
    // (e.g. "5/9/2026"). The new implementation should keep using date-fns'
    // relative phrasing (e.g. "8 days").
    expect(result).not.toMatch(/^\d+\/\d+\/\d+/);
    expect(result).toMatch(/day/);
  });

  it("returns localized output for zh-TW vs en", () => {
    const oneDayAgo = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    const en = formatRelativeTime(oneDayAgo, "en");
    const zh = formatRelativeTime(oneDayAgo, "zh-TW");

    // English output is ASCII only; zh-TW output contains CJK characters.
    expect(en).toMatch(/^[\x00-\x7F]+$/);
    expect(zh).toMatch(/[一-鿿]/);
    expect(en).not.toBe(zh);
  });
});
