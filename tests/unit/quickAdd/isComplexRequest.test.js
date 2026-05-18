/**
 * Tests for `isComplexRequest` — pure predicate that decides whether a
 * QuickAdd input should bypass NLP parsing and escalate to the AI modal.
 *
 * Extraction lets us list each keyword in the pattern as a dedicated case
 * and surfaces the pattern list itself for future localization.
 */

import { describe, it, expect } from "vitest";
import {
  isComplexRequest,
  COMPLEX_PATTERNS,
} from "@/lib/quickAdd/isComplexRequest.js";

const KEYWORDS = [
  "plan",
  "reschedule",
  "move all",
  "help me",
  "check conflicts",
  "reorganize",
  "analyze",
  "summarize",
  "review",
  "suggest",
];

describe("isComplexRequest", () => {
  it("exports COMPLEX_PATTERNS as a RegExp", () => {
    expect(COMPLEX_PATTERNS).toBeInstanceOf(RegExp);
  });

  it.each(KEYWORDS)("returns true when input contains keyword %s", (kw) => {
    // sentence-cased usage that matches the word-boundary anchored regex
    const sentence = `please ${kw} my tasks`;
    expect(isComplexRequest(sentence)).toBe(true);
  });

  it("matches keywords case-insensitively", () => {
    expect(isComplexRequest("Please PLAN my week")).toBe(true);
    expect(isComplexRequest("Summarize today")).toBe(true);
  });

  it("returns true for inputs longer than 80 characters even without keywords", () => {
    const text = "x".repeat(81); // 81 chars, no keyword
    expect(isComplexRequest(text)).toBe(true);
  });

  it("returns true at the length boundary > 80 (81 chars)", () => {
    expect(isComplexRequest("a".repeat(81))).toBe(true);
  });

  it("returns false for short normal inputs without keywords", () => {
    expect(isComplexRequest("buy milk")).toBe(false);
    expect(isComplexRequest("call mom at 5pm")).toBe(false);
  });

  it("returns false for exactly 80 characters without keywords", () => {
    expect(isComplexRequest("a".repeat(80))).toBe(false);
  });

  it("does not match keyword substrings inside other words (word boundary)", () => {
    // "planet" should NOT match "plan" because of the \b word boundary.
    expect(isComplexRequest("planet rotation")).toBe(false);
    // "reviewer" SHOULD match because `review` is followed by a word char,
    // but `\b(review)\b` only matches whole words → "reviewer" should NOT match
    expect(isComplexRequest("reviewer notes")).toBe(false);
  });
});
