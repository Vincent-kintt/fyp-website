/**
 * Tests for hooks/useSyncInboxState.js — pure async fn + mutation config.
 * The hook is intentionally a use-case (toast-included) because callers
 * fire-and-forget mutate(...) and need visibility on failure.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { syncInboxStateRequest, useSyncInboxState } = await import(
  "@/hooks/useSyncInboxState.js"
);

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe("syncInboxStateRequest", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("PATCHes /api/inbox/note with extractedTasks + confirmedTasks", async () => {
    const extractedTasks = [{ title: "Buy milk" }];
    const confirmedTasks = ["Old task"];
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { ok: true } }),
    );

    const result = await syncInboxStateRequest({
      extractedTasks,
      confirmedTasks,
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/inbox/note", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extractedTasks, confirmedTasks }),
    });
  });

  it("throws on non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(
      syncInboxStateRequest({ extractedTasks: [], confirmedTasks: [] }),
    ).rejects.toThrow("Failed to sync inbox state");
  });

  it("throws envelope error message on success:false", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: "Inbox locked" }),
    );

    await expect(
      syncInboxStateRequest({ extractedTasks: [], confirmedTasks: [] }),
    ).rejects.toThrow("Inbox locked");
  });
});

describe("useSyncInboxState export", () => {
  it("exports a function (sanity)", () => {
    expect(typeof useSyncInboxState).toBe("function");
  });
});
