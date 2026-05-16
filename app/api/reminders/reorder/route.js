import { getCollection } from "@/lib/db";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { parseJsonBodyWithSchema } from "@/lib/api/body.js";

const reminderReorderSchema = z
  .object({
    items: z
      .array(z.object({}).loose(), { error: "items array is required" })
      .min(1, "items array is required"),
  })
  .superRefine((data, ctx) => {
    for (const item of data.items) {
      if (typeof item.id !== "string" || !ObjectId.isValid(item.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Invalid reminder ID: ${item.id}`,
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
    }
  });

// PATCH /api/reminders/reorder - Batch update sortOrder (and optionally dateTime)
export const PATCH = withAuth(
  async ({ request, userId }) => {
    const { data: body, error } = await parseJsonBodyWithSchema(
      request,
      reminderReorderSchema,
    );
    if (error) return error;
    const { items } = body;

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
