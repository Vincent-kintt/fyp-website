import { tool } from "ai";
import { z } from "zod";
import { getCollection } from "@/lib/db.js";
import { validateDuration } from "@/lib/utils.js";
import {
  REMINDER_PRIORITY_VALUES,
  REMINDER_RECURRING_TYPE_VALUES,
} from "@/lib/schemas/reminder.js";
import { buildReminderDoc } from "@/lib/reminders/buildReminderDoc.js";
import { textOutput, sessionFromCtx } from "./shared.js";

// zod 4: ISO 8601 with optional offset — accepts "2026-05-20T09:00:00Z" and
// "2026-05-20T09:00:00+08:00". Shared with REST schema so AI cannot send a
// malformed string the API would reject.
const dateTimeString = z.iso.datetime({ offset: true });

export async function createReminderImpl(ctx, params) {
  const { toUTC } = ctx;
  const { dateTime, duration } = params;

  if (duration !== undefined) {
    const durationValidation = validateDuration(duration);
    if (!durationValidation.isValid) {
      return { success: false, error: durationValidation.error };
    }
  }

  // toUTC retained as the canonical entry — strict z.iso.datetime({offset:true})
  // already forces absolute strings, but naiveToUTC accepts both branches and
  // keeps the AI write path symmetrical with the HTTP form path.
  const reminders = await getCollection("reminders");
  const doc = buildReminderDoc({
    mode: "create",
    patch: { ...params, dateTime: dateTime ? toUTC(dateTime) : null },
    session: sessionFromCtx(ctx),
  });

  const result = await reminders.insertOne(doc);
  const reminder = await reminders.findOne({
    _id: result.insertedId,
    userId: ctx.userId,
  });
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
