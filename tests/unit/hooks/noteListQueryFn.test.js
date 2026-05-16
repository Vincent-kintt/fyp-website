/**
 * Tests for fetchNoteList — pure async function imported from useNoteList.
 *
 * Mirrors the success-envelope contract that hooks/useNotes.js already uses
 * for /api/notes: { success: true, data: [...] }, returning data || [].
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { fetchNoteList } = await import("@/hooks/useNoteList.js");

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe("fetchNoteList", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves to data array when response is 200 with data", async () => {
    const data = [{ id: "n1", title: "Note 1" }];
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data }));

    await expect(fetchNoteList()).resolves.toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith("/api/notes");
  });

  it("resolves to empty array when data field missing", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));

    await expect(fetchNoteList()).resolves.toEqual([]);
  });

  it("throws 'Failed to fetch notes' on 500 status", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(fetchNoteList()).rejects.toThrow("Failed to fetch notes");
  });
});
