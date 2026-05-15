import { ObjectId } from "mongodb";
import { apiSuccess, apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import {
  getNotesCollection,
  formatNote,
  findDescendantIds,
} from "@/lib/notes/db";

// GET /api/notes/[noteId] - Get a single note by ID
export const GET = withAuth(
  async ({ params, userId }) => {
    const { noteId } = await params;

    if (!ObjectId.isValid(noteId)) {
      return apiError("Invalid note ID", 400);
    }

    const notesCollection = await getNotesCollection();
    const note = await notesCollection.findOne({
      _id: new ObjectId(noteId),
      userId,
      deletedAt: null,
    });

    if (!note) {
      return apiError("Note not found", 404);
    }

    return apiSuccess(formatNote(note));
  },
  { label: "GET /api/notes/[noteId]" },
);

// PATCH /api/notes/[noteId] - Partial update (title, content, parentId, icon, sortOrder)
export const PATCH = withAuth(
  async ({ request, params, userId }) => {
    const { noteId } = await params;

    if (!ObjectId.isValid(noteId)) {
      return apiError("Invalid note ID", 400);
    }

    const body = await request.json();
    const { title, content, parentId, icon, sortOrder } = body;

    const updateData = { updatedAt: new Date() };

    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0) {
        return apiError("Title must be a non-empty string", 400);
      }
      if (title.length > 200) {
        return apiError("Title must be 200 characters or less", 400);
      }
      updateData.title = title.trim();
    }

    if (content !== undefined) {
      if (!Array.isArray(content))
        return apiError("content must be an array", 400);
      updateData.content = content;
    }

    if (icon !== undefined) {
      updateData.icon = icon;
    }

    if (sortOrder !== undefined) {
      updateData.sortOrder = sortOrder;
    }

    if (parentId !== undefined) {
      if (parentId === null) {
        updateData.parentId = null;
      } else {
        if (!ObjectId.isValid(parentId)) {
          return apiError("Invalid parentId", 400);
        }
        updateData.parentId = new ObjectId(parentId);
      }
    }

    const notesCollection = await getNotesCollection();

    // Guard: prevent modifying inbox document properties via generic route
    const existingNote = await notesCollection.findOne({
      _id: new ObjectId(noteId),
      userId,
    });
    if (existingNote?.type === "inbox") {
      if (
        title !== undefined ||
        parentId !== undefined ||
        sortOrder !== undefined
      ) {
        return apiError("Cannot modify inbox note properties", 403);
      }
    }

    if (updateData.parentId) {
      const parentExists = await notesCollection.findOne({
        _id: updateData.parentId,
        userId,
      });
      if (!parentExists) return apiError("Parent note not found", 404);
    }

    const updated = await notesCollection.findOneAndUpdate(
      { _id: new ObjectId(noteId), userId },
      { $set: updateData },
      { returnDocument: "after" },
    );

    if (!updated) {
      return apiError("Note not found", 404);
    }

    return apiSuccess(formatNote(updated));
  },
  { label: "PATCH /api/notes/[noteId]" },
);

// DELETE /api/notes/[noteId] - Delete note and all descendants
export const DELETE = withAuth(
  async ({ params, userId }) => {
    const { noteId } = await params;

    if (!ObjectId.isValid(noteId)) {
      return apiError("Invalid note ID", 400);
    }

    const notesCollection = await getNotesCollection();
    const noteObjectId = new ObjectId(noteId);

    const note = await notesCollection.findOne({
      _id: noteObjectId,
      userId,
    });

    if (!note) {
      return apiError("Note not found", 404);
    }

    if (note.type === "inbox") {
      return apiError("Cannot delete inbox note", 403);
    }

    if (note.deletedAt) {
      // Permanent delete — already trashed
      const descendantIds = await findDescendantIds(
        notesCollection,
        userId,
        noteObjectId,
      );
      const allIds = [noteObjectId, ...descendantIds];
      const result = await notesCollection.deleteMany({
        _id: { $in: allIds },
        userId,
      });
      return apiSuccess({ deleted: result.deletedCount });
    } else {
      // Soft delete
      const descendantIds = await findDescendantIds(
        notesCollection,
        userId,
        noteObjectId,
      );
      const allIds = [noteObjectId, ...descendantIds];
      const now = new Date();
      const result = await notesCollection.updateMany(
        { _id: { $in: allIds }, userId },
        { $set: { deletedAt: now } },
      );
      return apiSuccess({ deleted: result.modifiedCount });
    }
  },
  { label: "DELETE /api/notes/[noteId]" },
);
