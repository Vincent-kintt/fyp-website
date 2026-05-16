/**
 * Tests for reminderListQueryOptions — pure options factory used by both
 * useReminderList and queryClient.fetchQuery (ExportButton).
 */

import { describe, it, expect } from "vitest";
import { reminderKeys } from "@/lib/queryKeys";

const { reminderListQueryOptions, fetchReminderList } = await import(
  "@/hooks/useReminderList.js"
);

describe("reminderListQueryOptions", () => {
  it("returns queryKey matching reminderKeys.list({})", () => {
    const opts = reminderListQueryOptions();
    expect(opts.queryKey).toEqual(reminderKeys.list({}));
  });

  it("returns queryFn equal to the exported fetchReminderList", () => {
    const opts = reminderListQueryOptions();
    expect(opts.queryFn).toBe(fetchReminderList);
  });

  it("is pure — successive calls return equivalent options", () => {
    const a = reminderListQueryOptions();
    const b = reminderListQueryOptions();
    expect(a.queryKey).toEqual(b.queryKey);
    expect(a.queryFn).toBe(b.queryFn);
  });
});
