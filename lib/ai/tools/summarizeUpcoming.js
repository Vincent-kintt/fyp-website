import { tool } from "ai";
import { z } from "zod";
import { getCollection } from "@/lib/db.js";
import { textOutput } from "./shared.js";

export function createSummarizeUpcomingTool(ctx) {
  const { userId, project } = ctx;
  return tool({
    description:
      "Summarize upcoming reminders and tasks grouped by date, category, or priority",
    inputSchema: z.object({
      period: z
        .enum(["today", "tomorrow", "week", "month"])
        .optional()
        .default("today")
        .describe("Time period"),
      groupBy: z
        .enum(["category", "date", "priority"])
        .optional()
        .default("date")
        .describe("Grouping method"),
    }),
    execute: async (params) => {
      const { period = "today", groupBy = "date" } = params;

      const now = new Date();
      let endDate = new Date(now);

      if (period === "today") {
        endDate.setHours(23, 59, 59, 999);
      } else if (period === "tomorrow") {
        endDate.setDate(endDate.getDate() + 1);
        endDate.setHours(23, 59, 59, 999);
      } else if (period === "week") {
        endDate.setDate(endDate.getDate() + 7);
      } else if (period === "month") {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      const remindersCollection = await getCollection("reminders");
      const reminders = await remindersCollection
        .find({
          userId,
          dateTime: { $gte: now, $lte: endDate },
          completed: false,
        })
        .sort({ dateTime: 1 })
        .toArray();

      const grouped = {};
      reminders.forEach((r) => {
        const key =
          groupBy === "category"
            ? r.category
            : groupBy === "priority"
              ? r.priority || "medium"
              : r.dateTime.toISOString().split("T")[0];
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(r);
      });

      return {
        success: true,
        summary: grouped,
        total: reminders.length,
        period,
      };
    },
    toModelOutput: ({ output }) => {
      if (!output.success) return textOutput(output);
      const compactSummary = {};
      for (const [key, items] of Object.entries(output.summary)) {
        compactSummary[key] = items.map(project);
      }
      return textOutput({
        success: true,
        total: output.total,
        period: output.period,
        summary: compactSummary,
      });
    },
  });
}
