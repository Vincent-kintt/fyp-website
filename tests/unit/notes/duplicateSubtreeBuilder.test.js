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
});
