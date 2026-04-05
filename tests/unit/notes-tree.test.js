import { describe, it, expect } from "vitest";
import {
  buildTree,
  findAncestors,
  flattenVisibleTree,
  getDescendantIds,
  computeTreeReorder,
} from "@/lib/notes/tree.js";

describe("buildTree", () => {
  it("builds nested tree from flat notes array", () => {
    const flat = [
      { id: "a", parentId: null, title: "Root A", sortOrder: 1000 },
      { id: "b", parentId: "a", title: "Child B", sortOrder: 1000 },
      { id: "c", parentId: "a", title: "Child C", sortOrder: 2000 },
      { id: "d", parentId: null, title: "Root D", sortOrder: 2000 },
    ];
    const tree = buildTree(flat);
    expect(tree).toHaveLength(2);
    expect(tree[0].id).toBe("a");
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].id).toBe("b");
    expect(tree[0].children[1].id).toBe("c");
    expect(tree[1].id).toBe("d");
    expect(tree[1].children).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(buildTree([])).toEqual([]);
  });

  it("sorts siblings by sortOrder", () => {
    const flat = [
      { id: "a", parentId: null, title: "Second", sortOrder: 2000 },
      { id: "b", parentId: null, title: "First", sortOrder: 1000 },
    ];
    const tree = buildTree(flat);
    expect(tree[0].id).toBe("b");
    expect(tree[1].id).toBe("a");
  });

  it("handles orphaned children gracefully", () => {
    const flat = [
      { id: "a", parentId: "nonexistent", title: "Orphan", sortOrder: 1000 },
    ];
    const tree = buildTree(flat);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("a");
  });
});

describe("findAncestors", () => {
  it("returns ancestor ids from child to root", () => {
    const flat = [
      { id: "a", parentId: null },
      { id: "b", parentId: "a" },
      { id: "c", parentId: "b" },
    ];
    const ancestors = findAncestors(flat, "c");
    expect(ancestors).toEqual(["b", "a"]);
  });

  it("returns empty array for root node", () => {
    const flat = [{ id: "a", parentId: null }];
    expect(findAncestors(flat, "a")).toEqual([]);
  });
});

describe("flattenVisibleTree", () => {
  const flat = [
    { id: "a", parentId: null, title: "Root A", sortOrder: 1000 },
    { id: "b", parentId: "a", title: "Child B", sortOrder: 1000 },
    { id: "c", parentId: "a", title: "Child C", sortOrder: 2000 },
    { id: "d", parentId: null, title: "Root D", sortOrder: 2000 },
    { id: "e", parentId: "b", title: "Grandchild E", sortOrder: 1000 },
  ];
  const tree = buildTree(flat);

  it("flattens all nodes when all expanded", () => {
    const expandedIds = new Set(["a", "b"]);
    const result = flattenVisibleTree(tree, expandedIds);
    expect(result.map((r) => r.id)).toEqual(["a", "b", "e", "c", "d"]);
  });

  it("includes correct depth for each node", () => {
    const expandedIds = new Set(["a", "b"]);
    const result = flattenVisibleTree(tree, expandedIds);
    expect(result.map((r) => r.depth)).toEqual([0, 1, 2, 1, 0]);
  });

  it("includes parentId for each node", () => {
    const expandedIds = new Set(["a", "b"]);
    const result = flattenVisibleTree(tree, expandedIds);
    expect(result.map((r) => r.parentId)).toEqual([null, "a", "b", "a", null]);
  });

  it("includes hasChildren flag", () => {
    const expandedIds = new Set(["a", "b"]);
    const result = flattenVisibleTree(tree, expandedIds);
    expect(result.map((r) => r.hasChildren)).toEqual([true, true, false, false, false]);
  });

  it("skips children of collapsed nodes", () => {
    const expandedIds = new Set(["a"]);
    const result = flattenVisibleTree(tree, expandedIds);
    expect(result.map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("skips all descendants when root is collapsed", () => {
    const expandedIds = new Set();
    const result = flattenVisibleTree(tree, expandedIds);
    expect(result.map((r) => r.id)).toEqual(["a", "d"]);
  });

  it("returns empty array for empty tree", () => {
    expect(flattenVisibleTree([], new Set())).toEqual([]);
  });
});

describe("getDescendantIds", () => {
  const flat = [
    { id: "a", parentId: null },
    { id: "b", parentId: "a" },
    { id: "c", parentId: "a" },
    { id: "d", parentId: "b" },
    { id: "e", parentId: "d" },
    { id: "f", parentId: null },
  ];

  it("returns all descendants of a node", () => {
    const result = getDescendantIds(flat, "a");
    expect(result).toEqual(new Set(["b", "c", "d", "e"]));
  });

  it("returns nested descendants", () => {
    const result = getDescendantIds(flat, "b");
    expect(result).toEqual(new Set(["d", "e"]));
  });

  it("returns empty set for leaf node", () => {
    const result = getDescendantIds(flat, "f");
    expect(result).toEqual(new Set());
  });

  it("returns empty set for nonexistent id", () => {
    const result = getDescendantIds(flat, "zzz");
    expect(result).toEqual(new Set());
  });
});

describe("computeTreeReorder", () => {
  const flat = [
    { id: "a", parentId: null, sortOrder: 1000 },
    { id: "b", parentId: "a", sortOrder: 1000 },
    { id: "c", parentId: "a", sortOrder: 2000 },
    { id: "d", parentId: null, sortOrder: 2000 },
  ];

  it("reorders before a sibling", () => {
    // Move "c" before "b" under parent "a"
    const result = computeTreeReorder(flat, "c", "b", "before");
    const cUpdate = result.find((u) => u.id === "c");
    const bUpdate = result.find((u) => u.id === "b");
    expect(cUpdate.parentId).toBe("a");
    expect(bUpdate.parentId).toBe("a");
    expect(cUpdate.sortOrder).toBeLessThan(bUpdate.sortOrder);
  });

  it("reorders after a sibling", () => {
    const result = computeTreeReorder(flat, "c", "b", "after");
    const cUpdate = result.find((u) => u.id === "c");
    const bUpdate = result.find((u) => u.id === "b");
    expect(bUpdate.sortOrder).toBeLessThan(cUpdate.sortOrder);
  });

  it("reparents into another note", () => {
    // Move "d" into "a" as child
    const result = computeTreeReorder(flat, "d", "a", "into");
    const dUpdate = result.find((u) => u.id === "d");
    expect(dUpdate.parentId).toBe("a");
    expect(dUpdate.sortOrder).toBeDefined();
  });

  it("reparents to root via before/after on root item", () => {
    // Move "b" (child of a) before "d" (root) → becomes root
    const result = computeTreeReorder(flat, "b", "d", "before");
    const bUpdate = result.find((u) => u.id === "b");
    expect(bUpdate.parentId).toBeNull();
  });

  it("uses 1000-increment sortOrder values", () => {
    const result = computeTreeReorder(flat, "d", "b", "after");
    for (const update of result) {
      expect(update.sortOrder % 1000).toBe(0);
    }
  });
});
