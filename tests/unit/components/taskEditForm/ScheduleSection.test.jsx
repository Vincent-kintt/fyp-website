// ScheduleSection — preserves the duration-row EndTimePreview gating and the
// recurring-type select toggling. Rendered with renderToStaticMarkup so we
// don't need @testing-library/react for static structure assertions.

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ScheduleSection from "@/components/tasks/taskEditForm/ScheduleSection.jsx";

const T = (key) => `T(${key})`;

const BASE_DATA = {
  dateTime: "",
  duration: null,
  recurring: false,
  recurringType: "daily",
};

describe("ScheduleSection", () => {
  it("does not render the end-time preview when dateTime is empty", () => {
    const html = renderToStaticMarkup(
      <ScheduleSection
        formData={BASE_DATA}
        onChange={vi.fn()}
        onSelectDuration={vi.fn()}
        t={T}
      />,
    );
    expect(html).not.toContain("→");
  });

  it("does not render the end-time preview when duration is null even with dateTime", () => {
    const html = renderToStaticMarkup(
      <ScheduleSection
        formData={{ ...BASE_DATA, dateTime: "2026-05-18T09:00", duration: null }}
        onChange={vi.fn()}
        onSelectDuration={vi.fn()}
        t={T}
      />,
    );
    expect(html).not.toContain("→");
  });

  it("renders the end-time preview when BOTH dateTime and duration are set", () => {
    const html = renderToStaticMarkup(
      <ScheduleSection
        formData={{ ...BASE_DATA, dateTime: "2026-05-18T09:00", duration: 30 }}
        onChange={vi.fn()}
        onSelectDuration={vi.fn()}
        t={T}
      />,
    );
    expect(html).toContain("→");
  });

  it("renders the recurring-type select ONLY when recurring is true", () => {
    const hidden = renderToStaticMarkup(
      <ScheduleSection
        formData={{ ...BASE_DATA, recurring: false }}
        onChange={vi.fn()}
        onSelectDuration={vi.fn()}
        t={T}
      />,
    );
    expect(hidden).not.toContain("<select");

    const shown = renderToStaticMarkup(
      <ScheduleSection
        formData={{ ...BASE_DATA, recurring: true }}
        onChange={vi.fn()}
        onSelectDuration={vi.fn()}
        t={T}
      />,
    );
    expect(shown).toContain("<select");
  });
});
