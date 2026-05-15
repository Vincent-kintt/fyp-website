import { tool } from "ai";
import { z } from "zod";
import { getCollection } from "@/lib/db.js";

export function createAnalyzePatternsTool(ctx) {
  const { userId } = ctx;
  return tool({
    description:
      "Analyze user's reminder patterns and habits (frequency, categories, timing, completion rate)",
    inputSchema: z.object({
      analysisType: z
        .enum(["frequency", "categories", "completion"])
        .optional()
        .default("frequency")
        .describe("Type of analysis"),
      period: z
        .enum(["week", "month", "all"])
        .optional()
        .default("month")
        .describe("Time period to analyze"),
    }),
    execute: async (params) => {
      const { analysisType = "frequency", period = "month" } = params;

      let startDate = new Date();
      if (period === "week") {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === "month") {
        startDate.setMonth(startDate.getMonth() - 1);
      } else {
        startDate = new Date(0);
      }

      const remindersCollection = await getCollection("reminders");
      const reminders = await remindersCollection
        .find({ userId, createdAt: { $gte: startDate } })
        .toArray();

      const analysis = {};

      if (analysisType === "frequency") {
        analysis.totalReminders = reminders.length;
        analysis.averagePerWeek = (
          reminders.length /
          Math.ceil((Date.now() - startDate) / (7 * 24 * 60 * 60 * 1000))
        ).toFixed(1);
      } else if (analysisType === "categories") {
        analysis.byCategory = reminders.reduce((acc, r) => {
          acc[r.category] = (acc[r.category] || 0) + 1;
          return acc;
        }, {});
      } else if (analysisType === "completion") {
        const completed = reminders.filter((r) => r.completed).length;
        analysis.completionRate =
          ((completed / reminders.length) * 100).toFixed(1) + "%";
      }

      return { success: true, analysis, period };
    },
  });
}
