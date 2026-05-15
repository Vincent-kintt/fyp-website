import { tool } from "ai";
import { z } from "zod";
import { getCollection } from "@/lib/db.js";
import { isValidStatusTransition, minutesToMs } from "@/lib/utils.js";
import { parseObjectId, textOutput } from "./shared.js";

export function createSnoozeReminderTool(ctx) {
  const { userId, project } = ctx;
  return tool({
    description:
      "Postpone a reminder by a specified duration. Sets status to 'snoozed' and stores snoozedUntil time.",
    inputSchema: z.object({
      reminderId: z.string().describe("The reminder ID to snooze"),
      snoozeDuration: z
        .number()
        .int()
        .describe("Minutes to snooze (how long to postpone)"),
    }),
    execute: async (params) => {
      const { reminderId, snoozeDuration } = params;
      const snoozeMinutes = snoozeDuration;
      const oid = parseObjectId(reminderId);
      if (!oid) return { success: false, error: "Invalid reminder ID" };

      const reminders = await getCollection("reminders");
      const reminder = await reminders.findOne({
        _id: oid,
        userId,
      });

      if (!reminder) {
        return { success: false, error: "Reminder not found" };
      }

      const currentStatus = reminder.status || "pending";
      if (!isValidStatusTransition(currentStatus, "snoozed")) {
        return {
          success: false,
          error: `Cannot snooze a reminder with status '${currentStatus}'. Only pending or in-progress reminders can be snoozed.`,
        };
      }

      const newDateTime = new Date(reminder.dateTime);
      newDateTime.setMinutes(newDateTime.getMinutes() + snoozeMinutes);

      const snoozedUntil = new Date(Date.now() + minutesToMs(snoozeMinutes));

      const updated = await reminders.findOneAndUpdate(
        { _id: oid, userId },
        {
          $set: {
            dateTime: newDateTime,
            status: "snoozed",
            completed: false,
            snoozedUntil,
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after" },
      );

      if (!updated) {
        return {
          success: false,
          error: "Reminder not found or update failed",
        };
      }

      return {
        success: true,
        reminder: updated,
        snoozedMinutes: snoozeMinutes,
        snoozedUntil,
      };
    },
    toModelOutput: ({ output }) => {
      if (!output.success) return textOutput(output);
      return textOutput({
        success: true,
        reminder: project(output.reminder),
        snoozedMinutes: output.snoozedMinutes,
        snoozedUntil: output.snoozedUntil,
      });
    },
  });
}
