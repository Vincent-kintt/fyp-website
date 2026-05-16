/**
 * Tests for useReminderList option overrides — verifies that the staleTime
 * override is forwarded to react-query (GlobalSearch uses 30s).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const useQueryMock = vi.fn(() => ({ data: [], isLoading: false }));

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
}));

const { useReminderList } = await import("@/hooks/useReminderList.js");
const { useNoteList } = await import("@/hooks/useNoteList.js");
const { reminderKeys, noteKeys } = await import("@/lib/queryKeys");

describe("useReminderList option overrides", () => {
  beforeEach(() => {
    useQueryMock.mockClear();
  });

  it("forwards staleTime when provided", () => {
    useReminderList({ enabled: true, staleTime: 30_000 });

    expect(useQueryMock).toHaveBeenCalledTimes(1);
    const opts = useQueryMock.mock.calls[0][0];
    expect(opts.staleTime).toBe(30_000);
    expect(opts.enabled).toBe(true);
    expect(opts.queryKey).toEqual(reminderKeys.list({}));
  });

  it("omits staleTime when not provided", () => {
    useReminderList();

    const opts = useQueryMock.mock.calls[0][0];
    expect(opts).not.toHaveProperty("staleTime");
    expect(opts.enabled).toBe(true);
  });

  it("supports enabled=false to gate the query", () => {
    useReminderList({ enabled: false });

    const opts = useQueryMock.mock.calls[0][0];
    expect(opts.enabled).toBe(false);
  });
});

describe("useNoteList option overrides", () => {
  beforeEach(() => {
    useQueryMock.mockClear();
  });

  it("forwards staleTime when provided", () => {
    useNoteList({ enabled: true, staleTime: 30_000 });

    const opts = useQueryMock.mock.calls[0][0];
    expect(opts.staleTime).toBe(30_000);
    expect(opts.queryKey).toEqual(noteKeys.lists());
  });

  it("supports enabled=false", () => {
    useNoteList({ enabled: false });

    const opts = useQueryMock.mock.calls[0][0];
    expect(opts.enabled).toBe(false);
  });
});
