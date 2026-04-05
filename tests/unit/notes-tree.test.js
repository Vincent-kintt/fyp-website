import { describe, it, expect } from "vitest";
import {
  buildTree,
  findAncestors,
  flattenVisibleTree,
  getDescendantIds,
  getProjection,
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

describe("getProjection", () => {
  const items = [
    { id: "a", depth: 0, parentId: null, hasChildren: true },
    { id: "b", depth: 1, parentId: "a", hasChildren: false },
    { id: "c", depth: 1, parentId: "a", hasChildren: false },
    { id: "d", depth: 0, parentId: null, hasChildren: false },
  ];
  const INDENT = 16;

  it("same-level reorder: no horizontal offset", () => {
    const result = getProjection(items, "d", "c", 0, INDENT);
    expect(result.depth).toBe(1);
    expect(result.parentId).toBe("a");
  });

  it("reparent deeper: right offset makes item child of over-item", () => {
    const result = getProjection(items, "d", "a", INDENT, INDENT);
    expect(result.depth).toBe(1);
    expect(result.parentId).toBe("a");
  });

  it("reparent shallower: left offset moves to root", () => {
    const result = getProjection(items, "b", "d", -INDENT, INDENT);
    expect(result.depth).toBe(0);
    expect(result.parentId).toBeNull();
  });

  it("clamps depth to minimum 0", () => {
    const result = getProjection(items, "d", "a", -INDENT * 5, INDENT);
    expect(result.depth).toBe(0);
    expect(result.parentId).toBeNull();
  });

  it("clamps depth to max overItem.depth + 1", () => {
    const result = getProjection(items, "d", "a", INDENT * 10, INDENT);
    expect(result.depth).toBe(1);
    expect(result.parentId).toBe("a");
  });

  it("returns over-item parentId when same depth", () => {
    // No horizontal offset: depth stays the same, parentId matches over-item's parent
    const result = getProjection(items, "d", "b", 0, INDENT);
    expect(result.depth).toBe(1);
    expect(result.parentId).toBe("a");
  });

  it("allows nesting under leaf nodes (any note can be parent)", () => {
    // Dragging "a" over "d" (leaf, depth 0), offset right by 1 indent
    const result = getProjection(items, "a", "d", INDENT, INDENT);
    expect(result.depth).toBe(1);
    expect(result.parentId).toBe("d");
  });
});

describe("computeTreeReorder", () => {
  const flat = [
    { id: "a", parentId: null, sortOrder: 1000 },
    { id: "b", parentId: "a", sortOrder: 1000 },
    { id: "c", parentId: "a", sortOrder: 2000 },
    { id: "d", parentId: null, sortOrder: 2000 },
  ];

  it("reorders within same parent", () => {
    const projection = { depth: 1, parentId: "a" };
    const result = computeTreeReorder(flat, "c", projection, 1);
    const cUpdate = result.find((u) => u.id === "c");
    const bUpdate = result.find((u) => u.id === "b");
    expect(cUpdate.parentId).toBe("a");
    expect(bUpdate.parentId).toBe("a");
    expect(cUpdate.sortOrder).toBeLessThan(bUpdate.sortOrder);
  });

  it("reparents to new parent", () => {
    const projection = { depth: 1, parentId: "a" };
    const result = computeTreeReorder(flat, "d", projection, 0);
    const dUpdate = result.find((u) => u.id === "d");
    expect(dUpdate.parentId).toBe("a");
    expect(dUpdate.sortOrder).toBeDefined();
  });

  it("reparents to root", () => {
    const projection = { depth: 0, parentId: null };
    const result = computeTreeReorder(flat, "b", projection, 0);
    const bUpdate = result.find((u) => u.id === "b");
    expect(bUpdate.parentId).toBeNull();
  });

  it("uses 1000-increment sortOrder values", () => {
    const projection = { depth: 1, parentId: "a" };
    const result = computeTreeReorder(flat, "d", projection, 1);
    for (const update of result) {
      expect(update.sortOrder % 1000).toBe(0);
    }
  });
});
