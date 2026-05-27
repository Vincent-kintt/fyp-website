// TagsSection — covers quick-tag toggle and chip-remove. We invoke the
// onClick handlers directly via a tiny renderer that captures React props,
// without pulling in @testing-library/react.

import { describe, it, expect, vi } from "vitest";
import { isValidElement } from "react";
import TagsSection from "@/components/tasks/taskEditForm/TagsSection.jsx";
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

function findButton(tree, predicate) {
  const all = flatten(tree);
  return all.find(
    (el) =>
      el.type === "button" &&
      predicate(el.props),
  );
}

function renderTree(element) {
  // Call the component function with its props to get the React tree
  // without DOM. Works because our section components are plain functions.
  if (typeof element.type === "function") {
    return element.type(element.props);
  }
  return element;
}

const T = (key) => `T(${key})`;

describe("TagsSection — quick tag click", () => {
  it("calls onAddTag with the tag when not already present", () => {
    const onAddTag = vi.fn();
    const onRemoveTag = vi.fn();
    const tree = renderTree(
      <TagsSection
        formData={{ tags: [] }}
        newTag=""
        onNewTagChange={vi.fn()}
        onTagKeyDown={vi.fn()}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        t={T}
      />,
    );

    const workBtn = findButton(
      tree,
      (props) =>
        props.children === "work" && props.type === "button",
    );
    expect(workBtn).toBeTruthy();
    workBtn.props.onClick();
    expect(onAddTag).toHaveBeenCalledWith("work");
    expect(onRemoveTag).not.toHaveBeenCalled();
  });

  it("calls onRemoveTag when the tag IS already in formData.tags", () => {
    const onAddTag = vi.fn();
    const onRemoveTag = vi.fn();
    const tree = renderTree(
      <TagsSection
        formData={{ tags: ["work"] }}
        newTag=""
        onNewTagChange={vi.fn()}
        onTagKeyDown={vi.fn()}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        t={T}
      />,
    );
    const workBtn = findButton(
      tree,
      (props) => props.children === "work",
    );
    workBtn.props.onClick();
    expect(onRemoveTag).toHaveBeenCalledWith("work");
    expect(onAddTag).not.toHaveBeenCalled();
  });
});

describe("TagsSection — quick tag vocabulary", () => {
  it("renders one quick-tag button per SUGGESTED_TAGS value", () => {
    const tree = renderTree(
      <TagsSection
        formData={{ tags: [] }}
        newTag=""
        onNewTagChange={vi.fn()}
        onTagKeyDown={vi.fn()}
        onAddTag={vi.fn()}
        onRemoveTag={vi.fn()}
        t={T}
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

describe("TagsSection — chip remove", () => {
  it("removes a tag when the chip's X button is clicked", () => {
    const onRemoveTag = vi.fn();
    const tree = renderTree(
      <TagsSection
        formData={{ tags: ["urgent"] }}
        newTag=""
        onNewTagChange={vi.fn()}
        onTagKeyDown={vi.fn()}
        onAddTag={vi.fn()}
        onRemoveTag={onRemoveTag}
        t={T}
      />,
    );

    // The chip's X button is the one whose onClick wraps onRemoveTag with a
    // FaTimes icon child. We identify it by clicking each button and
    // confirming one calls onRemoveTag("urgent").
    const flat = flatten(tree);
    const candidates = flat.filter(
      (el) => el.type === "button" && typeof el.props.onClick === "function",
    );
    let invoked = false;
    for (const btn of candidates) {
      onRemoveTag.mockClear();
      btn.props.onClick();
      if (
        onRemoveTag.mock.calls.length === 1 &&
        onRemoveTag.mock.calls[0][0] === "urgent"
      ) {
        invoked = true;
        break;
      }
    }
    expect(invoked).toBe(true);
  });
});
