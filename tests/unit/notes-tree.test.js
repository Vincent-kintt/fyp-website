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
      { id: "a", parentId: null, title: "Root A", sortOrder: "a0" },
      { id: "b", parentId: "a", title: "Child B", sortOrder: "a0" },
      { id: "c", parentId: "a", title: "Child C", sortOrder: "a1" },
      { id: "d", parentId: null, title: "Root D", sortOrder: "a1" },
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

  it("sorts siblings by sortOrder (lexicographic)", () => {
    const flat = [
      { id: "a", parentId: null, title: "Second", sortOrder: "a1" },
      { id: "b", parentId: null, title: "First", sortOrder: "a0" },
    ];
    const tree = buildTree(flat);
    expect(tree[0].id).toBe("b");
    expect(tree[1].id).toBe("a");
  });

  it("uses id as tiebreaker when sortOrder strings collide", () => {
    const flat = [
      { id: "z", parentId: null, sortOrder: "a0" },
      { id: "a", parentId: null, sortOrder: "a0" },
    ];
    const tree = buildTree(flat);
    expect(tree[0].id).toBe("a");
    expect(tree[1].id).toBe("z");
  });

  it("handles orphaned children gracefully", () => {
    const flat = [
      { id: "a", parentId: "nonexistent", title: "Orphan", sortOrder: "a0" },
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
    { id: "a", parentId: null, title: "Root A", sortOrder: "a0" },
    { id: "b", parentId: "a", title: "Child B", sortOrder: "a0" },
    { id: "c", parentId: "a", title: "Child C", sortOrder: "a1" },
    { id: "d", parentId: null, title: "Root D", sortOrder: "a1" },
    { id: "e", parentId: "b", title: "Grandchild E", sortOrder: "a0" },
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
    { id: "a", parentId: null, sortOrder: "a0" },
    { id: "b", parentId: "a", sortOrder: "a0" },
    { id: "c", parentId: "a", sortOrder: "a1" },
    { id: "d", parentId: null, sortOrder: "a1" },
  ];

  it("emits a single update for the moved note (fractional keys are stable for siblings)", () => {
    const result = computeTreeReorder(flat, "c", "b", "before");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c");
  });

  it("reorders before a sibling — new key sorts before over", () => {
    // Move "c" before "b" under parent "a"
    const result = computeTreeReorder(flat, "c", "b", "before");
    const cUpdate = result[0];
    expect(cUpdate.id).toBe("c");
    expect(cUpdate.parentId).toBe("a");
    expect(typeof cUpdate.sortOrder).toBe("string");
    // The new key must sort before "b"'s key "a0"
    expect(cUpdate.sortOrder < "a0").toBe(true);
  });

  it("reorders after a sibling — new key sorts after over", () => {
    const result = computeTreeReorder(flat, "b", "c", "after");
    const bUpdate = result[0];
    expect(bUpdate.id).toBe("b");
    expect(bUpdate.sortOrder > "a1").toBe(true);
  });

  it("reparents into another note as last child", () => {
    // Move "d" into "a" as child — last position
    const result = computeTreeReorder(flat, "d", "a", "into");
    expect(result[0].id).toBe("d");
    expect(result[0].parentId).toBe("a");
    expect(typeof result[0].sortOrder).toBe("string");
    // Last child of "a" was "c" at "a1" — new key must be after "a1"
    expect(result[0].sortOrder > "a1").toBe(true);
  });

  it("reparents to root via before/after on root item", () => {
    // Move "b" (child of a) before "d" (root) → becomes root
    const result = computeTreeReorder(flat, "b", "d", "before");
    const bUpdate = result[0];
    expect(bUpdate.id).toBe("b");
    expect(bUpdate.parentId).toBeNull();
  });

  it("uses string sortOrder values (no integer increments)", () => {
    const result = computeTreeReorder(flat, "d", "b", "after");
    for (const update of result) {
      expect(typeof update.sortOrder).toBe("string");
      expect(update.sortOrder.length).toBeGreaterThan(0);
    }
  });
});
