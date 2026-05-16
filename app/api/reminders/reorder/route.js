import { getCollection } from "@/lib/db";
import { ObjectId } from "mongodb";
import { apiSuccess, apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { parseJsonBody } from "@/lib/api/body.js";

// PATCH /api/reminders/reorder - Batch update sortOrder (and optionally dateTime)
export const PATCH = withAuth(
  async ({ request, userId }) => {
    const { data: body, error } = await parseJsonBody(request);
    if (error) return error;
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return apiError("items array is required", 400);
    }

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

      if (item.dateTime) {
        updateFields.dateTime = new Date(item.dateTime);
        updateFields.notificationSent = false;
      }

      return {
        updateOne: {
          filter: { _id: new ObjectId(item.id), userId },
          update: { $set: updateFields },
        },
      };
    });

    const result = await remindersCollection.bulkWrite(ops);

    return apiSuccess({
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  },
  { label: "PATCH /api/reminders/reorder" },
);
