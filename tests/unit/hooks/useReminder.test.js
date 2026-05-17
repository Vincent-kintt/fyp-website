/**
 * Tests for hooks/useReminder.js — pure-function characterization of
 * fetchReminderRequest + reminderQueryOptions. The hook itself is a thin
 * useQuery wrapper and is exercised end-to-end via the consumer pages /
 * Playwright e2e suite.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { reminderKeys } from "@/lib/queryKeys";

const { fetchReminderRequest, reminderQueryOptions } = await import(
  "@/hooks/useReminder.js"
);

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe("fetchReminderRequest", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GETs /api/reminders/:id and returns data.data on success", async () => {
    const reminder = { id: "r1", title: "Test", dateTime: null };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: reminder }),
    );

    const result = await fetchReminderRequest("r1");

    expect(result).toEqual(reminder);
    expect(fetchMock).toHaveBeenCalledWith("/api/reminders/r1");
  });

  it("throws on non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(fetchReminderRequest("r1")).rejects.toThrow(
      "Failed to fetch reminder",
    );
  });

  it("throws envelope error message on success:false", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: "Not found" }),
    );

    await expect(fetchReminderRequest("r1")).rejects.toThrow("Not found");
  });

  it("falls back to generic message when success:false has no error field", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false }));

    await expect(fetchReminderRequest("r1")).rejects.toThrow(
      "Failed to fetch reminder",
    );
  });
});

describe("reminderQueryOptions", () => {
  it("returns the canonical detail key and a queryFn", () => {
    const opts = reminderQueryOptions("r1");

    expect(opts.queryKey).toEqual(reminderKeys.detail("r1"));
    expect(typeof opts.queryFn).toBe("function");
  });

  it("queryFn invokes fetchReminderRequest for the supplied id", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: "r2" } }),
    );
    globalThis.fetch = fetchMock;

    const opts = reminderQueryOptions("r2");
    const result = await opts.queryFn();

    expect(result).toEqual({ id: "r2" });
    expect(fetchMock).toHaveBeenCalledWith("/api/reminders/r2");
    vi.restoreAllMocks();
  });
});
