import { tool } from "ai";
import { z } from "zod";
import { getCollection } from "@/lib/db.js";
import { normalizeTags } from "@/lib/utils.js";
import { startOfDay, startOfWeek, endOfWeek, startOfMonth } from "date-fns";
import { textOutput } from "./shared.js";

export async function listRemindersImpl(ctx, params) {
  const { userId } = ctx;
  const { filter = "all", tag, tags: filterTags, status } = params;

  const now = new Date();
  const query = { userId };

  if (filter === "today") {
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    query.dateTime = { $gte: startOfDay(now), $lte: endOfDay };
  } else if (filter === "week") {
    const weekOpts = { weekStartsOn: 1 };
    query.dateTime = {
      $gte: startOfWeek(now, weekOpts),
      $lte: endOfWeek(now, weekOpts),
    };
  } else if (filter === "month") {
    const endOfMonth = new Date(now);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    query.dateTime = { $gte: startOfMonth(now), $lte: endOfMonth };
  }

  if (tag) {
    query.tags = tag;
  }

  if (filterTags && Array.isArray(filterTags) && filterTags.length > 0) {
    const normalizedFilterTags = normalizeTags(filterTags);
    if (query.$and) {
      query.$and.push({ tags: { $all: normalizedFilterTags } });
    } else if (query.tags) {
      query.$and = [
        { tags: query.tags },
        { tags: { $all: normalizedFilterTags } },
      ];
      delete query.tags;
    } else {
      query.tags = { $all: normalizedFilterTags };
    }
  }

  if (status && status !== "all") {
    if (["pending", "in_progress", "completed", "snoozed"].includes(status)) {
      query.status = status;
    }
  }

  const reminders = await getCollection("reminders");
  const results = await reminders
    .find(query)
    .sort({ dateTime: 1 })
    .limit(50)
    .toArray();

  return { success: true, reminders: results, count: results.length };
}

export function createListRemindersTool(ctx) {
  const { project } = ctx;
  return tool({
    description:
      "Query and list reminders based on filters. Can filter by time period, tags, or status lifecycle.",
    inputSchema: z.object({
      filter: z
        .enum(["today", "week", "month", "all"])
        .optional()
        .default("all")
        .describe("Time filter"),
      tag: z
        .string()
        .optional()
        .describe("Filter by a single tag (e.g., 'work', 'urgent')"),
      tags: z
        .array(z.string())
        .optional()
        .describe(
          "Filter by multiple tags - reminders must have ALL specified tags",
        ),
      status: z
        .enum(["pending", "in_progress", "completed", "snoozed", "all"])
        .optional()
        .describe("Filter by status lifecycle"),
    }),
    execute: (params) => listRemindersImpl(ctx, params),
    toModelOutput: ({ output }) => {
      if (!output.success) return textOutput(output);
      const compact = output.reminders.map((r) => ({
        ...project(r),
        category: r.category,
      }));
      return textOutput({
        success: true,
        count: output.count,
        reminders: compact,
      });
    },
  });
}
