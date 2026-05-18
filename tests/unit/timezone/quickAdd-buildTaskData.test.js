/**
 * Tests for QuickAdd's module-level `buildTaskData` helper — the pure
 * derivation that turns (parsedData, inputText, manualDate, manualTime,
 * userTimezone, now) into the POST /api/reminders payload.
 *
 * H7 follow-up: the previous implementation interpreted naive datetime
 * strings (both the manual override and the "end of today" default) in the
 * BROWSER's system timezone via `new Date(naiveString).toISOString()`. For a
 * Hong Kong user editing on a Mac set to LA, this saved reminders up to 16
 * hours off the intended HK wall time AND defaulted "end of today" to the
 * wrong calendar day. Fix routes both paths through `naiveToUTC` with the
 * user's IANA timezone — same helper TaskEditForm and the AI write paths use.
 *
 * Pattern matches `executeBuildTaskData` / `executeDragEnd` style: pure,
 * module-level, dependency-injected for unit tests without rendering React.
 */
import { describe, it, expect } from "vitest";
import { buildTaskData } from "@/components/tasks/QuickAdd";

describe("QuickAdd.buildTaskData", () => {
  describe("manual date+time override (the H7 bug — convert via user TZ)", () => {
    it("HK account: manualDate + manualTime maps to UTC via Asia/Hong_Kong", () => {
      const out = buildTaskData({
        parsedData: null,
        inputText: "lunch",
        manualDate: "2026-05-20",
        manualTime: "12:30",
        userTimezone: "Asia/Hong_Kong",
      });
      // 12:30 HK = 04:30 UTC
      expect(out.dateTime).toBe("2026-05-20T04:30:00.000Z");
    });

    it("LA account: same manualDate+manualTime maps to a different UTC instant", () => {
      const out = buildTaskData({
        parsedData: null,
        inputText: "lunch",
        manualDate: "2026-05-20",
        manualTime: "12:30",
        userTimezone: "America/Los_Angeles",
      });
      // 12:30 LA (PDT, May = DST, UTC-7) = 19:30 UTC
      expect(out.dateTime).toBe("2026-05-20T19:30:00.000Z");
    });

    it("manualDate without manualTime defaults to 09:00 in user TZ", () => {
      const out = buildTaskData({
        parsedData: null,
        inputText: "morning task",
        manualDate: "2026-05-20",
        manualTime: "",
        userTimezone: "Asia/Hong_Kong",
      });
      // 09:00 HK = 01:00 UTC
      expect(out.dateTime).toBe("2026-05-20T01:00:00.000Z");
    });
  });

  describe("parsedData.dateTime (from parse-task API — always naive YYYY-MM-DDTHH:mm)", () => {
    it("converts parsedData.dateTime via user TZ", () => {
      const out = buildTaskData({
        parsedData: {
          title: "meeting",
          dateTime: "2026-05-20T15:00",
          tags: [],
          priority: "medium",
        },
        inputText: "meeting at 3pm",
        manualDate: "",
        manualTime: "",
        userTimezone: "Asia/Hong_Kong",
      });
      // 15:00 HK = 07:00 UTC
      expect(out.dateTime).toBe("2026-05-20T07:00:00.000Z");
    });

    it("manual override takes precedence over parsedData.dateTime", () => {
      const out = buildTaskData({
        parsedData: {
          title: "meeting",
          dateTime: "2026-05-20T15:00",
          tags: [],
          priority: "medium",
        },
        inputText: "meeting at 3pm",
        manualDate: "2026-05-25",
        manualTime: "10:00",
        userTimezone: "Asia/Hong_Kong",
      });
      // 10:00 HK on May 25 = 02:00 UTC on May 25
      expect(out.dateTime).toBe("2026-05-25T02:00:00.000Z");
    });
  });

  describe("default end-of-today (no parsed dateTime, no manual override)", () => {
    it("HK account at 03:00 UTC: end of today HK = 23:59 May 18 HK = 15:59 UTC", () => {
      const out = buildTaskData({
        parsedData: null,
        inputText: "buy milk",
        manualDate: "",
        manualTime: "",
        userTimezone: "Asia/Hong_Kong",
        now: new Date("2026-05-18T03:00:00.000Z"),
      });
      expect(out.dateTime).toBe("2026-05-18T15:59:00.000Z");
    });

    it("HK account at 20:00 UTC: 'today in HK' is already May 19 — default lands on May 19, not May 18", () => {
      // This is the calendar-day correctness case: server says May 18 but
      // 20:00 UTC is 04:00 May 19 HK. The old code would have defaulted to
      // 23:59 of "today in browser TZ" = LA May 18 (if browser is LA), which
      // is May 19 06:59 HK — slightly off-by-day in either direction. Correct
      // answer is 23:59 HK on May 19 = 15:59 UTC May 19.
      const out = buildTaskData({
        parsedData: null,
        inputText: "evening task",
        manualDate: "",
        manualTime: "",
        userTimezone: "Asia/Hong_Kong",
        now: new Date("2026-05-18T20:00:00.000Z"),
      });
      expect(out.dateTime).toBe("2026-05-19T15:59:00.000Z");
    });

    it("LA account at 03:00 UTC: still May 17 in LA — default lands on May 17", () => {
      // Symmetric case: server says May 18 but LA is still on May 17. End of
      // today LA = 23:59 May 17 LA (PDT, UTC-7) = 06:59 UTC May 18.
      const out = buildTaskData({
        parsedData: null,
        inputText: "task",
        manualDate: "",
        manualTime: "",
        userTimezone: "America/Los_Angeles",
        now: new Date("2026-05-18T03:00:00.000Z"),
      });
      expect(out.dateTime).toBe("2026-05-18T06:59:00.000Z");
    });
  });

  describe("pass-through fields (title, tags, priority, duration, status)", () => {
    it("uses parsedData.title when present, falls back to inputText", () => {
      const withParsed = buildTaskData({
        parsedData: {
          title: "Cleaned title",
          tags: [],
          priority: "medium",
        },
        inputText: "raw text with metadata",
        manualDate: "",
        manualTime: "",
        userTimezone: "Asia/Hong_Kong",
        now: new Date("2026-05-18T03:00:00.000Z"),
      });
      expect(withParsed.title).toBe("Cleaned title");

      const withoutParsed = buildTaskData({
        parsedData: null,
        inputText: "  raw text  ",
        manualDate: "",
        manualTime: "",
        userTimezone: "Asia/Hong_Kong",
        now: new Date("2026-05-18T03:00:00.000Z"),
      });
      expect(withoutParsed.title).toBe("raw text");
    });

    it("includes parsed tags/priority/duration; defaults priority=medium, status=pending", () => {
      const out = buildTaskData({
        parsedData: {
          title: "x",
          tags: ["work", "urgent"],
          priority: "high",
          duration: 45,
        },
        inputText: "x",
        manualDate: "",
        manualTime: "",
        userTimezone: "Asia/Hong_Kong",
        now: new Date("2026-05-18T03:00:00.000Z"),
      });
      expect(out.tags).toEqual(["work", "urgent"]);
      expect(out.priority).toBe("high");
      expect(out.duration).toBe(45);
      expect(out.status).toBe("pending");
    });

    it("defaults tags=[], priority=medium when parsedData absent", () => {
      const out = buildTaskData({
        parsedData: null,
        inputText: "x",
        manualDate: "",
        manualTime: "",
        userTimezone: "Asia/Hong_Kong",
        now: new Date("2026-05-18T03:00:00.000Z"),
      });
      expect(out.tags).toEqual([]);
      expect(out.priority).toBe("medium");
      expect(out.status).toBe("pending");
      expect(out.duration).toBeUndefined();
    });
  });

  describe("falsy userTimezone (must NOT silently use browser TZ)", () => {
    it("throws when userTimezone is null", () => {
      expect(() =>
        buildTaskData({
          parsedData: null,
          inputText: "x",
          manualDate: "",
          manualTime: "",
          userTimezone: null,
          now: new Date("2026-05-18T03:00:00.000Z"),
        }),
      ).toThrow(/userTimezone/i);
    });

    it("throws when userTimezone is empty string", () => {
      expect(() =>
        buildTaskData({
          parsedData: null,
          inputText: "x",
          manualDate: "2026-05-20",
          manualTime: "12:00",
          userTimezone: "",
          now: new Date("2026-05-18T03:00:00.000Z"),
        }),
      ).toThrow(/userTimezone/i);
    });
  });
});
