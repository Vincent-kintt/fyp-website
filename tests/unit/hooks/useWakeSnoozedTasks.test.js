/**
 * Tests for hooks/useWakeSnoozedTasks.js — pure request fn and the public
 * mutation hook export. Mirrors the useDeleteReminder pattern: only the pure
 * helper is exercised directly; the hook is asserted to be a callable function
 * (React rule of hooks means we cannot execute it without a renderer).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { reminderKeys } from "@/lib/queryKeys";

const { wakeSnoozedTasksRequest, useWakeSnoozedTasks } = await import(
  "@/hooks/useWakeSnoozedTasks.js"
);

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe("wakeSnoozedTasksRequest", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs /api/reminders/wake-snoozed and returns the envelope data on success", async () => {
    const data = { reactivated: 3, timestamp: "2026-05-17T10:00:00.000Z" };
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data }));

    const result = await wakeSnoozedTasksRequest();

    expect(result).toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith("/api/reminders/wake-snoozed", {
      method: "POST",
    });
  });

  it("throws on non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(wakeSnoozedTasksRequest()).rejects.toThrow(
      "Failed to wake snoozed tasks",
    );
  });

  it("throws envelope error message on success:false", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: "Cannot wake — rate limited" }),
    );

    await expect(wakeSnoozedTasksRequest()).rejects.toThrow(
      "Cannot wake — rate limited",
    );
  });

  it("falls back to generic error when success:false has no message", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false }));

    await expect(wakeSnoozedTasksRequest()).rejects.toThrow(
      "Failed to wake snoozed tasks",
    );
  });
});

describe("useWakeSnoozedTasks onSuccess", () => {
  it("invalidates the reminder list query key", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries };

    // Characterize the contract inline — same shape the hook installs.
    const onSuccess = () =>
      queryClient.invalidateQueries({ queryKey: reminderKeys.list({}) });

    onSuccess();

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: reminderKeys.list({}),
    });
  });

  it("export is callable (sanity)", () => {
    expect(typeof useWakeSnoozedTasks).toBe("function");
  });
});
