import { tool } from "ai";
import { z } from "zod";
import { getCollection } from "@/lib/db.js";
import { normalizeTags, getMainCategory } from "@/lib/utils.js";
import { normalizeSubtasks } from "@/lib/reminderUtils";
import { REMINDER_PRIORITY_VALUES } from "@/lib/schemas/reminder.js";

const dateTimeString = z.iso.datetime({ offset: true });

export function createBatchCreateTool(ctx) {
  const { userId, toUTC } = ctx;
  return tool({
    description:
      "Create multiple reminders at once. Each reminder can have priority, duration, and subtasks.",
    inputSchema: z.object({
      reminders: z
        .array(
          z.object({
            title: z.string(),
            dateTime: dateTimeString
              .nullable()
              .optional()
              .describe("ISO 8601 datetime (with Z or +HH:mm offset)"),
            tags: z.array(z.string()).optional(),
            category: z.string().optional(),
            priority: z.enum(REMINDER_PRIORITY_VALUES).optional(),
            duration: z
              .number()
              .int()
              .optional()
              .describe("Duration in minutes"),
            subtasks: z.array(z.string()).optional(),
          }),
        )
        .describe("Array of reminder objects to create"),
      pattern: z
        .string()
        .optional()
        .describe("Recurring pattern description (optional)"),
    }),
    execute: async (params) => {
      const { reminders: remindersList = [], pattern } = params;

      if (!Array.isArray(remindersList) || remindersList.length === 0) {
        return {
          success: false,
          error: "reminders array is required and must not be empty",
        };
      }

      if (remindersList.length > 50) {
        return {
          success: false,
          error: "Cannot create more than 50 reminders at once",
        };
      }

      const reminders = await getCollection("reminders");
      const docs = remindersList.map((r, docIdx) => {
        const processedSubtasks = normalizeSubtasks(r.subtasks, {
          preserveIds: false,
          batchIndex: docIdx,
        });

        const processedTags = normalizeTags(r.tags || []);
        const effectiveCategory =
          r.category || getMainCategory(processedTags) || "personal";

        return {
          title: r.title,
          description: r.description || "",
          remark: r.remark || "",
          dateTime: r.dateTime ? toUTC(r.dateTime) : null,
          duration: r.duration || null,
          category: effectiveCategory,
          tags: processedTags,
          priority: r.priority || "medium",
          subtasks: processedSubtasks,
          userId,
          status: "pending",
          completed: false,
          inboxState: "processed",
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      const result = await reminders.insertMany(docs);

      return { success: true, count: result.insertedCount, pattern };
    },
  });
}
