/**
 * Tests for fetchReminderList — pure async function imported from useReminderList.
 *
 * Per CLAUDE.md hook pattern: extract the fetch body to a module-level async
 * function so vitest can exercise it without rendering React.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { fetchReminderList } = await import("@/hooks/useReminderList.js");

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe("fetchReminderList", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves to data array when response is 200 and success=true", async () => {
    const data = [{ id: "a", title: "Task A" }];
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data }));

    await expect(fetchReminderList()).resolves.toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith("/api/reminders");
  });

  it("throws 'Failed to fetch reminders' on 500 status", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(fetchReminderList()).rejects.toThrow("Failed to fetch reminders");
  });

  it("throws server-provided error when success=false with error field", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: "Reason" }),
    );

    await expect(fetchReminderList()).rejects.toThrow("Reason");
  });

  it("throws fallback message when success=false with no error message", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false }));

    await expect(fetchReminderList()).rejects.toThrow("Failed to fetch reminders");
  });
});
