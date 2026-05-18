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

  return { rootCopyDoc, newDocs: [rootCopyDoc] };
}
