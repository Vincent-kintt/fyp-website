/**
 * Tests for hooks/useNote.js — pure-function characterization of
 * fetchNoteRequest + noteQueryOptions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { noteKeys } from "@/lib/queryKeys";

const { fetchNoteRequest, noteQueryOptions } = await import(
  "@/hooks/useNote.js"
);

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe("fetchNoteRequest", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GETs /api/notes/:id and returns data.data on success", async () => {
    const note = { id: "n1", title: "Test", content: [] };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: note }),
    );

    const result = await fetchNoteRequest("n1");

    expect(result).toEqual(note);
    expect(fetchMock).toHaveBeenCalledWith("/api/notes/n1");
  });

  it("throws on non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(fetchNoteRequest("n1")).rejects.toThrow(
      "Failed to fetch note",
    );
  });

  it("throws envelope error message on success:false", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: "Note not found" }),
    );

    await expect(fetchNoteRequest("n1")).rejects.toThrow("Note not found");
  });

  it("falls back to generic message when success:false has no error field", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false }));

    await expect(fetchNoteRequest("n1")).rejects.toThrow(
      "Failed to fetch note",
    );
  });
});

describe("noteQueryOptions", () => {
  it("returns the canonical detail key and a queryFn", () => {
    const opts = noteQueryOptions("n1");

    expect(opts.queryKey).toEqual(noteKeys.detail("n1"));
    expect(typeof opts.queryFn).toBe("function");
  });

  it("queryFn invokes fetchNoteRequest for the supplied id", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: "n2" } }),
    );
    globalThis.fetch = fetchMock;

    const opts = noteQueryOptions("n2");
    const result = await opts.queryFn();

    expect(result).toEqual({ id: "n2" });
    expect(fetchMock).toHaveBeenCalledWith("/api/notes/n2");
    vi.restoreAllMocks();
  });
});
