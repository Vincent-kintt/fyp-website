import { tool } from "ai";
import { z } from "zod";
import { getCollection } from "@/lib/db.js";
import {
  calculateEndTime,
  hasTimeOverlap,
  minutesToMs,
} from "@/lib/utils.js";
import { textOutput } from "./shared.js";

export function createFindConflictsTool(ctx) {
  const { userId, toUTC } = ctx;
  return tool({
    description:
      "Detect time conflicts in upcoming reminders for a given datetime",
    inputSchema: z.object({
      dateTime: z
        .string()
        .describe("Datetime to check for conflicts (ISO format)"),
      duration: z
        .number()
        .int()
        .optional()
        .describe("Estimated duration in minutes (optional, default 60)"),
    }),
    execute: async (params) => {
      const { dateTime, duration = 60 } = params;

      if (!dateTime) {
        return {
          conflicts: [],
          message: "No dateTime provided — cannot check conflicts",
        };
      }

      const checkTime = toUTC(dateTime);
      const checkDuration = duration || 60;

      const dayStart = new Date(checkTime);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(checkTime);
      dayEnd.setHours(23, 59, 59, 999);

      const reminders = await getCollection("reminders");
      const dayReminders = await reminders
        .find({
          userId,
          dateTime: { $gte: dayStart, $lte: dayEnd },
          status: { $nin: ["completed"] },
          completed: { $ne: true },
        })
        .toArray();

      const conflicts = dayReminders.filter((r) => {
        const rDuration = r.duration || 30;
        return hasTimeOverlap(
          checkTime,
          checkDuration,
          new Date(r.dateTime),
          rDuration,
        );
      });

      const suggestedTimes = [];
      if (conflicts.length > 0) {
        const latestConflict = conflicts.reduce((latest, c) => {
          const endTime = calculateEndTime(c.dateTime, c.duration || 30);
          return endTime > latest ? endTime : latest;
        }, new Date(0));

        suggestedTimes.push(
          new Date(latestConflict.getTime() + minutesToMs(15)).toISOString(),
        );
        suggestedTimes.push(
          new Date(
            checkTime.getTime() - minutesToMs(checkDuration) - minutesToMs(15),
          ).toISOString(),
        );
      }

      return {
        success: true,
        hasConflicts: conflicts.length > 0,
        conflicts,
        suggestedTimes,
      };
    },
    toModelOutput: ({ output }) => {
      if (!output.success) return textOutput(output);
      return textOutput({
        success: true,
        hasConflicts: output.hasConflicts,
        conflicts: output.conflicts.map((r) => ({
          id: r._id?.toString(),
          title: r.title,
          dateTime: r.dateTime,
          duration: r.duration,
          status: r.status,
          priority: r.priority,
        })),
        suggestedTimes: output.suggestedTimes,
      });
    },
  });
}
