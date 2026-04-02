import { describe, it, expect } from "vitest";
import { buildTree, findAncestors } from "@/lib/notes/tree.js";

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
