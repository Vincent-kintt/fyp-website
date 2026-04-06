import { auth } from "@/auth";
import { ObjectId } from "mongodb";
import { apiSuccess, apiError } from "@/lib/reminderUtils";
import { getNotesCollection } from "@/lib/notes/db";

// POST /api/notes/reorder - Batch update sortOrder and parentId
export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json();
    const { updates } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return apiError("updates array is required", 400);
    }

    // Basic field validation
    for (const item of updates) {
      if (!item.id || !ObjectId.isValid(item.id)) {
        return apiError(`Invalid note ID: ${item.id}`, 400);
      }
      if (typeof item.sortOrder !== "number") {
        return apiError(`sortOrder must be a number for ID: ${item.id}`, 400);
      }
      if (item.parentId !== undefined && item.parentId !== null) {
        if (!ObjectId.isValid(item.parentId)) {
          return apiError(`Invalid parentId format: ${item.parentId}`, 400);
        }
      }
    }

    const notesCollection = await getNotesCollection();

    // Fetch all user's notes for relationship validation
    const userNotes = await notesCollection
      .find({ userId: session.user.id, deletedAt: null })
      .project({ _id: 1, parentId: 1, type: 1 })
      .toArray();

    // Find inbox note to exclude from reorder
    const inboxNote = userNotes.find((n) => n.type === "inbox");
    const inboxId = inboxNote?._id.toString();

    const filteredUpdates = inboxId
      ? updates.filter((item) => item.id !== inboxId)
      : updates;

    if (filteredUpdates.length === 0) {
      return apiSuccess({ matched: 0, modified: 0 });
    }

    const noteIdSet = new Set(userNotes.map((n) => n._id.toString()));

    // Build parent map reflecting pending updates
    const parentMap = new Map();
    for (const note of userNotes) {
      parentMap.set(note._id.toString(), note.parentId?.toString() || null);
    }
    for (const item of filteredUpdates) {
      if (item.parentId !== undefined) {
        parentMap.set(item.id, item.parentId || null);
      }
    }

    // Validate each update with a parentId
    for (const item of filteredUpdates) {
      const resolvedParentId = item.parentId || null;
      if (!resolvedParentId) continue;

      if (item.id === resolvedParentId) {
        return apiError(`Note ${item.id} cannot be its own parent`, 400);
      }

      if (!noteIdSet.has(resolvedParentId)) {
        return apiError(`Parent not found: ${resolvedParentId}`, 400);
      }

      // Circular reference check
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
          userId: session.user.id,
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
  } catch (error) {
    console.error("POST /api/notes/reorder error:", error);
    return apiError("Internal server error", 500);
  }
}
