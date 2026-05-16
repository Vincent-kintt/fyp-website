import { ObjectId } from "mongodb";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { parseJsonBodyWithSchema } from "@/lib/api/body.js";
import { getNotesCollection } from "@/lib/notes/db";

const notesReorderSchema = z
  .object({
    updates: z
      .array(z.object({}).loose(), { error: "updates array is required" })
      .min(1, "updates array is required"),
  })
  .superRefine((data, ctx) => {
    for (const item of data.updates) {
      if (!item.id || !ObjectId.isValid(item.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Invalid note ID: ${item.id}`,
        });
        return;
      }
      if (typeof item.sortOrder !== "number") {
        ctx.addIssue({
          code: "custom",
          message: `sortOrder must be a number for ID: ${item.id}`,
        });
        return;
      }
      if (item.parentId !== undefined && item.parentId !== null) {
        if (!ObjectId.isValid(item.parentId)) {
          ctx.addIssue({
            code: "custom",
            message: `Invalid parentId format: ${item.parentId}`,
          });
          return;
        }
      }
    }
  });

// POST /api/notes/reorder - Batch update sortOrder and parentId
export const POST = withAuth(
  async ({ request, userId }) => {
    const { data: body, error } = await parseJsonBodyWithSchema(
      request,
      notesReorderSchema,
    );
    if (error) return error;
    const { updates } = body;

    const notesCollection = await getNotesCollection();

    const userNotes = await notesCollection
      .find({ userId, deletedAt: null })
      .project({ _id: 1, parentId: 1, type: 1 })
      .toArray();

    const inboxNote = userNotes.find((n) => n.type === "inbox");
    const inboxId = inboxNote?._id.toString();

    const filteredUpdates = inboxId
      ? updates.filter((item) => item.id !== inboxId)
      : updates;

    if (filteredUpdates.length === 0) {
      return apiSuccess({ matched: 0, modified: 0 });
    }

    const noteIdSet = new Set(userNotes.map((n) => n._id.toString()));

    const parentMap = new Map();
    for (const note of userNotes) {
      parentMap.set(note._id.toString(), note.parentId?.toString() || null);
    }
    for (const item of filteredUpdates) {
      if (item.parentId !== undefined) {
        parentMap.set(item.id, item.parentId || null);
      }
    }

    for (const item of filteredUpdates) {
      const resolvedParentId = item.parentId || null;
      if (!resolvedParentId) continue;

      if (item.id === resolvedParentId) {
        return apiError(`Note ${item.id} cannot be its own parent`, 400);
      }

      if (!noteIdSet.has(resolvedParentId)) {
        return apiError(`Parent not found: ${resolvedParentId}`, 400);
      }

      const visited = new Set();
      let current = resolvedParentId;
      while (current) {
        if (current === item.id) {
          return apiError(
            `Circular reference: ${item.id} is an ancestor of ${resolvedParentId}`,
            400,
          );
        }
        if (visited.has(current)) break;
        visited.add(current);
        current = parentMap.get(current) || null;
      }
    }

    const now = new Date();
    const ops = filteredUpdates.map((item) => ({
      updateOne: {
        filter: {
          _id: new ObjectId(item.id),
          userId,
          deletedAt: null,
        },
        update: {
          $set: {
            sortOrder: item.sortOrder,
            parentId: item.parentId ? new ObjectId(item.parentId) : null,
            updatedAt: now,
          },
        },
      },
    }));

    const result = await notesCollection.bulkWrite(ops);

    return apiSuccess({
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  },
  { label: "POST /api/notes/reorder" },
);
