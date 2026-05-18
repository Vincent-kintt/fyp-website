// Tests for components/tasks/taskEditForm/parts.jsx — extracted inline
// sub-components from TaskEditForm. These are pure presentational helpers,
// so we render them via React.createElement + render-to-string for shape
// assertions without pulling in @testing-library/react.

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EndTimePreview,
  getPriorityColor,
  PriorityDot,
  SectionLabel,
  StatusIcon,
} from "@/components/tasks/taskEditForm/parts.jsx";

describe("getPriorityColor", () => {
  it("returns the high palette for 'high'", () => {
    expect(getPriorityColor("high")).toContain("red-500");
  });

  it("returns the medium palette for 'medium'", () => {
    expect(getPriorityColor("medium")).toContain("yellow-500");
  });

  it("returns the low palette for 'low'", () => {
    expect(getPriorityColor("low")).toContain("green-500");
  });

  it("falls back to medium for unknown priorities", () => {
    expect(getPriorityColor("urgent")).toBe(getPriorityColor("medium"));
    expect(getPriorityColor(undefined)).toBe(getPriorityColor("medium"));
    expect(getPriorityColor(null)).toBe(getPriorityColor("medium"));
  });
});

describe("EndTimePreview", () => {
  it("returns null when dateTime is missing", () => {
    const html = renderToStaticMarkup(
      <EndTimePreview dateTime="" duration={30} />,
    );
    expect(html).toBe("");
  });

  it("returns null when duration is missing", () => {
    const html = renderToStaticMarkup(
      <EndTimePreview dateTime="2026-05-18T09:00" duration={null} />,
    );
    expect(html).toBe("");
  });

  it("renders the start → end arrow when both are present", () => {
    const html = renderToStaticMarkup(
      <EndTimePreview dateTime="2026-05-18T09:00" duration={30} />,
    );
    expect(html).toContain("→");
  });
});

describe("PriorityDot", () => {
  it("renders the level's color class", () => {
    expect(renderToStaticMarkup(<PriorityDot level="high" />)).toContain(
      "bg-red-500",
    );
    expect(renderToStaticMarkup(<PriorityDot level="medium" />)).toContain(
      "bg-yellow-500",
    );
    expect(renderToStaticMarkup(<PriorityDot level="low" />)).toContain(
      "bg-green-500",
    );
  });
});

describe("SectionLabel", () => {
  it("wraps children in the label container", () => {
    const html = renderToStaticMarkup(
      <SectionLabel>HEADER</SectionLabel>,
    );
    expect(html).toContain("HEADER");
    expect(html).toContain("uppercase");
  });
});

describe("StatusIcon", () => {
  it("renders an svg for a known status without throwing", () => {
    const html = renderToStaticMarkup(
      <StatusIcon status="pending" className="w-3 h-3" />,
    );
    expect(html).toContain("svg");
    expect(html).toContain("w-3 h-3");
  });
});
