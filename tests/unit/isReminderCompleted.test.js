/**
 * Tests for isReminderCompleted helper — consolidates the duplicated
 * `reminder.status === "completed" || reminder.completed` expression that
 * lived in calendar components.
 *
 * The helper accepts either the persisted shape (`status: "completed"` after
 * formatReminder) or the optimistic-update shape (`completed: true` set in
 * hooks before status syncs). It uses strict `=== true` on the completed
 * boolean so coerced values (1, "true") do not mask bugs.
 */
import { describe, it, expect } from "vitest";
import { isReminderCompleted } from "@/lib/utils.js";

describe("isReminderCompleted", () => {
  it("returns true when status is 'completed'", () => {
    expect(isReminderCompleted({ status: "completed", completed: false })).toBe(
      true,
    );
  });

  it("returns true when status is 'completed' regardless of completed flag", () => {
    expect(isReminderCompleted({ status: "completed" })).toBe(true);
  });

  it("returns true for optimistic update shape (completed=true only)", () => {
    expect(isReminderCompleted({ status: "pending", completed: true })).toBe(
      true,
    );
  });

  it("returns false for pending with completed=false", () => {
    expect(isReminderCompleted({ status: "pending", completed: false })).toBe(
      false,
    );
  });

  it("returns false for snoozed status", () => {
    expect(isReminderCompleted({ status: "snoozed", completed: false })).toBe(
      false,
    );
  });

  it("returns false for empty object", () => {
    expect(isReminderCompleted({})).toBe(false);
  });

  it("returns false for undefined input (null-safe)", () => {
    expect(isReminderCompleted(undefined)).toBe(false);
  });

  it("returns false for null input (null-safe)", () => {
    expect(isReminderCompleted(null)).toBe(false);
  });

  it("returns false for numeric truthy completed (strict === true)", () => {
    expect(isReminderCompleted({ status: "pending", completed: 1 })).toBe(
      false,
    );
  });

  it("returns false for string 'true' on completed (strict === true)", () => {
    expect(isReminderCompleted({ status: "pending", completed: "true" })).toBe(
      false,
    );
  });
});
