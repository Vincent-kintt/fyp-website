import { getCollection } from "@/lib/db";
import { auth } from "@/auth";
import { ObjectId } from "mongodb";
import { apiSuccess, apiError } from "@/lib/reminderUtils";

// PATCH /api/reminders/reorder - Batch update sortOrder (and optionally dateTime)
export async function PATCH(request) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return apiError("items array is required", 400);
    }

    // Validate all IDs
    for (const item of items) {
      if (!item.id || !ObjectId.isValid(item.id)) {
        return apiError(`Invalid reminder ID: ${item.id}`, 400);
      }
      if (typeof item.sortOrder !== "number") {
        return apiError(`sortOrder must be a number for ID: ${item.id}`, 400);
      }
    }

    const remindersCollection = await getCollection("reminders");

    const ops = items.map((item) => {
      const updateFields = {
        sortOrder: item.sortOrder,
        updatedAt: new Date(),
      };

      // Optional dateTime update (for cross-section drag in Phase 3)
      if (item.dateTime) {
        updateFields.dateTime = new Date(item.dateTime);
        updateFields.notificationSent = false;
      }

      return {
        updateOne: {
          filter: {
            _id: new ObjectId(item.id),
            userId: session.user.id,
          },
          update: { $set: updateFields },
        },
      };
    });

    const result = await remindersCollection.bulkWrite(ops);

    return apiSuccess({
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (error) {
    console.error("PATCH /api/reminders/reorder error:", error);
    return apiError("Internal server error", 500);
  }
}
