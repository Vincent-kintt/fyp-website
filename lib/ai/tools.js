import { tool } from "ai";
import { z } from "zod";
import { getCollection } from "@/lib/db.js";
import { ObjectId } from "mongodb";
import {
  normalizeTags,
  getMainCategory,
  isValidStatus,
  isValidStatusTransition,
  deriveCompletedFromStatus,
  validateDuration,
  calculateEndTime,
  hasTimeOverlap,
} from "@/lib/utils.js";
import { startOfDay, startOfWeek, endOfWeek, startOfMonth } from "date-fns";
import { normalizeSubtasks } from "@/lib/reminderUtils";

function parseObjectId(id) {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

// AI SDK v6: toModelOutput must return { type: 'text', value: string } | { type: 'json', value: JSONValue }
function textOutput(obj) {
  return { type: "text", value: typeof obj === "string" ? obj : JSON.stringify(obj) };
}

function projectReminder(r) {
  const dateStr = r.dateTime
    ? new Date(r.dateTime).toISOString().slice(0, 16).replace("T", " ")
    : "No date";
  return {
    id: r._id?.toString(),
    title: r.title,
    dateTime: dateStr,
    status: r.status,
    priority: r.priority,
    tags: r.tags,
    duration: r.duration,
  };
}

export function createTools(userId) {
  const tools = {};

  Object.assign(tools, {
    createReminder: tool({
      description:
        "Create a new reminder with title, datetime, duration for time blocking, tags for categorization, priority, and optional subtasks. Use tags like 'work', 'personal', 'urgent', 'project-name' for flexible organization.",
      inputSchema: z.object({
        title: z.string().describe("The reminder title"),
        description: z.string().optional().describe("Optional description"),
        remark: z
          .string()
          .optional()
          .describe("Additional notes or information for the reminder"),
        dateTime: z.string().nullable().optional().describe("ISO format YYYY-MM-DDTHH:mm, or null if no date"),
        duration: z
          .number()
          .int()
          .optional()
          .describe(
            "Estimated duration in minutes for time blocking (e.g., 30, 60, 90). Helps with scheduling and calendar visualization.",
          ),
        tags: z
          .array(z.string())
          .optional()
          .describe(
            "Custom tags for categorization. Examples: ['work', 'meeting'], ['personal', 'urgent'], ['health', 'exercise']. Tags are auto-normalized (lowercase, no spaces).",
          ),
        category: z
          .string()
          .optional()
          .describe("work|personal|health|other (legacy, prefer tags)"),
        priority: z
          .enum(["low", "medium", "high"])
          .optional()
          .describe("Priority level (default: medium)"),
        subtasks: z
          .array(z.string())
          .optional()
          .describe("Array of subtask titles"),
        recurring: z.boolean().optional().describe("Is recurring"),
        recurringType: z
          .enum(["daily", "weekly", "monthly", "yearly"])
          .optional()
          .describe("Recurring type"),
      }),
      execute: async (params) => {
        const {
          title,
          description,
          remark,
          dateTime,
          duration,
          category,
          tags,
          recurring,
          recurringType,
          priority,
          subtasks,
        } = params;

        const reminders = await getCollection("reminders");

        if (duration !== undefined) {
          const durationValidation = validateDuration(duration);
          if (!durationValidation.isValid) {
            return { success: false, error: durationValidation.error };
          }
        }

        const processedSubtasks = normalizeSubtasks(subtasks, { preserveIds: false });

        const processedTags = normalizeTags(tags || []);
        const effectiveCategory =
          category || getMainCategory(processedTags) || "personal";

        const result = await reminders.insertOne({
          title,
          description: description || "",
          remark: remark || "",
          dateTime: dateTime ? new Date(dateTime) : null,
          duration: duration || null,
          category: effectiveCategory,
          tags: processedTags,
          recurring: recurring || false,
          recurringType: recurringType || null,
          priority: priority || "medium",
          subtasks: processedSubtasks,
          userId: userId,
          status: "pending",
          completed: false,
          inboxState: "processed",
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const reminder = await reminders.findOne({ _id: result.insertedId });
        return { success: true, reminder };
      },
      toModelOutput: ({ output }) => {
        if (!output.success) return textOutput(output);
        return textOutput({
          success: true,
          reminder: projectReminder(output.reminder),
        });
      },
    }),

    listReminders: tool({
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
      execute: async (params) => {
        const { filter = "all", tag, tags: filterTags, status } = params;

        const now = new Date();
        const query = { userId: userId };

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
          if (
            ["pending", "in_progress", "completed", "snoozed"].includes(status)
          ) {
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
      },
      toModelOutput: ({ output }) => {
        if (!output.success) return textOutput(output);
        const compact = output.reminders.map((r) => ({
          ...projectReminder(r),
          category: r.category,
        }));
        return textOutput({
          success: true,
          count: output.count,
          reminders: compact,
        });
      },
    }),

    updateReminder: tool({
      description:
        "Update an existing reminder. Use this to modify tags, add subtasks, change title, priority, status, duration, etc.",
      inputSchema: z.object({
        reminderId: z.string().describe("The reminder ID to update"),
        title: z.string().optional().describe("New title"),
        description: z.string().optional().describe("New description"),
        remark: z.string().optional().describe("New remark/additional notes"),
        dateTime: z.string().optional().describe("New datetime in ISO format"),
        duration: z
          .number()
          .int()
          .optional()
          .describe("Estimated duration in minutes"),
        status: z
          .enum(["pending", "in_progress", "completed", "snoozed"])
          .optional()
          .describe(
            "New status. Use 'in_progress' when starting a task, 'completed' when done.",
          ),
        tags: z
          .array(z.string())
          .optional()
          .describe("New tags array. This REPLACES existing tags."),
        category: z.string().optional().describe("New category (legacy)"),
        priority: z
          .enum(["low", "medium", "high"])
          .optional()
          .describe("Priority level"),
        subtasks: z
          .array(z.string())
          .optional()
          .describe(
            "Array of subtask titles to set. This REPLACES existing subtasks.",
          ),
      }),
      execute: async (params) => {
        const {
          reminderId,
          title,
          description,
          remark,
          dateTime,
          duration,
          status,
          category,
          tags,
          priority,
          subtasks,
        } = params;

        const oid = parseObjectId(reminderId);
        if (!oid) return { success: false, error: "Invalid reminder ID" };

        const reminders = await getCollection("reminders");

        const currentReminder = await reminders.findOne({
          _id: oid,
          userId: userId,
        });
        if (!currentReminder) {
          return { success: false, error: "Reminder not found" };
        }

        const updateData = { updatedAt: new Date() };
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (remark !== undefined) updateData.remark = remark;
        if (dateTime) updateData.dateTime = new Date(dateTime);

        if (duration !== undefined) {
          const durationValidation = validateDuration(duration);
          if (!durationValidation.isValid) {
            return { success: false, error: durationValidation.error };
          }
          updateData.duration = duration;
        }

        if (status !== undefined) {
          if (!isValidStatus(status)) {
            return {
              success: false,
              error: `Invalid status: ${status}. Valid values: pending, in_progress, completed, snoozed`,
            };
          }
          const currentStatus = currentReminder.status || "pending";
          if (!isValidStatusTransition(currentStatus, status)) {
            return {
              success: false,
              error: `Invalid status transition from '${currentStatus}' to '${status}'`,
            };
          }
          updateData.status = status;
          updateData.completed = deriveCompletedFromStatus(status);

          if (status === "in_progress" && currentStatus !== "in_progress") {
            updateData.startedAt = new Date();
          }
          if (status === "completed" && currentStatus !== "completed") {
            updateData.completedAt = new Date();
          }
        }

        if (category) updateData.category = category;
        if (tags !== undefined) {
          updateData.tags = normalizeTags(tags);
        }
        if (priority) updateData.priority = priority;
        if (subtasks !== undefined) {
          updateData.subtasks = normalizeSubtasks(subtasks);
        }

        const updated = await reminders.findOneAndUpdate(
          { _id: oid, userId: userId },
          { $set: updateData },
          { returnDocument: "after" },
        );

        if (!updated) {
          return { success: false, error: "Reminder not found" };
        }

        return { success: true, reminder: updated };
      },
      toModelOutput: ({ output }) => {
        if (!output.success) return textOutput(output);
        return textOutput({
          success: true,
          reminder: {
            ...projectReminder(output.reminder),
            description: output.reminder.description,
            remark: output.reminder.remark,
          },
        });
      },
    }),

    deleteReminder: tool({
      description: "Delete a specific reminder",
      inputSchema: z.object({
        reminderId: z.string().describe("The reminder ID to delete"),
        title: z
          .string()
          .optional()
          .describe("Reminder title for confirmation"),
      }),
      execute: async (params) => {
        const { reminderId } = params;
        const oid = parseObjectId(reminderId);
        if (!oid) return { success: false, error: "Invalid reminder ID" };

        const reminders = await getCollection("reminders");
        const result = await reminders.deleteOne({
          _id: oid,
          userId: userId,
        });

        if (result.deletedCount === 0) {
          return {
            success: false,
            error: "Reminder not found or already deleted",
          };
        }

        return { success: true, message: "Reminder deleted successfully" };
      },
    }),

    snoozeReminder: tool({
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
          userId: userId,
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

        const snoozedUntil = new Date(Date.now() + snoozeMinutes * 60 * 1000);

        const updated = await reminders.findOneAndUpdate(
          { _id: oid, userId: userId },
          {
            $set: {
              dateTime: newDateTime,
              status: "snoozed",
              completed: false,
              snoozedUntil: snoozedUntil,
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
          reminder: projectReminder(output.reminder),
          snoozedMinutes: output.snoozedMinutes,
          snoozedUntil: output.snoozedUntil,
        });
      },
    }),

    suggestReminders: tool({
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
          .find({ userId: userId, dateTime: { $gte: lookbackDate } })
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
    }),

    findConflicts: tool({
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
          return { conflicts: [], message: "No dateTime provided — cannot check conflicts" };
        }

        const checkTime = new Date(dateTime);
        const checkDuration = duration || 60;

        const dayStart = new Date(checkTime);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(checkTime);
        dayEnd.setHours(23, 59, 59, 999);

        const reminders = await getCollection("reminders");
        const dayReminders = await reminders
          .find({
            userId: userId,
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
            new Date(latestConflict.getTime() + 15 * 60 * 1000).toISOString(),
          );
          suggestedTimes.push(
            new Date(
              checkTime.getTime() - checkDuration * 60 * 1000 - 15 * 60 * 1000,
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
    }),

    batchCreate: tool({
      description:
        "Create multiple reminders at once. Each reminder can have priority, duration, and subtasks.",
      inputSchema: z.object({
        reminders: z
          .array(
            z.object({
              title: z.string(),
              dateTime: z.string().nullable().optional().describe("ISO format YYYY-MM-DDTHH:mm"),
              tags: z.array(z.string()).optional(),
              category: z.string().optional(),
              priority: z.enum(["low", "medium", "high"]).optional(),
              duration: z
                .number()
                .int()
                .optional()
                .describe("Duration in minutes"),
              subtasks: z.array(z.string()).optional(),
            }),
          )
          .describe("Array of reminder objects to create"),
        pattern: z
          .string()
          .optional()
          .describe("Recurring pattern description (optional)"),
      }),
      execute: async (params) => {
        const { reminders: remindersList = [], pattern } = params;

        if (!Array.isArray(remindersList) || remindersList.length === 0) {
          return {
            success: false,
            error: "reminders array is required and must not be empty",
          };
        }

        if (remindersList.length > 50) {
          return {
            success: false,
            error: "Cannot create more than 50 reminders at once",
          };
        }

        const reminders = await getCollection("reminders");
        const docs = remindersList.map((r, docIdx) => {
          const processedSubtasks = normalizeSubtasks(r.subtasks, { preserveIds: false, batchIndex: docIdx });

          const processedTags = normalizeTags(r.tags || []);
          const effectiveCategory =
            r.category || getMainCategory(processedTags) || "personal";

          return {
            title: r.title,
            description: r.description || "",
            remark: r.remark || "",
            dateTime: r.dateTime ? new Date(r.dateTime) : null,
            duration: r.duration || null,
            category: effectiveCategory,
            tags: processedTags,
            priority: r.priority || "medium",
            subtasks: processedSubtasks,
            userId: userId,
            status: "pending",
            completed: false,
            inboxState: "processed",
            sortOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        });

        const result = await reminders.insertMany(docs);

        return { success: true, count: result.insertedCount, pattern };
      },
    }),

    analyzePatterns: tool({
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
          .find({ userId: userId, createdAt: { $gte: startDate } })
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
    }),

    summarizeUpcoming: tool({
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
            userId: userId,
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
        // Return compact summary: group keys + counts only, not full reminder objects
        const compactSummary = {};
        for (const [key, items] of Object.entries(output.summary)) {
          compactSummary[key] = items.map(projectReminder);
        }
        return textOutput({
          success: true,
          total: output.total,
          period: output.period,
          summary: compactSummary,
        });
      },
    }),

    exportReminders: tool({
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

        function escapeCsvField(value) {
          if (value == null) return "";
          const str = String(value);
          const dangerousPrefixes = ["=", "+", "-", "@", "\t", "\r", "\n"];
          let safe = str;
          if (dangerousPrefixes.some((p) => str.startsWith(p))) {
            safe = "'" + str;
          }
          // Always quote and escape internal double quotes
          return '"' + safe.replace(/"/g, '""') + '"';
        }

        // Reuse listReminders execute via closure
        const listResult = await tools.listReminders.execute({ filter });
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
    }),

    setQuickReminder: tool({
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

        // Reuse createReminder execute via closure
        return tools.createReminder.execute({
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
          reminder: projectReminder(output.reminder),
        });
      },
    }),

    templateCreate: tool({
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

        const templates = {
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

        const template = templates[templateName];
        if (!template) {
          return { success: false, error: "Template not found" };
        }

        const reminderData = { ...template, ...customizations };

        if (!reminderData.dateTime) {
          const defaultTime = new Date();
          defaultTime.setHours(9, 0, 0, 0);
          reminderData.dateTime = defaultTime.toISOString();
        }

        // Reuse createReminder execute via closure
        return tools.createReminder.execute(reminderData);
      },
      toModelOutput: ({ output }) => {
        if (!output.success) return textOutput(output);
        return textOutput({
          success: true,
          reminder: projectReminder(output.reminder),
        });
      },
    }),

    askClarification: tool({
      description:
        "Ask the user for more information when the request is unclear or ambiguous. This pauses the agent loop to wait for user input.",
      inputSchema: z.object({
        question: z.string().describe("The question to ask the user"),
        context: z
          .string()
          .optional()
          .describe("What information is needed and why"),
      }),
      execute: async (params) => {
        const { question, context } = params;
        return { success: true, question, context };
      },
    }),

    searchWeb: tool({
      description:
        "Search the web for real-time information like weather, news, events, or any current data. Use this when you need up-to-date information that you don't have.",
      inputSchema: z.object({
        query: z.string().describe("The search query to look up"),
      }),
      execute: async (params) => {
        const { query } = params;
        const apiKey = process.env.PERPLEXITY_API_KEY;

        if (!apiKey) {
          return {
            success: false,
            error:
              "Perplexity API key is missing. Please add PERPLEXITY_API_KEY to .env.local",
          };
        }

        try {
          const response = await fetch(
            "https://api.perplexity.ai/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: "sonar",
                messages: [
                  {
                    role: "system",
                    content:
                      "You are a helpful search assistant. Provide accurate, up-to-date information based on web search results. Be concise.",
                  },
                  {
                    role: "user",
                    content: query,
                  },
                ],
                temperature: 0.2,
                top_p: 0.9,
                stream: false,
              }),
            },
          );

          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(
              `Perplexity API error: ${response.status} - ${errorData}`,
            );
          }

          const data = await response.json();
          const content =
            data.choices?.[0]?.message?.content || "No results found.";
          const citations = data.citations || [];

          return {
            success: true,
            results: [
              {
                title: "Perplexity Search Result",
                snippet: content,
                citations: citations,
              },
            ],
          };
        } catch (error) {
          console.error("Error performing web search:", error);
          return {
            success: false,
            error: `Search failed: ${error.message}`,
          };
        }
      },
    }),
  });

  return tools;
}
