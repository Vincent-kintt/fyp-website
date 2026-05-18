import { tool } from "ai";
import { z } from "zod";
import { getCollection } from "@/lib/db.js";
import { isValidStatusTransition, validateDuration } from "@/lib/utils.js";
import {
  REMINDER_STATUS_VALUES,
  REMINDER_PRIORITY_VALUES,
} from "@/lib/schemas/reminder.js";
import { buildReminderDoc } from "@/lib/reminders/buildReminderDoc.js";
import { parseObjectId, textOutput } from "./shared.js";

const dateTimeString = z.iso.datetime({ offset: true });

export function createUpdateReminderTool(ctx) {
  const { userId, toUTC, project } = ctx;
  return tool({
    description:
      "Update an existing reminder. Use this to modify tags, add subtasks, change title, priority, status, duration, etc.",
    inputSchema: z.object({
      reminderId: z.string().describe("The reminder ID to update"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      remark: z.string().optional().describe("New remark/additional notes"),
      dateTime: dateTimeString
        .optional()
        .describe("New datetime in ISO 8601 format (with Z or +HH:mm offset)"),
      duration: z
        .number()
        .int()
        .optional()
        .describe("Estimated duration in minutes"),
      status: z
        .enum(REMINDER_STATUS_VALUES)
        .optional()
        .describe(
          "New status. Use 'in_progress' when starting a task, 'completed' when done.",
        ),
      tags: z
        .array(z.string())
        .optional()
        .describe("New tags array. This REPLACES existing tags."),
      category: z.string().optional().describe("New category (legacy)"),
      priority: z
        .enum(REMINDER_PRIORITY_VALUES)
        .optional()
        .describe("Priority level"),
      subtasks: z
        .array(z.string())
        .optional()
        .describe(
          "Array of subtask titles to set. This REPLACES existing subtasks.",
        ),
    }),
    execute: async (params) => {
      const { reminderId, dateTime, duration, status } = params;

      const oid = parseObjectId(reminderId);
      if (!oid) return { success: false, error: "Invalid reminder ID" };

      const reminders = await getCollection("reminders");

      const currentReminder = await reminders.findOne({
        _id: oid,
        userId,
      });
      if (!currentReminder) {
        return { success: false, error: "Reminder not found" };
      }

      // Mirror HTTP PATCH route gate so AI cannot bypass status-machine rules.
      if (status !== undefined) {
        const currentStatus = currentReminder.status || "pending";
        if (!isValidStatusTransition(currentStatus, status)) {
          return {
            success: false,
            error: `Invalid status transition from '${currentStatus}' to '${status}'`,
          };
        }
      }

      if (duration !== undefined) {
        const durationValidation = validateDuration(duration);
        if (!durationValidation.isValid) {
          return { success: false, error: durationValidation.error };
        }
      }

      const patch = {
        ...params,
        ...(dateTime !== undefined ? { dateTime: toUTC(dateTime) } : {}),
      };
      delete patch.reminderId;

      const updateData = buildReminderDoc({
        mode: "patch",
        existing: currentReminder,
        patch,
      });

      const updated = await reminders.findOneAndUpdate(
        { _id: oid, userId },
        { $set: updateData },
        { returnDocument: "after" },
      );

      if (!updated) {
        return { success: false, error: "Reminder not found" };
      }

      return { success: true, reminder: updated };
    },
    toModelOutput: ({ output }) => {
      if (!output.success) return textOutput(output);
      return textOutput({
        success: true,
        reminder: {
          ...project(output.reminder),
          description: output.reminder.description,
          remark: output.reminder.remark,
        },
      });
    },
  });
}
