import { describe, it, expect } from "vitest";
import { ObjectId } from "mongodb";
import { buildSubtreeCopyDocs } from "@/lib/notes/duplicateSubtreeBuilder.js";

describe("buildSubtreeCopyDocs", () => {
  it("builds a single root copy when source has no descendants", () => {
    const sourceId = new ObjectId();
    const source = {
      _id: sourceId,
      userId: "user-1",
      title: "Plain",
      content: [{ type: "paragraph", content: "hi" }],
      icon: "doc",
      parentId: null,
      sortOrder: "a0",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
      deletedAt: null,
    };

    const { rootCopyDoc, newDocs } = buildSubtreeCopyDocs({
      source,
      descendants: [],
      nextSiblingSortOrder: null,
    });

    expect(newDocs).toHaveLength(1);
    expect(newDocs[0]).toBe(rootCopyDoc);
    expect(rootCopyDoc._id).toBeInstanceOf(ObjectId);
    expect(rootCopyDoc._id.equals(sourceId)).toBe(false);
    expect(rootCopyDoc.userId).toBe("user-1");
    expect(rootCopyDoc.title).toBe("Plain (copy)");
    expect(rootCopyDoc.content).toEqual(source.content);
    expect(rootCopyDoc.icon).toBe("doc");
    expect(rootCopyDoc.parentId).toBeNull();
    expect(typeof rootCopyDoc.sortOrder).toBe("string");
    expect(rootCopyDoc.sortOrder > "a0").toBe(true);
    expect(rootCopyDoc.deletedAt).toBeNull();
    expect(rootCopyDoc.createdAt).toBeInstanceOf(Date);
    expect(rootCopyDoc.updatedAt).toBeInstanceOf(Date);
    expect(rootCopyDoc.createdAt.getTime()).toBe(rootCopyDoc.updatedAt.getTime());
    expect(rootCopyDoc).not.toHaveProperty("extractedTasks");
    expect(rootCopyDoc).not.toHaveProperty("confirmedTasks");
    expect(rootCopyDoc).not.toHaveProperty("depth");
  });

  it("copies children with parentId rewritten to the new root id", () => {
    const sourceId = new ObjectId();
    const childAId = new ObjectId();
    const childBId = new ObjectId();
    const source = {
      _id: sourceId,
      userId: "user-1",
      title: "Folder",
      content: [],
      icon: null,
      parentId: null,
      sortOrder: "a0",
    };
    const descendants = [
      {
        _id: childAId,
        userId: "user-1",
        title: "Child A",
        content: [{ type: "paragraph", content: "A" }],
        icon: null,
        parentId: sourceId,
        sortOrder: "b0",
        depth: 0,
      },
      {
        _id: childBId,
        userId: "user-1",
        title: "Child B",
        content: [],
        icon: null,
        parentId: sourceId,
        sortOrder: "b1",
        depth: 0,
      },
    ];

    const { rootCopyDoc, newDocs } = buildSubtreeCopyDocs({
      source,
      descendants,
      nextSiblingSortOrder: null,
    });

    expect(newDocs).toHaveLength(3);
    const childCopies = newDocs.filter((d) => d._id !== rootCopyDoc._id);
    expect(childCopies).toHaveLength(2);
    for (const copy of childCopies) {
      expect(copy.parentId).toBeInstanceOf(ObjectId);
      expect(copy.parentId.equals(rootCopyDoc._id)).toBe(true);
      expect(copy._id.equals(childAId)).toBe(false);
      expect(copy._id.equals(childBId)).toBe(false);
    }
    expect(childCopies.map((c) => c.title).sort()).toEqual(["Child A", "Child B"]);
    expect(childCopies.find((c) => c.title === "Child A").sortOrder).toBe("b0");
    expect(childCopies.find((c) => c.title === "Child B").sortOrder).toBe("b1");
  });

  it("rewrites parent chains correctly across multiple levels", () => {
    const rootId = new ObjectId();
    const l1aId = new ObjectId();
    const l1bId = new ObjectId();
    const l2aId = new ObjectId();
    const l2bId = new ObjectId();
    const l3aId = new ObjectId();

    const source = {
      _id: rootId,
      userId: "u",
      title: "Root",
      content: [],
      icon: null,
      parentId: null,
      sortOrder: "a0",
    };
    const descendants = [
      { _id: l1aId, userId: "u", title: "L1a", content: [], icon: null, parentId: rootId, sortOrder: "b0", depth: 0 },
      { _id: l1bId, userId: "u", title: "L1b", content: [], icon: null, parentId: rootId, sortOrder: "b1", depth: 0 },
      { _id: l2aId, userId: "u", title: "L2a", content: [], icon: null, parentId: l1aId, sortOrder: "c0", depth: 1 },
      { _id: l2bId, userId: "u", title: "L2b", content: [], icon: null, parentId: l1aId, sortOrder: "c1", depth: 1 },
      { _id: l3aId, userId: "u", title: "L3a", content: [], icon: null, parentId: l2aId, sortOrder: "d0", depth: 2 },
    ];

    const { rootCopyDoc, newDocs } = buildSubtreeCopyDocs({
      source,
      descendants,
      nextSiblingSortOrder: null,
    });

    expect(newDocs).toHaveLength(6);

    const byTitle = (t) => newDocs.find((d) => d.title === t || d.title === `${t} (copy)`);
    const l1aCopy = byTitle("L1a");
    const l1bCopy = byTitle("L1b");
    const l2aCopy = byTitle("L2a");
    const l2bCopy = byTitle("L2b");
    const l3aCopy = byTitle("L3a");

    expect(l1aCopy.parentId.equals(rootCopyDoc._id)).toBe(true);
    expect(l1bCopy.parentId.equals(rootCopyDoc._id)).toBe(true);
    expect(l2aCopy.parentId.equals(l1aCopy._id)).toBe(true);
    expect(l2bCopy.parentId.equals(l1aCopy._id)).toBe(true);
    expect(l3aCopy.parentId.equals(l2aCopy._id)).toBe(true);

    // No copy has parentId pointing to a source _id.
    const sourceIds = [rootId, l1aId, l1bId, l2aId, l2bId, l3aId].map((i) => i.toString());
    for (const copy of newDocs) {
      if (copy.parentId !== null) {
        expect(sourceIds).not.toContain(copy.parentId.toString());
      }
    }
  });

  it("orders newDocs BFS so partial insertMany commits a connected subtree", () => {
    const rootId = new ObjectId();
    const l1Id = new ObjectId();
    const l2Id = new ObjectId();
    const source = {
      _id: rootId,
      userId: "u",
      title: "R",
      content: [],
      icon: null,
      parentId: null,
      sortOrder: "a0",
    };
    // $graphLookup output order is unspecified — simulate grandchild-before-child
    // by feeding descendants in reverse-depth order.
    const descendants = [
      { _id: l2Id, userId: "u", title: "L2", content: [], icon: null, parentId: l1Id, sortOrder: "c0", depth: 1 },
      { _id: l1Id, userId: "u", title: "L1", content: [], icon: null, parentId: rootId, sortOrder: "b0", depth: 0 },
    ];

    const { newDocs } = buildSubtreeCopyDocs({
      source,
      descendants,
      nextSiblingSortOrder: null,
    });

    // Required order: root first, then L1 (depth 0), then L2 (depth 1).
    expect(newDocs.map((d) => d.title)).toEqual(["R (copy)", "L1", "L2"]);

    // `depth` is a $graphLookup query-only annotation, not persisted on docs.
    for (const doc of newDocs) {
      expect(doc).not.toHaveProperty("depth");
    }
  });

  it("truncates source title to fit within the 200-char schema cap", () => {
    const sourceId = new ObjectId();
    const longTitle = "A".repeat(200);
    const source = {
      _id: sourceId,
      userId: "u",
      title: longTitle,
      content: [],
      icon: null,
      parentId: null,
      sortOrder: "a0",
    };

    const { rootCopyDoc } = buildSubtreeCopyDocs({
      source,
      descendants: [],
      nextSiblingSortOrder: null,
    });

    expect(rootCopyDoc.title.length).toBe(200);
    expect(rootCopyDoc.title.endsWith(" (copy)")).toBe(true);
    expect(rootCopyDoc.title.startsWith("A".repeat(193))).toBe(true);
  });

  it("does not truncate short titles", () => {
    const sourceId = new ObjectId();
    const source = {
      _id: sourceId,
      userId: "u",
      title: "Hello",
      content: [],
      icon: null,
      parentId: null,
      sortOrder: "a0",
    };

    const { rootCopyDoc } = buildSubtreeCopyDocs({
      source,
      descendants: [],
      nextSiblingSortOrder: null,
    });

    expect(rootCopyDoc.title).toBe("Hello (copy)");
  });

  it("places root copy sortOrder strictly between source and next sibling", () => {
    const sourceId = new ObjectId();
    const source = {
      _id: sourceId,
      userId: "u",
      title: "S",
      content: [],
      icon: null,
      parentId: null,
      sortOrder: "a0",
    };

    const { rootCopyDoc } = buildSubtreeCopyDocs({
      source,
      descendants: [],
      nextSiblingSortOrder: "a4",
    });

    expect(rootCopyDoc.sortOrder > "a0").toBe(true);
    expect(rootCopyDoc.sortOrder < "a4").toBe(true);
  });

  it("falls back to a key after source when there is no next sibling", () => {
    const sourceId = new ObjectId();
    const source = {
      _id: sourceId,
      userId: "u",
      title: "S",
      content: [],
      icon: null,
      parentId: null,
      sortOrder: "a0",
    };

    const { rootCopyDoc } = buildSubtreeCopyDocs({
      source,
      descendants: [],
      nextSiblingSortOrder: null,
    });

    expect(rootCopyDoc.sortOrder > "a0").toBe(true);
  });
});
