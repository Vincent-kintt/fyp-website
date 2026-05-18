// DetailsSection — covers the status-transition guard. We don't render
// React's interactive layer; instead the component exposes the disabled
// attribute we can assert on in static markup, and we verify that the
// underlying isValidStatusTransition gate is reflected.

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import DetailsSection from "@/components/tasks/taskEditForm/DetailsSection.jsx";

const T = (key) => `T(${key})`;

describe("DetailsSection", () => {
  it("renders status and priority sections", () => {
    const html = renderToStaticMarkup(
      <DetailsSection
        formData={{ status: "pending", priority: "medium" }}
        onSelectStatus={vi.fn()}
        onSelectPriority={vi.fn()}
        t={T}
      />,
    );
    expect(html).toContain("T(status)");
    expect(html).toContain("T(priority)");
  });

  // Locked behavior: pending -> X where X is not a valid transition disables
  // the button. Per lib/utils.js, STATUS_TRANSITIONS pending allows the
  // current status (self) and a defined subset; we just confirm SOME button
  // is disabled when starting from pending.
  it("disables buttons for invalid status transitions", () => {
    const html = renderToStaticMarkup(
      <DetailsSection
        formData={{ status: "completed", priority: "low" }}
        onSelectStatus={vi.fn()}
        onSelectPriority={vi.fn()}
        t={T}
      />,
    );
    // A completed reminder should have at least one disabled button (cannot
    // transition to e.g. snoozed without restore-first per app rules).
    expect(html).toMatch(/disabled=""/);
  });

  it("renders the current priority with its colored palette class", () => {
    const html = renderToStaticMarkup(
      <DetailsSection
        formData={{ status: "pending", priority: "high" }}
        onSelectStatus={vi.fn()}
        onSelectPriority={vi.fn()}
        t={T}
      />,
    );
    expect(html).toContain("red-500");
  });
});
