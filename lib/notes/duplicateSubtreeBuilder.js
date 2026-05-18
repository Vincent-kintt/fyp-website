import { ObjectId } from "mongodb";
import { generateKeyBetween } from "@/lib/notes/sortOrder.js";

const COPY_SUFFIX = " (copy)";
const TITLE_MAX = 200;

export function truncateTitleForCopy(title) {
  const room = TITLE_MAX - COPY_SUFFIX.length;
  const base = typeof title === "string" ? title : "";
  return (base.length > room ? base.slice(0, room) : base) + COPY_SUFFIX;
}

export function buildSubtreeCopyDocs({
  source,
  descendants,
  nextSiblingSortOrder,
}) {
  const now = new Date();
  const newRootId = new ObjectId();

  const rootCopyDoc = {
    _id: newRootId,
    userId: source.userId,
    title: truncateTitleForCopy(source.title),
    content: source.content || [],
    icon: source.icon ?? null,
    parentId: source.parentId ?? null,
    sortOrder: generateKeyBetween(
      typeof source.sortOrder === "string" ? source.sortOrder : null,
      typeof nextSiblingSortOrder === "string" ? nextSiblingSortOrder : null,
    ),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  // Map source _id (as string) → freshly-generated new _id. Source root maps
  // to the new root; every descendant gets a fresh ObjectId.
  const oldToNew = new Map();
  oldToNew.set(source._id.toString(), newRootId);
  for (const d of descendants) {
    oldToNew.set(d._id.toString(), new ObjectId());
  }

  const sortedDescendants = [...descendants].sort(
    (a, b) => (a.depth ?? 0) - (b.depth ?? 0),
  );
  const descendantCopies = sortedDescendants.map((d) => ({
    _id: oldToNew.get(d._id.toString()),
    userId: d.userId,
    title: d.title,
    content: d.content || [],
    icon: d.icon ?? null,
    parentId: oldToNew.get(d.parentId.toString()),
    sortOrder: d.sortOrder,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }));

  return {
    rootCopyDoc,
    newDocs: [rootCopyDoc, ...descendantCopies],
  };
}
