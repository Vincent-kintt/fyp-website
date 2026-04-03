import { auth } from "@/auth";
import { ObjectId } from "mongodb";
import { apiSuccess, apiError } from "@/lib/reminderUtils";
import {
  getNotesCollection,
  formatNote,
  findDescendantIds,
} from "@/lib/notes/db";

// GET /api/notes/[noteId] - Get a single note by ID
export async function GET(request, segmentData) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return apiError("Unauthorized", 401);
    }

    const { noteId } = await segmentData.params;

    if (!ObjectId.isValid(noteId)) {
      return apiError("Invalid note ID", 400);
    }

    const notesCollection = await getNotesCollection();
    const note = await notesCollection.findOne({
      _id: new ObjectId(noteId),
      userId: session.user.id,
      deletedAt: null,
    });

    if (!note) {
      return apiError("Note not found", 404);
    }

    return apiSuccess(formatNote(note));
  } catch (error) {
    console.error("GET /api/notes/[noteId] error:", error);
    return apiError("Internal server error", 500);
  }
}

// PATCH /api/notes/[noteId] - Partial update (title, content, parentId, icon, sortOrder)
export async function PATCH(request, segmentData) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return apiError("Unauthorized", 401);
    }

    const { noteId } = await segmentData.params;

    if (!ObjectId.isValid(noteId)) {
      return apiError("Invalid note ID", 400);
    }

    const body = await request.json();
    const { title, content, parentId, icon, sortOrder } = body;

    // Build update object with only provided fields
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
      if (!Array.isArray(content)) return apiError("content must be an array", 400);
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

    if (updateData.parentId) {
      const parentExists = await notesCollection.findOne({ _id: updateData.parentId, userId: session.user.id });
      if (!parentExists) return apiError("Parent note not found", 404);
    }

    const updated = await notesCollection.findOneAndUpdate(
      { _id: new ObjectId(noteId), userId: session.user.id },
      { $set: updateData },
      { returnDocument: "after" },
    );

    if (!updated) {
      return apiError("Note not found", 404);
    }

    return apiSuccess(formatNote(updated));
  } catch (error) {
    console.error("PATCH /api/notes/[noteId] error:", error);
    return apiError("Internal server error", 500);
  }
}

// DELETE /api/notes/[noteId] - Delete note and all descendants
export async function DELETE(request, segmentData) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return apiError("Unauthorized", 401);
    }

    const { noteId } = await segmentData.params;

    if (!ObjectId.isValid(noteId)) {
      return apiError("Invalid note ID", 400);
    }

    const notesCollection = await getNotesCollection();
    const noteObjectId = new ObjectId(noteId);

    // Verify note exists and belongs to user
    const note = await notesCollection.findOne({
      _id: noteObjectId,
      userId: session.user.id,
    });

    if (!note) {
      return apiError("Note not found", 404);
    }

    // Check if note is already in trash
    if (note.deletedAt) {
      // Permanent delete — already trashed
      const descendantIds = await findDescendantIds(
        notesCollection,
        session.user.id,
        noteObjectId,
      );
      const allIds = [noteObjectId, ...descendantIds];
      const result = await notesCollection.deleteMany({
        _id: { $in: allIds },
        userId: session.user.id,
      });
      return apiSuccess({ deleted: result.deletedCount });
    } else {
      // Soft delete — set deletedAt on note + descendants
      const descendantIds = await findDescendantIds(
        notesCollection,
        session.user.id,
        noteObjectId,
      );
      const allIds = [noteObjectId, ...descendantIds];
      const now = new Date();
      const result = await notesCollection.updateMany(
        { _id: { $in: allIds }, userId: session.user.id },
        { $set: { deletedAt: now } },
      );
      return apiSuccess({ deleted: result.modifiedCount });
    }
  } catch (error) {
    console.error("DELETE /api/notes/[noteId] error:", error);
    return apiError("Internal server error", 500);
  }
}
