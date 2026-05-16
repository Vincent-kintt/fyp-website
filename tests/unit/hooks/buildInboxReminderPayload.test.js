/**
 * Tests for buildInboxReminderPayload — pure helper that shapes the body
 * the inbox page sends when confirming an extracted task. Extracted so the
 * critical inboxState branching is covered without rendering the inbox UI.
 */

import { describe, it, expect } from "vitest";

const { buildInboxReminderPayload } = await import(
  "@/lib/inbox/buildInboxReminderPayload.js"
);

describe("buildInboxReminderPayload", () => {
  it("maps a task with a dateTime to inboxState=processed", () => {
    const task = {
      title: "Email client",
      dateTime: "2026-05-20T10:00:00Z",
      priority: "high",
      tags: ["work"],
    };

    expect(buildInboxReminderPayload(task)).toEqual({
      title: "Email client",
      dateTime: "2026-05-20T10:00:00Z",
      priority: "high",
      tags: ["work"],
      inboxState: "processed",
    });
  });

  it("maps a task without dateTime to inboxState=inbox and dateTime=null", () => {
    const task = { title: "Buy milk" };

    expect(buildInboxReminderPayload(task)).toEqual({
      title: "Buy milk",
      dateTime: null,
      priority: "medium",
      tags: [],
      inboxState: "inbox",
    });
  });

  it("preserves explicit empty dateTime as missing (still inboxState=inbox)", () => {
    const task = { title: "Read book", dateTime: "" };

    expect(buildInboxReminderPayload(task).inboxState).toBe("inbox");
    expect(buildInboxReminderPayload(task).dateTime).toBeNull();
  });

  it("defaults priority to medium and tags to empty array", () => {
    const task = { title: "Task", dateTime: "2026-05-20T10:00:00Z" };
    const body = buildInboxReminderPayload(task);

    expect(body.priority).toBe("medium");
    expect(body.tags).toEqual([]);
  });
});
