// tests/unit/ai/sanitizeExtractedTasks.test.js
import { describe, it, expect } from "vitest";
import { sanitizeExtractedTasks } from "@/lib/ai/extract-tasks-helpers.js";

describe("sanitizeExtractedTasks", () => {
  describe("invalid inputs", () => {
    it("returns [] for a non-array input", () => {
      expect(sanitizeExtractedTasks(null)).toEqual([]);
      expect(sanitizeExtractedTasks(undefined)).toEqual([]);
      expect(sanitizeExtractedTasks("string")).toEqual([]);
      expect(sanitizeExtractedTasks({ title: "x" })).toEqual([]);
    });

    it("drops tasks missing a string title", () => {
      const tasks = [
        { title: "Keep me", tags: [] },
        { tags: [] },
        { title: 42, tags: [] },
        { title: null, tags: [] },
      ];
      expect(sanitizeExtractedTasks(tasks)).toHaveLength(1);
      expect(sanitizeExtractedTasks(tasks)[0].title).toBe("Keep me");
    });

    it("trims surrounding whitespace from the title", () => {
      const result = sanitizeExtractedTasks([
        { title: "  Buy milk  ", tags: [] },
      ]);
      expect(result[0].title).toBe("Buy milk");
    });
  });

  describe("priority normalization", () => {
    it("preserves the priority when it is a known value", () => {
      const result = sanitizeExtractedTasks([
        { title: "A", priority: "high", tags: [] },
        { title: "B", priority: "low", tags: [] },
      ]);
      expect(result[0].priority).toBe("high");
      expect(result[1].priority).toBe("low");
    });

    it("falls back to 'medium' for unknown priority", () => {
      const result = sanitizeExtractedTasks([
        { title: "A", priority: "URGENT", tags: [] },
        { title: "B", priority: null, tags: [] },
      ]);
      expect(result[0].priority).toBe("medium");
      expect(result[1].priority).toBe("medium");
    });
  });

  describe("dateTime passthrough", () => {
    it("preserves a string dateTime", () => {
      const result = sanitizeExtractedTasks([
        { title: "A", dateTime: "2026-04-08T09:00", tags: [] },
      ]);
      expect(result[0].dateTime).toBe("2026-04-08T09:00");
    });

    it("nulls a non-string dateTime", () => {
      const result = sanitizeExtractedTasks([
        { title: "A", dateTime: 12345, tags: [] },
        { title: "B", dateTime: null, tags: [] },
        { title: "C", tags: [] },
      ]);
      expect(result[0].dateTime).toBeNull();
      expect(result[1].dateTime).toBeNull();
      expect(result[2].dateTime).toBeNull();
    });
  });

  describe("tag normalization matches canonical normalizeTags", () => {
    it("converts internal whitespace to hyphens (matching server storage)", () => {
      const result = sanitizeExtractedTasks([
        { title: "A", tags: ["front end"] },
      ]);
      // canonical normalizeTag turns "front end" into "front-end"; the previous
      // ad-hoc `.toLowerCase().trim()` would have left it as "front end".
      expect(result[0].tags).toEqual(["front-end"]);
    });

    it("lowercases tags and strips a leading #", () => {
      const result = sanitizeExtractedTasks([
        { title: "A", tags: ["#Work"] },
      ]);
      expect(result[0].tags).toEqual(["work"]);
    });

    it("dedupes case-insensitively", () => {
      const result = sanitizeExtractedTasks([
        { title: "A", tags: ["Work", "WORK", "work"] },
      ]);
      expect(result[0].tags).toEqual(["work"]);
    });

    it("drops tags that normalize to fewer than 2 chars", () => {
      const result = sanitizeExtractedTasks([
        { title: "A", tags: ["a", "ok", "!"] },
      ]);
      expect(result[0].tags).toEqual(["ok"]);
    });

    it("returns an empty array when tags is missing or not an array", () => {
      const result = sanitizeExtractedTasks([
        { title: "A" },
        { title: "B", tags: "not-an-array" },
      ]);
      expect(result[0].tags).toEqual([]);
      expect(result[1].tags).toEqual([]);
    });
  });
});
