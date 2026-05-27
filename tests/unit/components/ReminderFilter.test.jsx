// ReminderFilter characterization — the quick-tag filter buttons must render
// one button per SUGGESTED_TAGS value. This pins the de-duplicated taxonomy
// (lib/utils SUGGESTED_TAGS) as the single source for the quick-tag row, so a
// future drift between the constant and the rendered buttons is caught.
//
// Renders by directly invoking the component function (same pattern as
// TagsSection.test.jsx) — no DOM. next-intl is mocked so useTranslations works
// without a provider; the returned labels are irrelevant to this assertion.

import { describe, it, expect, vi } from "vitest";
import { isValidElement } from "react";

vi.mock("next-intl", () => ({
  useTranslations: (namespace) => (key) => `${namespace}.${key}`,
}));

import ReminderFilter from "@/components/reminders/ReminderFilter";
import { SUGGESTED_TAGS } from "@/lib/utils.js";

function flatten(node, acc = []) {
  if (node == null || typeof node === "boolean") return acc;
  if (Array.isArray(node)) {
    node.forEach((n) => flatten(n, acc));
    return acc;
  }
  if (isValidElement(node)) {
    acc.push(node);
    flatten(node.props?.children, acc);
  }
  return acc;
}

function renderTree(element) {
  if (typeof element.type === "function") {
    return element.type(element.props);
  }
  return element;
}

describe("ReminderFilter — quick-tag buttons", () => {
  it("renders one button per SUGGESTED_TAGS value", () => {
    const tree = renderTree(
      <ReminderFilter
        filters={{ search: "", tag: null, type: "all" }}
        onFilterChange={vi.fn()}
      />,
    );

    const buttonLabels = flatten(tree)
      .filter((el) => el.type === "button")
      .map((el) => el.props.children);

    for (const tag of SUGGESTED_TAGS) {
      expect(buttonLabels).toContain(tag);
    }
  });
});
