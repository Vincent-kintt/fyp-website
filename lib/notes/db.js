import { getCollection } from "@/lib/db";
import { ObjectId } from "mongodb";

export async function getNotesCollection() {
  return getCollection("notes");
}

export function formatNote(doc) {
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    title: doc.title,
    parentId: doc.parentId ? doc.parentId.toString() : null,
    content: doc.content || [],
    icon: doc.icon || null,
    sortOrder: doc.sortOrder || 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    deletedAt: doc.deletedAt || null,
    extractedTasks: doc.extractedTasks || null,
    confirmedTasks: doc.confirmedTasks || null,
  };
}

export async function findDescendantIds(collection, userId, parentId) {
  const children = await collection
    .find({ userId, parentId })
    .project({ _id: 1 })
    .toArray();

  const ids = children.map((c) => c._id);
  for (const child of children) {
    const grandchildren = await findDescendantIds(collection, userId, child._id);
    ids.push(...grandchildren);
  }
  return ids;
}
