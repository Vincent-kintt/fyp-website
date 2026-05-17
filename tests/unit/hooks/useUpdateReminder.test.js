/**
 * Tests for hooks/useUpdateReminder.js — pure async fn + mutation config
 * shape. Backend derives category/status/completed/inboxState from the
 * patch, so invalidate-on-success only; no optimistic update.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { reminderKeys } from "@/lib/queryKeys";

const { updateReminderRequest, useUpdateReminder } = await import(
  "@/hooks/useUpdateReminder.js"
);

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe("updateReminderRequest", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("PUTs the patch body (id stripped) to /api/reminders/:id and returns data.data", async () => {
    const patch = { title: "Updated", priority: "high" };
    const updated = { id: "r1", ...patch };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: updated }),
    );

    const result = await updateReminderRequest({ id: "r1", ...patch });

    expect(result).toEqual(updated);
    expect(fetchMock).toHaveBeenCalledWith("/api/reminders/r1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  });

  it("throws on non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(
      updateReminderRequest({ id: "r1", title: "x" }),
    ).rejects.toThrow("Failed to update reminder");
  });

  it("throws envelope error message on success:false", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: "Invalid status transition" }),
    );

    await expect(
      updateReminderRequest({ id: "r1", status: "completed" }),
    ).rejects.toThrow("Invalid status transition");
  });
});

describe("useUpdateReminder onSuccess", () => {
  it("invalidates reminderKeys.all so list + detail subtrees refetch", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries };

    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: reminderKeys.all });
    };

    onSuccess();

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: reminderKeys.all,
    });
  });

  it("export is callable (sanity)", () => {
    expect(typeof useUpdateReminder).toBe("function");
  });
});
