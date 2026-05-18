// Shared reminder zod schemas — single source of truth for create/update/patch
// request validation across REST routes (POST/PUT/PATCH) and AI tools.
//
// Rationale: H5 (datetime accepted any string) and L2 (priority/status/category/
// recurringType were loose z.string()) both stem from each route declaring its
// own schema. This module centralises the enum lists and the dateTime contract
// so a single change is enough.

import { z } from "zod";
import { REMINDER_STATUSES, REMINDER_CATEGORIES } from "@/lib/utils.js";

// Re-export canonical enum tuples for callers that want the raw lists.
export const REMINDER_STATUS_VALUES = REMINDER_STATUSES;
export const REMINDER_PRIORITY_VALUES = ["low", "medium", "high"];
export const REMINDER_RECURRING_TYPE_VALUES = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
];
// REMINDER_CATEGORIES is ["work","personal","health"]; "other" is the synthetic
// fallback returned by getMainCategory when no canonical tag matches.
export const REMINDER_CATEGORY_VALUES = [...REMINDER_CATEGORIES, "other"];

// zod 4: z.iso.datetime({ offset: true }) accepts both "...Z" and "...+08:00"
// per the package.json zod ^4.3.6 — see https://zod.dev/api?id=iso-datetime
const dateTimeString = z.iso.datetime({
  offset: true,
  message: "dateTime must be an ISO 8601 datetime string",
});

// Fields shared by create + update + patch. Each schema below extends from this
// base; create/update mark `title` required, patch keeps everything optional.
export const baseReminderSchema = z.object({
  description: z.string().optional(),
  remark: z.string().optional(),
  dateTime: dateTimeString.nullable().optional(),
  duration: z.number().nullable().optional(),
  status: z.enum(REMINDER_STATUS_VALUES).optional(),
  category: z.enum(REMINDER_CATEGORY_VALUES).optional(),
  tags: z.array(z.string()).optional(),
  recurring: z.boolean().optional(),
  recurringType: z.enum(REMINDER_RECURRING_TYPE_VALUES).nullable().optional(),
  priority: z.enum(REMINDER_PRIORITY_VALUES).optional(),
  subtasks: z.array(z.unknown()).optional(),
  sortOrder: z.number().optional(),
  inboxState: z.string().optional(),
});

export const createReminderSchema = baseReminderSchema.extend({
  title: z
    .string({ error: "Missing required field (title)" })
    .min(1, "Missing required field (title)"),
});

export const updateReminderSchema = baseReminderSchema.extend({
  title: z
    .string({ error: "Missing required field (title)" })
    .min(1, "Missing required field (title)"),
});

export const patchReminderSchema = baseReminderSchema.partial().extend({
  title: z.string().optional(),
  completed: z.boolean().optional(),
  snoozedUntil: dateTimeString.nullable().optional(),
});
