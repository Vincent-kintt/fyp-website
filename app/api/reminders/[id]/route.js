import { getCollection } from "@/lib/db";
import { ObjectId } from "mongodb";
import { z } from "zod";
import {
  normalizeTags,
  getMainCategory,
  isValidStatus,
  isValidStatusTransition,
  deriveCompletedFromStatus,
  validateDuration,
} from "@/lib/utils";
import {
  formatReminder,
  normalizeSubtasks,
  validateReminderFields,
} from "@/lib/reminderUtils";
import { apiSuccess, apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { parseJsonBodyWithSchema } from "@/lib/api/body.js";

const updateReminderSchema = z.object({
  title: z
    .string({ error: "Missing required field (title)" })
    .min(1, "Missing required field (title)"),
  description: z.string().optional(),
  remark: z.string().optional(),
  dateTime: z.string().nullable().optional(),
  duration: z.number().nullable().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  recurring: z.boolean().optional(),
  recurringType: z.string().nullable().optional(),
  priority: z.string().optional(),
  subtasks: z.array(z.unknown()).optional(),
});

const patchReminderSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  remark: z.string().optional(),
  dateTime: z.string().nullable().optional(),
  duration: z.number().nullable().optional(),
  status: z.string().optional(),
  completed: z.boolean().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.string().optional(),
  sortOrder: z.number().optional(),
  subtasks: z.array(z.unknown()).optional(),
  snoozedUntil: z.string().nullable().optional(),
});

// GET /api/reminders/[id] - Get a single reminder (must belong to user)
export const GET = withAuth(
  async ({ params, userId }) => {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return apiError("Invalid reminder ID", 400);
    }

    const remindersCollection = await getCollection("reminders");
    const reminder = await remindersCollection.findOne({
      _id: new ObjectId(id),
      userId,
    });

    if (!reminder) {
      return apiError("Reminder not found", 404);
    }

    return apiSuccess(formatReminder(reminder));
  },
  { label: "GET /api/reminders/[id]" },
);

// PUT /api/reminders/[id] - Update a reminder (must belong to user)
export const PUT = withAuth(
  async ({ request, params, userId }) => {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return apiError("Invalid reminder ID", 400);
    }

    const { data: body, error } = await parseJsonBodyWithSchema(
      request,
      updateReminderSchema,
    );
    if (error) return error;
    const {
      title,
      description,
      remark,
      dateTime,
      duration,
      status,
      category,
      tags,
      recurring,
      recurringType,
      priority,
      subtasks,
    } = body;

    const fieldError = validateReminderFields({
      title,
      description,
      remark,
      tags,
    });
    if (fieldError) return fieldError;

    if (duration !== undefined && duration !== null) {
      const durationValidation = validateDuration(duration);
      if (!durationValidation.isValid) {
        return apiError(durationValidation.error, 400);
      }
    }

    if (status !== undefined && !isValidStatus(status)) {
      return apiError(
        `Invalid status: ${status}. Valid values: pending, in_progress, completed, snoozed`,
        400,
      );
    }

    const processedTags = normalizeTags(tags || []);
    const effectiveCategory =
      category || getMainCategory(processedTags) || "personal";

    const remindersCollection = await getCollection("reminders");

    const existing = await remindersCollection.findOne({
      _id: new ObjectId(id),
      userId,
    });

    if (!existing) {
      return apiError("Reminder not found", 404);
    }

    if (status !== undefined) {
      const currentStatus = existing.status || "pending";
      if (!isValidStatusTransition(currentStatus, status)) {
        return apiError(
          `Invalid status transition from '${currentStatus}' to '${status}'`,
          400,
        );
      }
    }

    const updateData = {
      title,
      description: description || "",
      remark: remark || "",
      dateTime: dateTime ? new Date(dateTime) : null,
      duration: duration || null,
      category: effectiveCategory,
      tags: processedTags,
      recurring: recurring || false,
      recurringType: recurring ? recurringType : null,
      priority: priority || "medium",
      notificationSent: false,
      subtasks: normalizeSubtasks(subtasks),
      updatedAt: new Date(),
    };

    if (status !== undefined) {
      updateData.status = status;
      updateData.completed = deriveCompletedFromStatus(status);
    }

    if (existing.inboxState === "inbox") {
      if (updateData.dateTime || updateData.status === "completed") {
        updateData.inboxState = "processed";
      }
    }

    const result = await remindersCollection.updateOne(
      { _id: new ObjectId(id), userId },
      { $set: updateData },
    );

    if (result.matchedCount === 0) {
      return apiError("Reminder not found", 404);
    }

    const updatedReminder = await remindersCollection.findOne({
      _id: new ObjectId(id),
      userId,
    });

    return apiSuccess(formatReminder(updatedReminder));
  },
  { label: "PUT /api/reminders/[id]" },
);

// DELETE /api/reminders/[id] - Delete a reminder (must belong to user)
export const DELETE = withAuth(
  async ({ params, userId }) => {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return apiError("Invalid reminder ID", 400);
    }

    const remindersCollection = await getCollection("reminders");

    const reminder = await remindersCollection.findOne({
      _id: new ObjectId(id),
      userId,
    });

    if (!reminder) {
      return apiError("Reminder not found", 404);
    }

    const result = await remindersCollection.deleteOne({
      _id: new ObjectId(id),
      userId,
    });

    if (result.deletedCount === 0) {
      return apiError("Failed to delete reminder", 500);
    }

    // Intentionally stripped-down response for DELETE
    const formattedReminder = {
      id: reminder._id.toString(),
      title: reminder.title,
      description: reminder.description,
      dateTime: reminder.dateTime,
      category: reminder.category || getMainCategory(reminder.tags),
      tags: reminder.tags || [],
      recurring: reminder.recurring,
      recurringType: reminder.recurringType,
      completed: reminder.completed || false,
    };

    return apiSuccess(formattedReminder);
  },
  { label: "DELETE /api/reminders/[id]" },
);

// PATCH /api/reminders/[id] - Partial update (e.g., toggle completed)
export const PATCH = withAuth(
  async ({ request, params, userId }) => {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return apiError("Invalid reminder ID", 400);
    }

    const { data: body, error } = await parseJsonBodyWithSchema(
      request,
      patchReminderSchema,
    );
    if (error) return error;

    const fieldError = validateReminderFields(body);
    if (fieldError) return fieldError;

    const remindersCollection = await getCollection("reminders");

    const existing = await remindersCollection.findOne({
      _id: new ObjectId(id),
      userId,
    });

    if (!existing) {
      return apiError("Reminder not found", 404);
    }

    const updateData = { updatedAt: new Date() };

    if (body.status !== undefined) {
      if (!isValidStatus(body.status)) {
        return apiError(`Invalid status: ${body.status}`, 400);
      }

      const currentStatus = existing.status || "pending";
      if (!isValidStatusTransition(currentStatus, body.status)) {
        return apiError(
          `Invalid status transition from '${currentStatus}' to '${body.status}'`,
          400,
        );
      }

      updateData.status = body.status;
      updateData.completed = deriveCompletedFromStatus(body.status);

      if (body.status === "in_progress" && currentStatus !== "in_progress") {
        updateData.startedAt = new Date();
      }
      if (body.status === "completed" && currentStatus !== "completed") {
        updateData.completedAt = new Date();
      }

      if (body.status === "snoozed") {
        if (!body.snoozedUntil) {
          return apiError("snoozedUntil is required when snoozing", 400);
        }
        updateData.snoozedUntil = new Date(body.snoozedUntil);
      }

      if (currentStatus === "snoozed" && body.status !== "snoozed") {
        updateData.snoozedUntil = null;
      }
    } else if (typeof body.completed === "boolean") {
      // Backward compatibility: handle completed boolean
      const currentStatus = existing.status || "pending";
      const targetStatus = body.completed
        ? "completed"
        : currentStatus === "completed"
          ? "pending"
          : currentStatus;

      if (!isValidStatusTransition(currentStatus, targetStatus)) {
        return apiError(
          `Invalid status transition from '${currentStatus}' to '${targetStatus}'`,
          400,
        );
      }

      updateData.completed = body.completed;
      updateData.status = targetStatus;

      if (body.completed) {
        updateData.completedAt = new Date();
      }

      if (currentStatus === "snoozed" && targetStatus !== "snoozed") {
        updateData.snoozedUntil = null;
      }
    }

    if (body.duration !== undefined) {
      const durationValidation = validateDuration(body.duration);
      if (!durationValidation.isValid) {
        return apiError(durationValidation.error, 400);
      }
      updateData.duration = body.duration;
    }

    if (body.title) updateData.title = body.title;
    if (body.description !== undefined)
      updateData.description = body.description;
    if (body.remark !== undefined) updateData.remark = body.remark;
    if (body.dateTime) {
      updateData.dateTime = new Date(body.dateTime);
      updateData.notificationSent = false;
    }
    if (body.category) updateData.category = body.category;
    if (body.tags !== undefined)
      updateData.tags = normalizeTags(body.tags || []);
    if (body.priority) updateData.priority = body.priority;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (body.subtasks !== undefined) {
      updateData.subtasks = normalizeSubtasks(body.subtasks);
    }

    if (existing.inboxState === "inbox") {
      if (updateData.dateTime || updateData.status === "completed") {
        updateData.inboxState = "processed";
      }
    }

    const result = await remindersCollection.updateOne(
      { _id: new ObjectId(id), userId },
      { $set: updateData },
    );

    if (result.matchedCount === 0) {
      return apiError("Reminder not found", 404);
    }

    const updatedReminder = await remindersCollection.findOne({
      _id: new ObjectId(id),
      userId,
    });

    return apiSuccess(formatReminder(updatedReminder));
  },
  { label: "PATCH /api/reminders/[id]" },
);
