import { tool } from "ai";
import { z } from "zod";
import { getCollection } from "@/lib/db.js";
import { parseObjectId } from "./shared.js";

export function createDeleteReminderTool(ctx) {
  const { userId } = ctx;
  return tool({
    description: "Delete a specific reminder",
    inputSchema: z.object({
      reminderId: z.string().describe("The reminder ID to delete"),
      title: z
        .string()
        .optional()
        .describe("Reminder title for confirmation"),
    }),
    execute: async (params) => {
      const { reminderId } = params;
      const oid = parseObjectId(reminderId);
      if (!oid) return { success: false, error: "Invalid reminder ID" };

      const reminders = await getCollection("reminders");
      const result = await reminders.deleteOne({
        _id: oid,
        userId,
      });

      if (result.deletedCount === 0) {
        return {
          success: false,
          error: "Reminder not found or already deleted",
        };
      }

      return { success: true, message: "Reminder deleted successfully" };
    },
  });
}
