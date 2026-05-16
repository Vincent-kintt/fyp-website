/**
 * Tests for noteListQueryOptions — pure options factory.
 */

import { describe, it, expect } from "vitest";
import { noteKeys } from "@/lib/queryKeys";

const { noteListQueryOptions, fetchNoteList } = await import(
  "@/hooks/useNoteList.js"
);

describe("noteListQueryOptions", () => {
  it("returns queryKey matching noteKeys.lists()", () => {
    const opts = noteListQueryOptions();
    expect(opts.queryKey).toEqual(noteKeys.lists());
  });

  it("returns queryFn equal to the exported fetchNoteList", () => {
    const opts = noteListQueryOptions();
    expect(opts.queryFn).toBe(fetchNoteList);
  });

  it("is pure — successive calls return equivalent options", () => {
    const a = noteListQueryOptions();
    const b = noteListQueryOptions();
    expect(a.queryKey).toEqual(b.queryKey);
    expect(a.queryFn).toBe(b.queryFn);
  });
});
