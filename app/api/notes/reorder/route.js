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

    // Validate all entries
    for (const item of updates) {
      if (!item.id || !ObjectId.isValid(item.id)) {
        return apiError(`Invalid note ID: ${item.id}`, 400);
      }
      if (typeof item.sortOrder !== "number") {
        return apiError(`sortOrder must be a number for ID: ${item.id}`, 400);
      }
    }

    const notesCollection = await getNotesCollection();
    const now = new Date();

    const ops = updates.map((item) => {
      let resolvedParentId;
      if (item.parentId === undefined || item.parentId === null) {
        resolvedParentId = null;
      } else {
        resolvedParentId = ObjectId.isValid(item.parentId)
          ? new ObjectId(item.parentId)
          : null;
      }

      return {
        updateOne: {
          filter: {
            _id: new ObjectId(item.id),
            userId: session.user.id,
          },
          update: {
            $set: {
              sortOrder: item.sortOrder,
              parentId: resolvedParentId,
              updatedAt: now,
            },
          },
        },
      };
    });

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
