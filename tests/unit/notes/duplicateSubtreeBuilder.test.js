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
});
