/**
 * Tests for TaskEditForm's buildSubmitPayload helper (H7).
 *
 * The previous TaskEditForm submit path did:
 *   submitData.dateTime = new Date(naiveString).toISOString();
 * which interprets the naive datetime-local form value in the BROWSER's
 * system timezone — wrong when the user's account TZ differs from the
 * machine they're physically using (e.g. HK account on a Mac set to LA).
 *
 * The fix routes the conversion through naiveToUTC(value, userTimezone),
 * the same helper the AI write paths use, so the result depends ONLY on
 * the user's IANA timezone — never on the test runner's / browser's TZ.
 */
import { describe, it, expect, vi } from "vitest";
import { buildSubmitPayload } from "@/components/tasks/TaskEditForm";

describe("buildSubmitPayload", () => {
  describe("cross-timezone correctness (the H7 bug)", () => {
    it("HK account: 09:00 local on a naive datetime-local input maps to 01:00 UTC", () => {
      // 2026-05-20 09:00 in Asia/Hong_Kong (UTC+8) = 2026-05-20 01:00 UTC
      // This MUST hold regardless of the test runner's TZ — that's the whole point.
      const result = buildSubmitPayload({
        formData: { title: "x", dateTime: "2026-05-20T09:00" },
        userTimezone: "Asia/Hong_Kong",
      });
      expect(result.dateTime).toBe("2026-05-20T01:00:00.000Z");
    });

    it("LA account: 09:00 local maps to 16:00 UTC (PDT, May = DST)", () => {
      // 2026-05-20 09:00 in America/Los_Angeles (PDT = UTC-7) = 2026-05-20 16:00 UTC
      const result = buildSubmitPayload({
        formData: { title: "x", dateTime: "2026-05-20T09:00" },
        userTimezone: "America/Los_Angeles",
      });
      expect(result.dateTime).toBe("2026-05-20T16:00:00.000Z");
    });

    it("Tokyo account: midnight local maps to previous day 15:00 UTC", () => {
      // 2026-05-20 00:00 in Asia/Tokyo (UTC+9) = 2026-05-19 15:00 UTC
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
      // Caller drops dateTime entirely for inbox-state reminders — null is
      // the canonical "no scheduled time" marker on the wire.
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
        formData: { title: "x" }, // dateTime field omitted
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

    it("does NOT throw when userTimezone is missing but dateTime is empty (no conversion needed)", () => {
      // Edge case: inbox reminders with no time. Helper has nothing to convert,
      // so missing timezone is harmless.
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
      // naiveToUTC detects the Z and parses as absolute; we just toISOString().
      expect(result.dateTime).toBe(iso);
    });

    it("offset-suffixed ISO string converts to UTC correctly", () => {
      // "2026-05-20T09:00+08:00" === "2026-05-20T01:00:00.000Z"
      const result = buildSubmitPayload({
        formData: { title: "x", dateTime: "2026-05-20T09:00+08:00" },
        userTimezone: "America/Los_Angeles", // userTimezone is irrelevant — input has explicit offset
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
      // input untouched
      expect(formData.dateTime).toBe("2026-05-20T09:00");
      // result is a new object
      expect(result).not.toBe(formData);
      expect(result.dateTime).toBe("2026-05-20T01:00:00.000Z");
    });
  });

  describe("regression: does NOT depend on the test runner's TZ", () => {
    it("returns the same UTC instant whether process.env.TZ is set or not", () => {
      // We can't actually swap process.env.TZ inside a single test (Node caches it),
      // but we can verify the result matches an Intl.DateTimeFormat-based calculation
      // rather than a Date-constructor-based one (which would vary).
      const out = buildSubmitPayload({
        formData: { title: "x", dateTime: "2026-05-20T09:00" },
        userTimezone: "Asia/Hong_Kong",
      }).dateTime;
      // Independent computation: 09:00 HK = 01:00 UTC, period.
      expect(out).toBe("2026-05-20T01:00:00.000Z");
      // Sanity: if we had used `new Date(naiveString).toISOString()` (the bug),
      // the result would depend on the runner's TZ and would equal:
      //   new Date("2026-05-20T09:00").toISOString()
      // which is "2026-05-20T01:00:00.000Z" ONLY when the runner is UTC+8 — and
      // differs by hours otherwise. We assert exact equality to the correct
      // value, so any TZ-dependent regression in the helper trips this test
      // on the CI runner (typically UTC) or on a developer's local machine.
    });
  });
});
