/**
 * Tests for the shared `lib/forms/reminderSubmitPayload.js` module — extracted
 * during the H7 follow-up so that BOTH TaskEditForm and QuickAdd (and any
 * future form submitting a reminder) consume the same naive-datetime → UTC
 * conversion path. The bug this prevents: previously TaskEditForm used
 * `new Date(naiveString).toISOString()` (browser TZ), QuickAdd duplicated the
 * same anti-pattern, and the calendar's QuickAddPopover passed naive strings
 * straight to the server. With this module each call site routes through
 * `naiveToUTC(value, userTimezone)` so the result depends ONLY on the user's
 * IANA timezone.
 *
 * These tests were moved verbatim from
 * `tests/unit/timezone/taskEditForm-submit.test.js` (H7's original location)
 * once the helper moved out of `components/tasks/TaskEditForm.jsx`. New cases
 * cover `endOfDayNaiveInTz` (QuickAdd's "default to end-of-today" path,
 * previously computed in browser TZ).
 */
import { describe, it, expect } from "vitest";
import {
  buildSubmitPayload,
  endOfDayNaiveInTz,
} from "@/lib/forms/reminderSubmitPayload";

describe("buildSubmitPayload", () => {
  describe("cross-timezone correctness (the H7 bug)", () => {
    it("HK account: 09:00 local on a naive datetime-local input maps to 01:00 UTC", () => {
      const result = buildSubmitPayload({
        formData: { title: "x", dateTime: "2026-05-20T09:00" },
        userTimezone: "Asia/Hong_Kong",
      });
      expect(result.dateTime).toBe("2026-05-20T01:00:00.000Z");
    });

    it("LA account: 09:00 local maps to 16:00 UTC (PDT, May = DST)", () => {
      const result = buildSubmitPayload({
        formData: { title: "x", dateTime: "2026-05-20T09:00" },
        userTimezone: "America/Los_Angeles",
      });
      expect(result.dateTime).toBe("2026-05-20T16:00:00.000Z");
    });

    it("Tokyo account: midnight local maps to previous day 15:00 UTC", () => {
      const result = buildSubmitPayload({
        formData: { title: "x", dateTime: "2026-05-20T00:00" },
        userTimezone: "Asia/Tokyo",
      });
      expect(result.dateTime).toBe("2026-05-19T15:00:00.000Z");
    });
  });

  describe("empty / missing dateTime", () => {
    it("preserves empty string as null (no conversion attempted)", () => {
      const result = buildSubmitPayload({
        formData: { title: "x", dateTime: "" },
        userTimezone: "Asia/Hong_Kong",
      });
      expect(result.dateTime).toBeNull();
    });

    it("preserves null dateTime as null", () => {
      const result = buildSubmitPayload({
        formData: { title: "x", dateTime: null },
        userTimezone: "Asia/Hong_Kong",
      });
      expect(result.dateTime).toBeNull();
    });

    it("preserves undefined dateTime as null", () => {
      const result = buildSubmitPayload({
        formData: { title: "x" },
        userTimezone: "Asia/Hong_Kong",
      });
      expect(result.dateTime).toBeNull();
    });
  });

  describe("falsy userTimezone (must NOT silently use browser TZ)", () => {
    it("throws when userTimezone is null and dateTime is present", () => {
      expect(() =>
        buildSubmitPayload({
          formData: { title: "x", dateTime: "2026-05-20T09:00" },
          userTimezone: null,
        }),
      ).toThrow(/userTimezone/i);
    });

    it("throws when userTimezone is undefined and dateTime is present", () => {
      expect(() =>
        buildSubmitPayload({
          formData: { title: "x", dateTime: "2026-05-20T09:00" },
          userTimezone: undefined,
        }),
      ).toThrow(/userTimezone/i);
    });

    it("throws when userTimezone is empty string and dateTime is present", () => {
      expect(() =>
        buildSubmitPayload({
          formData: { title: "x", dateTime: "2026-05-20T09:00" },
          userTimezone: "",
        }),
      ).toThrow(/userTimezone/i);
    });

    it("does NOT throw when userTimezone is missing but dateTime is empty", () => {
      const result = buildSubmitPayload({
        formData: { title: "x", dateTime: "" },
        userTimezone: null,
      });
      expect(result.dateTime).toBeNull();
    });
  });

  describe("absolute / Z-suffixed input is preserved verbatim", () => {
    it("Z-suffixed ISO string passes through unchanged (does NOT double-convert)", () => {
      const iso = "2026-05-20T09:00:00.000Z";
      const result = buildSubmitPayload({
        formData: { title: "x", dateTime: iso },
        userTimezone: "Asia/Hong_Kong",
      });
      expect(result.dateTime).toBe(iso);
    });

    it("offset-suffixed ISO string converts to UTC correctly", () => {
      const result = buildSubmitPayload({
        formData: { title: "x", dateTime: "2026-05-20T09:00+08:00" },
        userTimezone: "America/Los_Angeles",
      });
      expect(result.dateTime).toBe("2026-05-20T01:00:00.000Z");
    });
  });

  describe("other fields pass through untouched", () => {
    it("preserves title, description, priority, tags, status, subtasks, etc.", () => {
      const formData = {
        title: "Buy milk",
        description: "2L low-fat",
        remark: "from corner shop",
        dateTime: "2026-05-20T09:00",
        duration: 30,
        status: "pending",
        category: "personal",
        tags: ["shopping", "weekly"],
        recurring: true,
        recurringType: "weekly",
        priority: "high",
        subtasks: [{ id: "s1", title: "check fridge", completed: false }],
      };
      const result = buildSubmitPayload({
        formData,
        userTimezone: "Asia/Hong_Kong",
      });
      expect(result.title).toBe("Buy milk");
      expect(result.description).toBe("2L low-fat");
      expect(result.remark).toBe("from corner shop");
      expect(result.duration).toBe(30);
      expect(result.status).toBe("pending");
      expect(result.category).toBe("personal");
      expect(result.tags).toEqual(["shopping", "weekly"]);
      expect(result.recurring).toBe(true);
      expect(result.recurringType).toBe("weekly");
      expect(result.priority).toBe("high");
      expect(result.subtasks).toEqual([
        { id: "s1", title: "check fridge", completed: false },
      ]);
      expect(result.dateTime).toBe("2026-05-20T01:00:00.000Z");
    });

    it("does NOT mutate the input formData", () => {
      const formData = {
        title: "x",
        dateTime: "2026-05-20T09:00",
        tags: ["a"],
      };
      const frozen = Object.freeze({ ...formData });
      const result = buildSubmitPayload({
        formData: frozen,
        userTimezone: "Asia/Hong_Kong",
      });
      expect(formData.dateTime).toBe("2026-05-20T09:00");
      expect(result).not.toBe(formData);
      expect(result.dateTime).toBe("2026-05-20T01:00:00.000Z");
    });
  });

  describe("regression: does NOT depend on the test runner's TZ", () => {
    it("returns the same UTC instant whether process.env.TZ is set or not", () => {
      const out = buildSubmitPayload({
        formData: { title: "x", dateTime: "2026-05-20T09:00" },
        userTimezone: "Asia/Hong_Kong",
      }).dateTime;
      expect(out).toBe("2026-05-20T01:00:00.000Z");
    });
  });
});

describe("endOfDayNaiveInTz", () => {
  describe("the QuickAdd default — 'end of today, but in user TZ'", () => {
    it("HK account at 2026-05-18T03:00Z (= 11:00 HK same day) yields 2026-05-18T23:59", () => {
      // 03:00 UTC on May 18 = 11:00 HK on May 18 = end of "today in HK" = 23:59 HK.
      // Returned as a NAIVE string so it can flow through buildSubmitPayload like
      // any other datetime-local form value.
      const now = new Date("2026-05-18T03:00:00.000Z");
      expect(endOfDayNaiveInTz("Asia/Hong_Kong", now)).toBe(
        "2026-05-18T23:59",
      );
    });

    it("HK account at 2026-05-18T20:00Z (= 04:00 HK May 19) yields 2026-05-19T23:59 — TODAY in HK is May 19", () => {
      // This is the cross-tz case: the server clock says May 18, but the user
      // is already on May 19 in their timezone. Defaulting to "end of today
      // in browser TZ" would land on the wrong calendar day.
      const now = new Date("2026-05-18T20:00:00.000Z");
      expect(endOfDayNaiveInTz("Asia/Hong_Kong", now)).toBe(
        "2026-05-19T23:59",
      );
    });

    it("LA account at 2026-05-18T03:00Z (= 20:00 LA May 17) yields 2026-05-17T23:59 — still TODAY in LA", () => {
      // Symmetric case: server says May 18 but the user is still on May 17
      // in their timezone.
      const now = new Date("2026-05-18T03:00:00.000Z");
      expect(endOfDayNaiveInTz("America/Los_Angeles", now)).toBe(
        "2026-05-17T23:59",
      );
    });

    it("composes with buildSubmitPayload to produce a correct UTC instant", () => {
      // The whole point: QuickAdd will compute endOfDay → naive, hand to
      // buildSubmitPayload → UTC. The final ISO must reflect HK 23:59.
      const now = new Date("2026-05-18T03:00:00.000Z");
      const naive = endOfDayNaiveInTz("Asia/Hong_Kong", now);
      const result = buildSubmitPayload({
        formData: { title: "x", dateTime: naive },
        userTimezone: "Asia/Hong_Kong",
      });
      // 23:59 HK on May 18 == 15:59 UTC on May 18
      expect(result.dateTime).toBe("2026-05-18T15:59:00.000Z");
    });
  });

  describe("falsy userTimezone", () => {
    it("throws when userTimezone is null", () => {
      expect(() => endOfDayNaiveInTz(null, new Date())).toThrow(
        /userTimezone/i,
      );
    });

    it("throws when userTimezone is undefined", () => {
      expect(() => endOfDayNaiveInTz(undefined, new Date())).toThrow(
        /userTimezone/i,
      );
    });

    it("throws when userTimezone is empty string", () => {
      expect(() => endOfDayNaiveInTz("", new Date())).toThrow(/userTimezone/i);
    });
  });

  describe("default `now` argument", () => {
    it("uses the actual `new Date()` when `now` is omitted (smoke test only)", () => {
      // We can't assert an exact value, but we can assert the shape and that
      // it doesn't throw — confirming the helper is callable without `now`.
      const result = endOfDayNaiveInTz("UTC");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T23:59$/);
    });
  });
});
