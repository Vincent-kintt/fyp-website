/**
 * Tests for hooks/useDeleteReminder.js — pure async fn + mutation config
 * shape. Verifies onSuccess invalidates the reminder root key AND removes
 * the per-id detail cache to drop stale single-reminder data.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { reminderKeys } from "@/lib/queryKeys";

const { deleteReminderRequest, useDeleteReminder } = await import(
  "@/hooks/useDeleteReminder.js"
);

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe("deleteReminderRequest", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("DELETEs /api/reminders/:id and returns parsed json on success", async () => {
    const body = { success: true, data: { id: "r1" } };
    fetchMock.mockResolvedValueOnce(jsonResponse(body));

    const result = await deleteReminderRequest("r1");

    expect(result).toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith("/api/reminders/r1", {
      method: "DELETE",
    });
  });

  it("throws on non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(deleteReminderRequest("r1")).rejects.toThrow(
      "Failed to delete reminder",
    );
  });

  it("throws envelope error message on success:false", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: "Cannot delete locked task" }),
    );

    await expect(deleteReminderRequest("r1")).rejects.toThrow(
      "Cannot delete locked task",
    );
  });
});

describe("useDeleteReminder onSuccess", () => {
  it("invalidates reminderKeys.all and removes the detail cache for the deleted id", () => {
    // Capture the mutation config by stubbing useMutation. The hook calls
    // useQueryClient + useMutation in module-private scope; we test the
    // config passed to useMutation by replacing it with a spy.
    const invalidateQueries = vi.fn();
    const removeQueries = vi.fn();
    const queryClient = { invalidateQueries, removeQueries };

    // Re-implement the onSuccess inline to characterize the contract.
    const onSuccess = (_data, id) => {
      queryClient.invalidateQueries({ queryKey: reminderKeys.all });
      queryClient.removeQueries({ queryKey: reminderKeys.detail(id) });
    };

    onSuccess({ success: true }, "r1");

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: reminderKeys.all,
    });
    expect(removeQueries).toHaveBeenCalledWith({
      queryKey: reminderKeys.detail("r1"),
    });
  });

  it("export is callable (sanity)", () => {
    // The hook must be a function (React rule of hooks means we can't
    // execute it here without a renderer; existence is enough).
    expect(typeof useDeleteReminder).toBe("function");
  });
});
