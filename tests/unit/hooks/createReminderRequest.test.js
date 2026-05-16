/**
 * Tests for createReminderRequest — pure async fn from useCreateReminder.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { createReminderRequest } = await import("@/hooks/useCreateReminder.js");

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe("createReminderRequest", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs JSON body to /api/reminders and returns parsed json on success", async () => {
    const payload = { title: "Test", dateTime: null, priority: "medium" };
    const responseBody = { success: true, data: { id: "r1", ...payload } };
    fetchMock.mockResolvedValueOnce(jsonResponse(responseBody));

    const result = await createReminderRequest(payload);

    expect(result).toEqual(responseBody);
    expect(fetchMock).toHaveBeenCalledWith("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("throws 'Failed' on non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(createReminderRequest({ title: "X" })).rejects.toThrow("Failed");
  });
});
