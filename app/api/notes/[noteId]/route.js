import { ObjectId } from "mongodb";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { parseJsonBodyWithSchema } from "@/lib/api/body.js";
import {
  getNotesCollection,
  formatNote,
  findDescendantIds,
} from "@/lib/notes/db";

const updateNoteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title must be a non-empty string")
    .max(200, "Title must be 200 characters or less")
    .optional(),
  content: z.array(z.unknown(), { error: "content must be an array" }).optional(),
  parentId: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  sortOrder: z.string().min(1).optional(),
});

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

    const { data: body, error } = await parseJsonBodyWithSchema(
      request,
      updateNoteSchema,
    );
    if (error) return error;
    const { title, content, parentId, icon, sortOrder } = body;

    const updateData = { updatedAt: new Date() };

    if (title !== undefined) {
      updateData.title = title;
    }

    if (content !== undefined) {
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
        if (parentId === noteId) {
          return apiError("Cannot set note as its own parent", 400);
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

      // Cycle prevention: reject if the proposed parent is a descendant of
      // this note. Without this, findDescendantIds (recursive, no visited-set)
      // would unbounded-recurse on subsequent DELETE.
      const cycleCheck = await notesCollection
        .aggregate([
          { $match: { _id: new ObjectId(noteId), userId } },
          {
            $graphLookup: {
              from: "notes",
              startWith: "$_id",
              connectFromField: "_id",
              connectToField: "parentId",
              as: "descendants",
              restrictSearchWithMatch: { userId },
            },
          },
          { $project: { descendantIds: "$descendants._id" } },
        ])
        .toArray();
      const descendantIds = cycleCheck[0]?.descendantIds || [];
      if (descendantIds.some((id) => id.equals(updateData.parentId))) {
        return apiError("Cannot move note under one of its descendants", 400);
      }
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
