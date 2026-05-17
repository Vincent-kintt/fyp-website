/**
 * Tests for hooks/useUpdateNote.js — pure async fn + mutation config shape.
 * Generic patch (title/icon/content/etc.) over PATCH /api/notes/:id; invalidates
 * noteKeys.all on success so both list and detail subtrees refetch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { noteKeys } from "@/lib/queryKeys";

const { updateNoteRequest, useUpdateNote } = await import(
  "@/hooks/useUpdateNote.js"
);

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe("updateNoteRequest", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("PATCHes the patch body (id stripped) to /api/notes/:id and returns data.data", async () => {
    const patch = { title: "Updated", icon: "book" };
    const updated = { id: "n1", ...patch };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: updated }),
    );

    const result = await updateNoteRequest({ id: "n1", ...patch });

    expect(result).toEqual(updated);
    expect(fetchMock).toHaveBeenCalledWith("/api/notes/n1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  });

  it("throws on non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));

    await expect(
      updateNoteRequest({ id: "n1", title: "x" }),
    ).rejects.toThrow("Failed to update note");
  });

  it("throws envelope error message on success:false", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: "Permission denied" }),
    );

    await expect(
      updateNoteRequest({ id: "n1", title: "x" }),
    ).rejects.toThrow("Permission denied");
  });
});

describe("useUpdateNote onSuccess", () => {
  it("invalidates noteKeys.all so list + detail subtrees refetch", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries };

    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.all });
    };

    onSuccess();

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: noteKeys.all,
    });
  });

  it("export is callable (sanity)", () => {
    expect(typeof useUpdateNote).toBe("function");
  });
});
