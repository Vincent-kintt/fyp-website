import { tool } from "ai";
import { z } from "zod";
import { textOutput } from "./shared.js";
import { createReminderImpl } from "./createReminder.js";

export function createSetQuickReminderTool(ctx) {
  const { project } = ctx;
  return tool({
    description:
      "Quickly set a reminder with minimal info using relative time (minutes from now)",
    inputSchema: z.object({
      title: z.string().describe("Brief title"),
      minutesFromNow: z.number().int().describe("Minutes from current time"),
      tags: z.array(z.string()).optional().describe("Optional tags"),
    }),
    execute: async (params) => {
      const { title, minutesFromNow, tags } = params;

      const dateTime = new Date();
      dateTime.setMinutes(dateTime.getMinutes() + minutesFromNow);

      return createReminderImpl(ctx, {
        title,
        dateTime: dateTime.toISOString(),
        category: "personal",
        tags: tags || [],
        recurring: false,
      });
    },
    toModelOutput: ({ output }) => {
      if (!output.success) return textOutput(output);
      return textOutput({
        success: true,
        reminder: project(output.reminder),
      });
    },
  });
}
