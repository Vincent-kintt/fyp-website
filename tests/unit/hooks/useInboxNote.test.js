/**
 * Tests for hooks/useInboxNote.js — pure async fns + query/mutation config shapes.
 *
 * API oddity: /api/inbox/note uses POST as a "get-or-create" for the singleton
 * inbox note (one per user). PATCH updates fields (content, extractedTasks,
 * confirmedTasks). The hook mirrors that contract as-is.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  fetchInboxNoteRequest,
  inboxNoteQueryOptions,
  updateInboxNoteRequest,
  useInboxNote,
  useUpdateInboxNote,
} = await import("@/hooks/useInboxNote.js");

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe("fetchInboxNoteRequest", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs /api/inbox/note and returns data.data on success", async () => {
    const inbox = { id: "inbox-1", title: "Inbox", content: [] };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: inbox }),
    );

    const result = await fetchInboxNoteRequest();

    expect(result).toEqual(inbox);
    expect(fetchMock).toHaveBeenCalledWith("/api/inbox/note", {
      method: "POST",
    });
  });

  it("throws on non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(fetchInboxNoteRequest()).rejects.toThrow(
      "Failed to load inbox note",
    );
  });

  it("throws envelope error message on success:false", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: "Inbox not available" }),
    );

    await expect(fetchInboxNoteRequest()).rejects.toThrow("Inbox not available");
  });

  it("falls back to generic message when success:false has no error field", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false }));

    await expect(fetchInboxNoteRequest()).rejects.toThrow(
      "Failed to load inbox note",
    );
  });
});

describe("inboxNoteQueryOptions", () => {
  it("returns the canonical inbox key and a queryFn", () => {
    const opts = inboxNoteQueryOptions();

    expect(opts.queryKey).toEqual(["inbox", "note"]);
    expect(typeof opts.queryFn).toBe("function");
  });

  it("queryFn invokes fetchInboxNoteRequest", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: "inbox-1" } }),
    );
    globalThis.fetch = fetchMock;

    const opts = inboxNoteQueryOptions();
    const result = await opts.queryFn();

    expect(result).toEqual({ id: "inbox-1" });
    expect(fetchMock).toHaveBeenCalledWith("/api/inbox/note", {
      method: "POST",
    });
    vi.restoreAllMocks();
  });
});

describe("updateInboxNoteRequest", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("PATCHes the patch body to /api/inbox/note and returns data.data", async () => {
    const patch = { content: [{ type: "paragraph" }] };
    const updated = { id: "inbox-1", ...patch };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: updated }),
    );

    const result = await updateInboxNoteRequest(patch);

    expect(result).toEqual(updated);
    expect(fetchMock).toHaveBeenCalledWith("/api/inbox/note", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  });

  it("forwards an empty-state reset payload verbatim", async () => {
    const patch = { content: [], extractedTasks: [], confirmedTasks: [] };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: "inbox-1", ...patch } }),
    );

    await updateInboxNoteRequest(patch);

    expect(fetchMock).toHaveBeenCalledWith("/api/inbox/note", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  });

  it("throws on non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(updateInboxNoteRequest({ content: [] })).rejects.toThrow(
      "Failed to update inbox note",
    );
  });

  it("throws envelope error message on success:false", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: "Permission denied" }),
    );

    await expect(updateInboxNoteRequest({ content: [] })).rejects.toThrow(
      "Permission denied",
    );
  });
});

describe("useInboxNote / useUpdateInboxNote sanity", () => {
  it("exports are callable", () => {
    expect(typeof useInboxNote).toBe("function");
    expect(typeof useUpdateInboxNote).toBe("function");
  });
});
