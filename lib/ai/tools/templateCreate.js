import { tool } from "ai";
import { z } from "zod";
import { textOutput } from "./shared.js";
import { createReminderImpl } from "./createReminder.js";

const TEMPLATES = {
  "daily-review": {
    title: "Daily Review",
    description: "Review today's accomplishments and plan tomorrow",
    category: "personal",
    recurring: true,
    recurringType: "daily",
  },
  "weekly-meeting": {
    title: "Weekly Team Meeting",
    description: "Weekly sync with the team",
    category: "work",
    recurring: true,
    recurringType: "weekly",
  },
  medication: {
    title: "Take Medication",
    description: "Daily medication reminder",
    category: "health",
    recurring: true,
    recurringType: "daily",
  },
  exercise: {
    title: "Exercise Time",
    description: "Daily workout session",
    category: "health",
    recurring: true,
    recurringType: "daily",
  },
};

export function createTemplateCreateTool(ctx) {
  const { project } = ctx;
  return tool({
    description:
      "Create reminder from predefined template (daily-review, weekly-meeting, medication, exercise)",
    inputSchema: z.object({
      templateName: z
        .enum(["daily-review", "weekly-meeting", "medication", "exercise"])
        .describe("Template name"),
      customizations: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Custom overrides for the template (optional)"),
    }),
    execute: async (params) => {
      const { templateName, customizations = {} } = params;

      const template = TEMPLATES[templateName];
      if (!template) {
        return { success: false, error: "Template not found" };
      }

      const reminderData = { ...template, ...customizations };

      if (!reminderData.dateTime) {
        const defaultTime = new Date();
        defaultTime.setHours(9, 0, 0, 0);
        reminderData.dateTime = defaultTime.toISOString();
      }

      return createReminderImpl(ctx, reminderData);
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
