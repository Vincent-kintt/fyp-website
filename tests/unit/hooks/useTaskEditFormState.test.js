// Characterization tests for hooks/useTaskEditFormState.js — locks current
// behavior BEFORE the extraction. TaskEditForm previously kept this logic
// inline (lines 22–172 of the pre-refactor file); the hook moves it to a
// reusable module without changing semantics.
//
// We test the pure helpers directly (`buildFormDataFromReminder`,
// `applyAddTag`, `applyAddSubtask`, `applyRemoveTag`, `applyRemoveSubtask`,
// `applyHandleChange`) rather than running React. The reset-on-reminder
// useEffect is exercised indirectly: buildFormDataFromReminder is what the
// effect calls, and we lock its mapping here.
//
// Reset timing semantics (preserved verbatim from TaskEditForm):
//   - isActive=true && reminder set → rebuild form data
//   - isActive=false → DON'T touch form data (modal close-animation preserves
//     visible state across the 150ms exit transition)
//   - reminder=null && isActive=true → DON'T touch (no reminder to build from)

import { describe, it, expect, vi } from "vitest";
import {
  applyAddSubtask,
  applyAddTag,
  applyHandleChange,
  applyRemoveSubtask,
  applyRemoveTag,
  buildFormDataFromReminder,
  shouldResetFromReminder,
} from "@/hooks/useTaskEditFormState.js";

const EMPTY_FORM = {
  title: "",
  description: "",
  remark: "",
  dateTime: "",
  duration: null,
  status: "pending",
  category: "personal",
  tags: [],
  recurring: false,
  recurringType: "daily",
  priority: "medium",
  subtasks: [],
};

describe("buildFormDataFromReminder", () => {
  it("maps full reminder fields into form-data shape", () => {
    const reminder = {
      title: "Buy milk",
      description: "2L organic",
      remark: "note",
      // Use a Date string the constructor can parse — exact local rendering
      // depends on the test runner's TZ, but the shape is what we assert.
      dateTime: new Date(2026, 4, 18, 9, 0).toISOString(),
      duration: 30,
      status: "snoozed",
      category: "shopping",
      tags: ["urgent"],
      recurring: true,
      recurringType: "weekly",
      priority: "high",
      subtasks: [{ id: "st-1", title: "find brand", completed: false }],
    };
    const result = buildFormDataFromReminder(reminder);
    expect(result.title).toBe("Buy milk");
    expect(result.description).toBe("2L organic");
    expect(result.remark).toBe("note");
    expect(result.duration).toBe(30);
    expect(result.status).toBe("snoozed");
    expect(result.category).toBe("shopping");
    expect(result.tags).toEqual(["urgent"]);
    expect(result.recurring).toBe(true);
    expect(result.recurringType).toBe("weekly");
    expect(result.priority).toBe("high");
    expect(result.subtasks).toHaveLength(1);
    expect(result.dateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("falls back to EMPTY_FORM defaults for missing fields", () => {
    const result = buildFormDataFromReminder({});
    expect(result).toEqual(EMPTY_FORM);
  });

  it("preserves empty string for missing dateTime (not null) — matches input element", () => {
    const result = buildFormDataFromReminder({ title: "x" });
    expect(result.dateTime).toBe("");
  });
});

describe("shouldResetFromReminder", () => {
  it("returns true when reminder is truthy and isActive=true", () => {
    expect(shouldResetFromReminder({ id: "x" }, true)).toBe(true);
  });

  it("returns false when isActive=false (modal close-animation preserves prior state)", () => {
    expect(shouldResetFromReminder({ id: "x" }, false)).toBe(false);
  });

  it("returns false when reminder is null", () => {
    expect(shouldResetFromReminder(null, true)).toBe(false);
  });
});

describe("applyHandleChange", () => {
  it("writes string inputs by name", () => {
    const next = applyHandleChange(EMPTY_FORM, {
      name: "title",
      value: "New",
      type: "text",
    });
    expect(next.title).toBe("New");
  });

  it("writes checkbox values from `checked` not `value`", () => {
    const next = applyHandleChange(EMPTY_FORM, {
      name: "recurring",
      type: "checkbox",
      checked: true,
    });
    expect(next.recurring).toBe(true);
  });
});

describe("applyAddTag", () => {
  it("normalizes and appends new tags", () => {
    const next = applyAddTag(EMPTY_FORM, "Work");
    expect(next.tags).toEqual(["work"]);
  });

  it("rejects tags shorter than 2 chars (returns prev)", () => {
    const next = applyAddTag(EMPTY_FORM, "a");
    expect(next).toBe(EMPTY_FORM);
  });

  it("deduplicates already-present tags", () => {
    const base = { ...EMPTY_FORM, tags: ["work"] };
    const next = applyAddTag(base, "work");
    expect(next).toBe(base);
  });

  it("returns prev when tag is empty / whitespace", () => {
    expect(applyAddTag(EMPTY_FORM, "")).toBe(EMPTY_FORM);
    expect(applyAddTag(EMPTY_FORM, "  ")).toBe(EMPTY_FORM);
  });
});

describe("applyRemoveTag", () => {
  it("removes the matching tag", () => {
    const base = { ...EMPTY_FORM, tags: ["work", "urgent"] };
    const next = applyRemoveTag(base, "work");
    expect(next.tags).toEqual(["urgent"]);
  });
});

describe("applyAddSubtask", () => {
  it("trims and adds a subtask with a generated id", () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1700000000000);
    try {
      const next = applyAddSubtask(EMPTY_FORM, "  read book  ");
      expect(next.subtasks).toHaveLength(1);
      expect(next.subtasks[0].title).toBe("read book");
      expect(next.subtasks[0].completed).toBe(false);
      expect(next.subtasks[0].id).toBe("st-1700000000000");
    } finally {
      now.mockRestore();
    }
  });

  it("returns prev when input is empty/whitespace", () => {
    expect(applyAddSubtask(EMPTY_FORM, "")).toBe(EMPTY_FORM);
    expect(applyAddSubtask(EMPTY_FORM, "   ")).toBe(EMPTY_FORM);
  });
});

describe("applyRemoveSubtask", () => {
  it("removes the subtask with the matching id", () => {
    const base = {
      ...EMPTY_FORM,
      subtasks: [
        { id: "a", title: "1", completed: false },
        { id: "b", title: "2", completed: false },
      ],
    };
    const next = applyRemoveSubtask(base, "a");
    expect(next.subtasks).toEqual([{ id: "b", title: "2", completed: false }]);
  });
});
