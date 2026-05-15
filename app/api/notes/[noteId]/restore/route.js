import { ObjectId } from "mongodb";
import { apiSuccess, apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import {
  getNotesCollection,
  formatNote,
  findDescendantIds,
} from "@/lib/notes/db";

export const POST = withAuth(
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
        userId,
        deletedAt: null,
      });
      if (!parent) {
        restoreParentId = null;
      }
    }

    const descendantIds = await findDescendantIds(
      notesCollection,
      userId,
      noteObjectId,
    );
    const allIds = [noteObjectId, ...descendantIds];

    await notesCollection.updateMany(
      { _id: { $in: allIds }, userId },
      { $set: { deletedAt: null } },
    );

    if (restoreParentId !== note.parentId) {
      await notesCollection.updateOne(
        { _id: noteObjectId },
        { $set: { parentId: restoreParentId } },
      );
    }

    const restored = await notesCollection.findOne({ _id: noteObjectId });
    return apiSuccess(formatNote(restored));
  },
  { label: "POST /api/notes/[noteId]/restore" },
);
