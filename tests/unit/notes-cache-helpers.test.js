/**
 * Tests for the removeNoteCaches helper exported from hooks/useNotes.js.
 *
 * Why it exists: when a note is deleted (soft or permanent), the detail
 * cache (noteKeys.detail(id)) must be GONE — not just stale — so the next
 * mount of useNote(id) re-fetches and the API can return 404. Otherwise a
 * stale detail page persists after deletion.
 */

import { describe, it, expect, vi } from "vitest";
import { noteKeys } from "@/lib/queryKeys";

const { removeNoteCaches } = await import("@/lib/notes/cacheHelpers.js");

describe("removeNoteCaches", () => {
  it("removes the detail cache for the given note id", () => {
    const removeQueries = vi.fn();
    const queryClient = { removeQueries };

    removeNoteCaches({ queryClient, id: "n1" });

    expect(removeQueries).toHaveBeenCalledWith({
      queryKey: noteKeys.detail("n1"),
    });
  });

  it("uses noteKeys.detail() (not lists/all) so list cache survives", () => {
    const calls = [];
    const queryClient = {
      removeQueries: (arg) => calls.push(arg),
    };

    removeNoteCaches({ queryClient, id: "n2" });

    expect(calls).toHaveLength(1);
    expect(calls[0].queryKey).toEqual(noteKeys.detail("n2"));
    // sanity: detail key is not equal to lists() or .all
    expect(calls[0].queryKey).not.toEqual(noteKeys.lists());
    expect(calls[0].queryKey).not.toEqual(noteKeys.all);
  });
});
