import { describe, it, expect } from "vitest";
import {
  formatDateCompact,
  formatDateShort,
  formatDateMedium,
  formatDateFull,
} from "@/lib/format.js";

describe("formatDateCompact", () => {
  it("returns 'No date' for null input", () => {
    expect(formatDateCompact(null)).toBe("No date");
  });

  it("returns 'No date' for epoch date (1970)", () => {
    expect(formatDateCompact(new Date(0))).toBe("No date");
  });

  it("returns a truthy formatted string for a valid date with 'en'", () => {
    const result = formatDateCompact("2026-06-15T14:30:00Z", "en");

    expect(result).toBeTruthy();
    expect(result).not.toBe("No date");
  });

  it("returns '未設定' for null with 'zh' locale", () => {
    expect(formatDateCompact(null, "zh")).toBe("未設定");
  });

  it("returns '未設定' for epoch date with 'zh' locale", () => {
    expect(formatDateCompact(new Date(0), "zh")).toBe("未設定");
  });
});

describe("formatDateShort", () => {
  it("returns formatted string containing month and day for valid date", () => {
    const result = formatDateShort("2026-06-15T14:30:00Z");

    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/15/);
  });

  it("returns empty string for invalid date", () => {
    expect(formatDateShort("not-a-date")).toBe("");
  });
});

describe("formatDateMedium", () => {
  it("returns formatted string with month, year, and 'at'", () => {
    const result = formatDateMedium("2026-06-15T14:30:00Z");

    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/at/);
  });

  it("returns empty string for null input", () => {
    expect(formatDateMedium(null)).toBe("");
  });

  it("returns empty string for undefined input", () => {
    expect(formatDateMedium(undefined)).toBe("");
  });

  it("returns empty string for invalid date string", () => {
    expect(formatDateMedium("not-a-date")).toBe("");
  });
});

describe("formatDateFull", () => {
  it("returns formatted string with full month name and year", () => {
    const result = formatDateFull("2026-06-15T14:30:00Z");

    expect(result).toMatch(/June/);
    expect(result).toMatch(/2026/);
  });

  it("returns empty string for null input", () => {
    expect(formatDateFull(null)).toBe("");
  });

  it("returns empty string for undefined input", () => {
    expect(formatDateFull(undefined)).toBe("");
  });

  it("returns empty string for invalid date string", () => {
    expect(formatDateFull("not-a-date")).toBe("");
  });
});
