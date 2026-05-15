import { tool } from "ai";
import { z } from "zod";
import { getCollection } from "@/lib/db.js";
import { textOutput } from "./shared.js";

export function createSuggestRemindersTool(ctx) {
  const { userId } = ctx;
  return tool({
    description: "Suggest reminders based on user's patterns and history",
    inputSchema: z.object({
      lookbackDays: z
        .number()
        .int()
        .optional()
        .describe("Days to analyze (default 30)"),
    }),
    execute: async (params) => {
      const { lookbackDays = 30 } = params;

      const lookbackDate = new Date();
      lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

      const reminders = await getCollection("reminders");
      const pastReminders = await reminders
        .find({ userId, dateTime: { $gte: lookbackDate } })
        .sort({ dateTime: -1 })
        .toArray();

      const categoryCount = {};
      const timeSlots = {};
      const recurringPatterns = {};

      pastReminders.forEach((r) => {
        categoryCount[r.category] = (categoryCount[r.category] || 0) + 1;

        const hour = new Date(r.dateTime).getHours();
        const slot =
          hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
        timeSlots[slot] = (timeSlots[slot] || 0) + 1;

        if (r.recurring) {
          recurringPatterns[r.recurringType] =
            (recurringPatterns[r.recurringType] || 0) + 1;
        }
      });

      const dominantSlot = Object.keys(timeSlots).reduce(
        (a, b) => (timeSlots[a] > timeSlots[b] ? a : b),
        "morning",
      );

      return {
        success: true,
        patterns: { categoryCount, timeSlots, recurringPatterns },
        suggestions: [
          "Consider setting recurring reminders for frequent tasks",
          `You create most reminders in the ${dominantSlot}`,
        ],
      };
    },
    toModelOutput: ({ output }) => {
      if (!output.success) return textOutput(output);
      return textOutput({
        success: true,
        patterns: output.patterns,
        suggestions: output.suggestions,
      });
    },
  });
}
