import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ReminderRowSkeleton from "@/components/reminders/ReminderRowSkeleton.jsx";

function countSkeletonLines(html) {
  return (html.match(/skeleton-line/g) || []).length;
}

describe("ReminderRowSkeleton", () => {
  it("renders 3 skeleton-line divs when metaLines=1 (icon + title + 1 meta)", () => {
    const html = renderToStaticMarkup(<ReminderRowSkeleton metaLines={1} />);
    expect(countSkeletonLines(html)).toBe(3);
  });

  it("renders 4 skeleton-line divs when metaLines=2 (icon + title + 2 meta)", () => {
    const html = renderToStaticMarkup(<ReminderRowSkeleton metaLines={2} />);
    expect(countSkeletonLines(html)).toBe(4);
  });

  it("defaults to metaLines=1 when prop omitted", () => {
    const html = renderToStaticMarkup(<ReminderRowSkeleton />);
    expect(countSkeletonLines(html)).toBe(3);
  });
});
