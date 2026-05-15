import { tool } from "ai";
import { z } from "zod";
import { textOutput } from "./shared.js";
import { listRemindersImpl } from "./listReminders.js";

function escapeCsvField(value) {
  if (value == null) return "";
  const str = String(value);
  const dangerousPrefixes = ["=", "+", "-", "@", "\t", "\r", "\n"];
  let safe = str;
  if (dangerousPrefixes.some((p) => str.startsWith(p))) {
    safe = "'" + str;
  }
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function createExportRemindersTool(ctx) {
  return tool({
    description: "Export reminders to various formats (JSON, CSV, ICS)",
    inputSchema: z.object({
      format: z.enum(["json", "csv"]).describe("Export format"),
      filter: z
        .enum(["today", "week", "month", "all"])
        .optional()
        .describe("Time filter"),
    }),
    execute: async (params) => {
      const { format = "json", filter = "all" } = params;

      const listResult = await listRemindersImpl(ctx, { filter });
      const reminders = listResult.reminders;

      if (format === "json") {
        return { success: true, data: reminders, format: "json" };
      } else if (format === "csv") {
        const csv = [
          "Title,Description,DateTime,Category,Completed",
          ...reminders.map((r) =>
            [r.title, r.description, r.dateTime, r.category, r.completed]
              .map(escapeCsvField)
              .join(","),
          ),
        ].join("\n");
        return { success: true, data: csv, format: "csv" };
      }

      return { success: false, error: "Unsupported format" };
    },
    toModelOutput: ({ output }) => {
      if (!output.success) return textOutput(output);
      if (output.format === "json") {
        const compact = Array.isArray(output.data)
          ? output.data.map((r) => ({
              id: r._id?.toString(),
              title: r.title,
              dateTime: r.dateTime,
              category: r.category,
              completed: r.completed,
            }))
          : output.data;
        return textOutput({
          success: true,
          format: output.format,
          data: compact,
        });
      }
      return textOutput(output);
    },
  });
}
