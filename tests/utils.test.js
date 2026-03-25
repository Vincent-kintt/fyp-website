/**
 * Unit tests for lib/utils.js
 * Tests: tag normalization, status lifecycle, duration validation, category logic
 */
import { describe, it, expect } from "vitest";
import {
  normalizeTag,
  normalizeTags,
  validateTag,
  getMainCategory,
  categoryToTag,
  ensureCategoryTag,
  isValidStatus,
  isValidStatusTransition,
  deriveStatusFromCompleted,
  deriveCompletedFromStatus,
  validateDuration,
  formatDuration,
  calculateEndTime,
  hasTimeOverlap,
  REMINDER_STATUSES,
  STATUS_TRANSITIONS,
} from "@/lib/utils.js";

// ============================================
// Tag System
// ============================================
describe("normalizeTag", () => {
  it("lowercases and trims", () => {
    expect(normalizeTag("  WORK  ")).toBe("work");
  });
  it("strips leading #", () => {
    expect(normalizeTag("#homework")).toBe("homework");
  });
  it("replaces spaces with hyphens", () => {
    expect(normalizeTag("my tag")).toBe("my-tag");
  });
  it("removes special characters", () => {
    expect(normalizeTag("tag!@#$%^&*()")).toBe("tag");
  });
  it("collapses multiple hyphens", () => {
    expect(normalizeTag("a--b---c")).toBe("a-b-c");
  });
  it("trims hyphens from ends", () => {
    expect(normalizeTag("-tag-")).toBe("tag");
  });
  it("truncates to 30 chars", () => {
    const long = "a".repeat(40);
    expect(normalizeTag(long).length).toBe(30);
  });
  it("returns empty for null/undefined", () => {
    expect(normalizeTag(null)).toBe("");
    expect(normalizeTag(undefined)).toBe("");
    expect(normalizeTag("")).toBe("");
  });
  it("returns empty for non-string", () => {
    expect(normalizeTag(123)).toBe("");
  });
});

describe("normalizeTags", () => {
  it("normalizes and deduplicates", () => {
    expect(normalizeTags(["Work", "WORK", "work"])).toEqual(["work"]);
  });
  it("filters out tags shorter than 2 chars", () => {
    expect(normalizeTags(["a", "ab", "abc"])).toEqual(["ab", "abc"]);
  });
  it("returns empty for non-array", () => {
    expect(normalizeTags(null)).toEqual([]);
    expect(normalizeTags("string")).toEqual([]);
  });
  it("handles mixed valid/invalid tags", () => {
    expect(normalizeTags(["", "#", "ok", "  good  "])).toEqual(["ok", "good"]);
  });
});

describe("validateTag", () => {
  it("accepts valid tag", () => {
    expect(validateTag("work")).toEqual({ isValid: true });
  });
  it("rejects too short tag", () => {
    const result = validateTag("a");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("2 characters");
  });
});

describe("getMainCategory", () => {
  it("returns work if present", () => {
    expect(getMainCategory(["work", "urgent"])).toBe("work");
  });
  it("returns personal if present", () => {
    expect(getMainCategory(["personal"])).toBe("personal");
  });
  it("returns health if present", () => {
    expect(getMainCategory(["health"])).toBe("health");
  });
  it("returns other for unknown tags", () => {
    expect(getMainCategory(["shopping"])).toBe("other");
  });
  it("returns personal for empty array", () => {
    expect(getMainCategory([])).toBe("personal");
  });
  it("returns personal for non-array", () => {
    expect(getMainCategory(null)).toBe("personal");
  });
});

describe("categoryToTag", () => {
  it("maps known categories", () => {
    expect(categoryToTag("work")).toBe("work");
    expect(categoryToTag("health")).toBe("health");
    expect(categoryToTag("other")).toBe("general");
  });
  it("defaults to general for unknown", () => {
    expect(categoryToTag("xyz")).toBe("general");
  });
});

describe("ensureCategoryTag", () => {
  it("adds category tag if missing", () => {
    const result = ensureCategoryTag(["urgent"], "work");
    expect(result).toContain("work");
    expect(result).toContain("urgent");
  });
  it("does not duplicate if already present", () => {
    const result = ensureCategoryTag(["work", "urgent"], "work");
    expect(result.filter((t) => t === "work").length).toBe(1);
  });
});

// ============================================
// Status Lifecycle
// ============================================
describe("isValidStatus", () => {
  it("accepts all valid statuses", () => {
    REMINDER_STATUSES.forEach((s) => {
      expect(isValidStatus(s)).toBe(true);
    });
  });
  it("rejects invalid status", () => {
    expect(isValidStatus("invalid")).toBe(false);
    expect(isValidStatus("")).toBe(false);
    expect(isValidStatus(null)).toBe(false);
  });
});

describe("isValidStatusTransition", () => {
  it("allows same-status (no-op)", () => {
    REMINDER_STATUSES.forEach((s) => {
      expect(isValidStatusTransition(s, s)).toBe(true);
    });
  });

  it("pending -> in_progress", () => {
    expect(isValidStatusTransition("pending", "in_progress")).toBe(true);
  });
  it("pending -> completed", () => {
    expect(isValidStatusTransition("pending", "completed")).toBe(true);
  });
  it("pending -> snoozed", () => {
    expect(isValidStatusTransition("pending", "snoozed")).toBe(true);
  });

  it("in_progress -> completed", () => {
    expect(isValidStatusTransition("in_progress", "completed")).toBe(true);
  });
  it("in_progress -> snoozed", () => {
    expect(isValidStatusTransition("in_progress", "snoozed")).toBe(true);
  });
  it("in_progress -> pending", () => {
    expect(isValidStatusTransition("in_progress", "pending")).toBe(true);
  });

  it("completed -> pending (re-open)", () => {
    expect(isValidStatusTransition("completed", "pending")).toBe(true);
  });
  it("completed -> in_progress is INVALID", () => {
    expect(isValidStatusTransition("completed", "in_progress")).toBe(false);
  });
  it("completed -> snoozed is INVALID", () => {
    expect(isValidStatusTransition("completed", "snoozed")).toBe(false);
  });

  it("snoozed -> pending", () => {
    expect(isValidStatusTransition("snoozed", "pending")).toBe(true);
  });
  it("snoozed -> in_progress", () => {
    expect(isValidStatusTransition("snoozed", "in_progress")).toBe(true);
  });
  it("snoozed -> completed is INVALID", () => {
    expect(isValidStatusTransition("snoozed", "completed")).toBe(false);
  });

  it("rejects invalid from-status", () => {
    expect(isValidStatusTransition("bogus", "pending")).toBe(false);
  });
  it("rejects invalid to-status", () => {
    expect(isValidStatusTransition("pending", "bogus")).toBe(false);
  });
});

describe("deriveStatusFromCompleted", () => {
  it("true -> completed", () => {
    expect(deriveStatusFromCompleted(true)).toBe("completed");
  });
  it("false -> pending", () => {
    expect(deriveStatusFromCompleted(false)).toBe("pending");
  });
});

describe("deriveCompletedFromStatus", () => {
  it("completed -> true", () => {
    expect(deriveCompletedFromStatus("completed")).toBe(true);
  });
  it("other statuses -> false", () => {
    expect(deriveCompletedFromStatus("pending")).toBe(false);
    expect(deriveCompletedFromStatus("in_progress")).toBe(false);
    expect(deriveCompletedFromStatus("snoozed")).toBe(false);
  });
});

// ============================================
// Duration Validation
// ============================================
describe("validateDuration", () => {
  it("accepts null/undefined (optional)", () => {
    expect(validateDuration(null).isValid).toBe(true);
    expect(validateDuration(undefined).isValid).toBe(true);
  });
  it("accepts 0", () => {
    expect(validateDuration(0).isValid).toBe(true);
  });
  it("accepts valid values", () => {
    expect(validateDuration(30).isValid).toBe(true);
    expect(validateDuration(1440).isValid).toBe(true);
  });
  it("rejects negative", () => {
    expect(validateDuration(-1).isValid).toBe(false);
  });
  it("rejects over 1440", () => {
    expect(validateDuration(1441).isValid).toBe(false);
  });
  it("rejects non-number", () => {
    expect(validateDuration("30").isValid).toBe(false);
    expect(validateDuration(NaN).isValid).toBe(false);
  });
});

describe("formatDuration", () => {
  it("returns empty for 0 or null", () => {
    expect(formatDuration(0)).toBe("");
    expect(formatDuration(null)).toBe("");
  });
  it("formats minutes", () => {
    expect(formatDuration(45)).toBe("45 min");
  });
  it("formats exact hours", () => {
    expect(formatDuration(60)).toBe("1 hour");
    expect(formatDuration(120)).toBe("2 hours");
  });
  it("formats hours + minutes", () => {
    expect(formatDuration(90)).toBe("1h 30m");
  });
});

describe("calculateEndTime", () => {
  it("adds duration correctly", () => {
    const start = new Date("2024-01-01T10:00:00Z");
    const end = calculateEndTime(start, 90);
    expect(end.toISOString()).toBe("2024-01-01T11:30:00.000Z");
  });
});

describe("hasTimeOverlap", () => {
  it("detects overlap", () => {
    const s1 = new Date("2024-01-01T10:00:00Z");
    const s2 = new Date("2024-01-01T10:30:00Z");
    expect(hasTimeOverlap(s1, 60, s2, 60)).toBe(true);
  });
  it("no overlap if sequential", () => {
    const s1 = new Date("2024-01-01T10:00:00Z");
    const s2 = new Date("2024-01-01T11:00:00Z");
    expect(hasTimeOverlap(s1, 60, s2, 60)).toBe(false);
  });
  it("exact adjacency = no overlap", () => {
    const s1 = new Date("2024-01-01T10:00:00Z");
    const s2 = new Date("2024-01-01T10:30:00Z");
    expect(hasTimeOverlap(s1, 30, s2, 30)).toBe(false);
  });
});
