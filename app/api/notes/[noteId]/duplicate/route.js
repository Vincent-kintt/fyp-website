// POST /api/notes/[noteId]/duplicate
//
// Server-side atomic note duplication. The previous client did three serial
// fetches — GET source, POST empty note, PATCH content — which left a
// stranded "(copy)" doc in the database whenever the PATCH leg failed. This
// endpoint folds the entire operation into one insertOne so the client makes
// a single round-trip and either gets the duplicate or doesn't.
//
// Scope: copies this single note only. Folder duplication (recursive
// descendant copy) is intentionally out of scope — that's a separate
// enhancement with its own UX questions around partial-failure semantics.
// Inbox notes are rejected to match the PATCH /api/notes/[noteId] guard.

import { ObjectId } from "mongodb";
import { apiSuccess, apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { getNotesCollection, formatNote } from "@/lib/notes/db";
import { generateKeyBetween } from "@/lib/notes/sortOrder.js";

export const POST = withAuth(
  async ({ params, userId }) => {
    const { noteId } = await params;

    if (!ObjectId.isValid(noteId)) {
      return apiError("Invalid note ID", 400);
    }

    const notesCollection = await getNotesCollection();
    const sourceObjectId = new ObjectId(noteId);

    const source = await notesCollection.findOne({
      _id: sourceObjectId,
      userId,
      deletedAt: null,
    });

    if (!source) {
      return apiError("Note not found", 404);
    }

    if (source.type === "inbox") {
      return apiError("Cannot duplicate inbox note", 403);
    }

    // Slot the duplicate immediately after the source in the same parent so
    // it appears next to the original in the tree. Sibling query is scoped
    // by (userId, parentId) and looks for the next note whose sortOrder key
    // sorts after the source — generateKeyBetween(source, nextSibling ?? null)
    // produces a fractional key that lands between them, or after source if
    // none exists (identical to generateKeyAfter).
    const sourceKey =
      typeof source.sortOrder === "string" ? source.sortOrder : null;

    const nextSibling = await notesCollection
      .find({
        userId,
        parentId: source.parentId ?? null,
        sortOrder: { $gt: sourceKey },
      })
      .sort({ sortOrder: 1, _id: 1 })
      .limit(1)
      .toArray();

    const nextKey =
      typeof nextSibling[0]?.sortOrder === "string"
        ? nextSibling[0].sortOrder
        : null;

    const newSortOrder = generateKeyBetween(sourceKey, nextKey);

    const now = new Date();
    const newNote = {
      userId,
      title: `${source.title} (copy)`,
      parentId: source.parentId ?? null,
      // BlockNote content is plain BSON-safe array of objects; the driver
      // serializes it on insert and re-reads as a fresh document, so the
      // pass-through reference does not leak into the new doc.
      content: source.content || [],
      icon: source.icon ?? null,
      sortOrder: newSortOrder,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const result = await notesCollection.insertOne(newNote);
    const insertedDoc = { ...newNote, _id: result.insertedId };

    return apiSuccess(formatNote(insertedDoc), 201);
  },
  { label: "POST /api/notes/[noteId]/duplicate" },
);
