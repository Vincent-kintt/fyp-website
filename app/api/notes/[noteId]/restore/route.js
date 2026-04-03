import { auth } from "@/auth";
import { ObjectId } from "mongodb";
import { apiSuccess, apiError } from "@/lib/reminderUtils";
import {
  getNotesCollection,
  formatNote,
  findDescendantIds,
} from "@/lib/notes/db";

export async function POST(request, segmentData) {
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

    const note = await notesCollection.findOne({
      _id: noteObjectId,
      userId: session.user.id,
      deletedAt: { $ne: null },
    });

    if (!note) {
      return apiError("Note not found in trash", 404);
    }

    // Check if original parent still exists and is not deleted
    let restoreParentId = note.parentId;
    if (restoreParentId) {
      const parent = await notesCollection.findOne({
        _id: restoreParentId,
        userId: session.user.id,
        deletedAt: null,
      });
      if (!parent) {
        restoreParentId = null;
      }
    }

    // Restore note + all descendants
    const descendantIds = await findDescendantIds(
      notesCollection,
      session.user.id,
      noteObjectId,
    );
    const allIds = [noteObjectId, ...descendantIds];

    await notesCollection.updateMany(
      { _id: { $in: allIds }, userId: session.user.id },
      { $set: { deletedAt: null } },
    );

    // Update parentId if original parent is gone
    if (restoreParentId !== note.parentId) {
      await notesCollection.updateOne(
        { _id: noteObjectId },
        { $set: { parentId: restoreParentId } },
      );
    }

    const restored = await notesCollection.findOne({ _id: noteObjectId });
    return apiSuccess(formatNote(restored));
  } catch (error) {
    console.error("POST /api/notes/[noteId]/restore error:", error);
    return apiError("Internal server error", 500);
  }
}
