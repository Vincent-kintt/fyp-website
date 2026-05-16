// tests/unit/tasks/addTagToList.test.js
import { describe, it, expect } from "vitest";
import { addTagToList } from "@/lib/tasks/addTagToList.js";

describe("addTagToList", () => {
  describe("invalid input -> null (caller no-ops)", () => {
    it("returns null for empty string", () => {
      expect(addTagToList("", [])).toBeNull();
    });

    it("returns null for whitespace-only input", () => {
      expect(addTagToList("   ", [])).toBeNull();
    });

    it("returns null when normalization yields fewer than 2 chars", () => {
      expect(addTagToList("a", [])).toBeNull();
    });

    it("returns null when all characters are stripped by normalizeTag", () => {
      expect(addTagToList("!!", [])).toBeNull();
    });

    it("returns null for non-string input", () => {
      expect(addTagToList(undefined, [])).toBeNull();
      expect(addTagToList(null, [])).toBeNull();
    });
  });

  describe("normalization matches server normalizeTag", () => {
    it("trims surrounding whitespace and lowercases", () => {
      expect(addTagToList(" abc ", [])).toEqual(["abc"]);
    });

    it("strips leading # marker", () => {
      expect(addTagToList("#work", [])).toEqual(["work"]);
    });

    it("case-folds to lowercase", () => {
      expect(addTagToList("Work", [])).toEqual(["work"]);
    });

    it("converts internal whitespace to single hyphen", () => {
      expect(addTagToList("front end", [])).toEqual(["front-end"]);
    });

    it("drops disallowed special chars (no leftover hyphens)", () => {
      // "a!b" -> 'a' + dropped '!' + 'b' = "ab" per normalizeTag
      expect(addTagToList("a!b", [])).toEqual(["ab"]);
    });

    it("truncates to 30 characters", () => {
      const long = "a".repeat(50);
      const result = addTagToList(long, []);
      expect(result).toEqual(["a".repeat(30)]);
    });
  });

  describe("dedupe behavior", () => {
    it("returns the existing list unchanged when tag already present", () => {
      const existing = ["abc"];
      const result = addTagToList("abc", existing);
      expect(result).toBe(existing); // same reference -> caller can detect duplicate
    });

    it("dedupes case-insensitively against existing", () => {
      const existing = ["work"];
      const result = addTagToList("Work", existing);
      expect(result).toBe(existing);
    });

    it("dedupes against the # prefix variant", () => {
      const existing = ["work"];
      const result = addTagToList("#work", existing);
      expect(result).toBe(existing);
    });
  });

  describe("appends to existing list", () => {
    it("appends a new normalized tag", () => {
      const existing = ["work"];
      const result = addTagToList("home", existing);
      expect(result).toEqual(["work", "home"]);
      expect(result).not.toBe(existing); // new array
    });

    it("treats undefined existingTags as empty list", () => {
      expect(addTagToList("abc")).toEqual(["abc"]);
    });
  });
});
