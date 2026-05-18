import { tool } from "ai";
import { z } from "zod";
import { getCollection } from "@/lib/db.js";
import {
  normalizeTags,
  getMainCategory,
  validateDuration,
} from "@/lib/utils.js";
import { normalizeSubtasks } from "@/lib/reminderUtils";
import {
  REMINDER_PRIORITY_VALUES,
  REMINDER_RECURRING_TYPE_VALUES,
} from "@/lib/schemas/reminder.js";
import { textOutput } from "./shared.js";

// zod 4: ISO 8601 with optional offset — accepts "2026-05-20T09:00:00Z" and
// "2026-05-20T09:00:00+08:00". Shared with REST schema so AI cannot send a
// malformed string the API would reject.
const dateTimeString = z.iso.datetime({ offset: true });

export async function createReminderImpl(ctx, params) {
  const { userId, toUTC } = ctx;
  const {
    title,
    description,
    remark,
    dateTime,
    duration,
    category,
    tags,
    recurring,
    recurringType,
    priority,
    subtasks,
  } = params;

  const reminders = await getCollection("reminders");

  if (duration !== undefined) {
    const durationValidation = validateDuration(duration);
    if (!durationValidation.isValid) {
      return { success: false, error: durationValidation.error };
    }
  }

  const processedSubtasks = normalizeSubtasks(subtasks, { preserveIds: false });
  const processedTags = normalizeTags(tags || []);
  const effectiveCategory =
    category || getMainCategory(processedTags) || "personal";

  const result = await reminders.insertOne({
    title,
    description: description || "",
    remark: remark || "",
    dateTime: dateTime ? toUTC(dateTime) : null,
    duration: duration || null,
    category: effectiveCategory,
    tags: processedTags,
    recurring: recurring || false,
    recurringType: recurringType || null,
    priority: priority || "medium",
    subtasks: processedSubtasks,
    userId,
    status: "pending",
    completed: false,
    inboxState: "processed",
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const reminder = await reminders.findOne({ _id: result.insertedId, userId });
  return { success: true, reminder };
}

export function createCreateReminderTool(ctx) {
  const { project } = ctx;
  return tool({
    description:
      "Create a new reminder with title, datetime, duration for time blocking, tags for categorization, priority, and optional subtasks. Use tags like 'work', 'personal', 'urgent', 'project-name' for flexible organization.",
    inputSchema: z.object({
      title: z.string().describe("The reminder title"),
      description: z.string().optional().describe("Optional description"),
      remark: z
        .string()
        .optional()
        .describe("Additional notes or information for the reminder"),
      dateTime: dateTimeString
        .nullable()
        .optional()
        .describe("ISO 8601 datetime (with Z or +HH:mm offset), or null if no date"),
      duration: z
        .number()
        .int()
        .optional()
        .describe(
          "Estimated duration in minutes for time blocking (e.g., 30, 60, 90). Helps with scheduling and calendar visualization.",
        ),
      tags: z
        .array(z.string())
        .optional()
        .describe(
          "Custom tags for categorization. Examples: ['work', 'meeting'], ['personal', 'urgent'], ['health', 'exercise']. Tags are auto-normalized (lowercase, no spaces).",
        ),
      category: z
        .string()
        .optional()
        .describe("work|personal|health|other (legacy, prefer tags)"),
      priority: z
        .enum(REMINDER_PRIORITY_VALUES)
        .optional()
        .describe("Priority level (default: medium)"),
      subtasks: z
        .array(z.string())
        .optional()
        .describe("Array of subtask titles"),
      recurring: z.boolean().optional().describe("Is recurring"),
      recurringType: z
        .enum(REMINDER_RECURRING_TYPE_VALUES)
        .optional()
        .describe("Recurring type"),
    }),
    execute: (params) => createReminderImpl(ctx, params),
    toModelOutput: ({ output }) => {
      if (!output.success) return textOutput(output);
      return textOutput({
        success: true,
        reminder: project(output.reminder),
      });
    },
  });
}
