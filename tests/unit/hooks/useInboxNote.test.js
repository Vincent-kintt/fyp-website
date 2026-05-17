/**
 * Tests for hooks/useInboxNote.js — pure async fns + query/mutation config shapes.
 *
 * REST contract:
 *   GET /api/inbox/note     — read (404 if missing)
 *   POST /api/inbox/note    — ensure (idempotent create)
 *   PATCH /api/inbox/note   — update (strict 404 if missing)
 *
 * Fetcher uses GET first; on 404 it POSTs (to ensure) then GETs again. The
 * POST response is intentionally not consumed — the second GET is the source
 * of truth for the canonical note.
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

  it("GETs /api/inbox/note and returns data.data on first-call success", async () => {
    const inbox = { id: "inbox-1", title: "Inbox", content: [] };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: inbox }),
    );

    const result = await fetchInboxNoteRequest();

    expect(result).toEqual(inbox);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/inbox/note");
  });

  it("on 404 GET, POSTs to ensure then GETs again and returns the second GET's data", async () => {
    const inbox = { id: "inbox-1", title: "Inbox", content: [] };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: false }, { ok: false, status: 404 }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: inbox }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: inbox }));

    const result = await fetchInboxNoteRequest();

    expect(result).toEqual(inbox);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/inbox/note");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/inbox/note", {
      method: "POST",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/inbox/note");
  });

  it("throws (no POST fallback) when GET fails with non-404 status", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({}, { ok: false, status: 500 }),
    );

    await expect(fetchInboxNoteRequest()).rejects.toThrow(
      "Failed to load inbox note",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when first GET is 404 and POST ensure fails", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: false }, { ok: false, status: 404 }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(fetchInboxNoteRequest()).rejects.toThrow(
      "Failed to create inbox note",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when first GET is 404, POST ensures, but second GET fails", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: false }, { ok: false, status: 404 }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: "x" } }))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(fetchInboxNoteRequest()).rejects.toThrow(
      "Failed to load inbox note",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws when first GET is 404, POST ensures, but second GET is also 404", async () => {
    // Defensive: if the backend POST somehow doesn't ensure (bug, race with
    // a delete, missing partial unique index), the fallback fetcher must
    // still surface a clear load error instead of returning undefined.
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: false }, { ok: false, status: 404 }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { id: "x" } }))
      .mockResolvedValueOnce(jsonResponse({ success: false }, { ok: false, status: 404 }));

    await expect(fetchInboxNoteRequest()).rejects.toThrow(
      "Failed to load inbox note",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws envelope error message on success:false from first GET (200 status)", async () => {
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

  it("queryFn invokes fetchInboxNoteRequest (single GET on success path)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: "inbox-1" } }),
    );
    globalThis.fetch = fetchMock;

    const opts = inboxNoteQueryOptions();
    const result = await opts.queryFn();

    expect(result).toEqual({ id: "inbox-1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/inbox/note");
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
