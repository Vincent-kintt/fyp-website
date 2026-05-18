import { getCollection } from "@/lib/db";
import { ObjectId } from "mongodb";
import {
  getMainCategory,
  isValidStatusTransition,
  validateDuration,
} from "@/lib/utils";
import {
  formatReminder,
  validateReminderFields,
} from "@/lib/reminderUtils";
import { apiSuccess, apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { parseJsonBodyWithSchema } from "@/lib/api/body.js";
import {
  updateReminderSchema,
  patchReminderSchema,
} from "@/lib/schemas/reminder.js";
import { buildReminderDoc } from "@/lib/reminders/buildReminderDoc.js";

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

    const fieldError = validateReminderFields(body);
    if (fieldError) return fieldError;

    if (body.duration !== undefined && body.duration !== null) {
      const durationValidation = validateDuration(body.duration);
      if (!durationValidation.isValid) {
        return apiError(durationValidation.error, 400);
      }
    }

    const remindersCollection = await getCollection("reminders");

    const existing = await remindersCollection.findOne({
      _id: new ObjectId(id),
      userId,
    });

    if (!existing) {
      return apiError("Reminder not found", 404);
    }

    if (body.status !== undefined) {
      const currentStatus = existing.status || "pending";
      if (!isValidStatusTransition(currentStatus, body.status)) {
        return apiError(
          `Invalid status transition from '${currentStatus}' to '${body.status}'`,
          400,
        );
      }
    }

    const updateData = buildReminderDoc({
      mode: "put",
      existing,
      patch: body,
    });

    // H2: embed existing.status in the filter when the body would change
    // status, so two concurrent PUTs against the same baseline can't both
    // succeed. matchedCount === 0 then signals a concurrent change, not a
    // missing document. See CLAUDE.md anti-pattern entry.
    const filter = { _id: new ObjectId(id), userId };
    const isStatusChange = body.status !== undefined;
    if (isStatusChange) {
      filter.status = existing.status || "pending";
    }

    const result = await remindersCollection.updateOne(filter, {
      $set: updateData,
    });

    if (result.matchedCount === 0) {
      if (isStatusChange) {
        return apiError(
          "Reminder status changed by another request, please retry",
          409,
        );
      }
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

    if (body.status !== undefined) {
      const currentStatus = existing.status || "pending";
      if (!isValidStatusTransition(currentStatus, body.status)) {
        return apiError(
          `Invalid status transition from '${currentStatus}' to '${body.status}'`,
          400,
        );
      }
      if (body.status === "snoozed" && !body.snoozedUntil) {
        return apiError("snoozedUntil is required when snoozing", 400);
      }
    } else if (typeof body.completed === "boolean") {
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
    }

    if (body.duration !== undefined) {
      const durationValidation = validateDuration(body.duration);
      if (!durationValidation.isValid) {
        return apiError(durationValidation.error, 400);
      }
    }

    const updateData = buildReminderDoc({
      mode: "patch",
      existing,
      patch: body,
    });

    // H2: embed existing.status in the filter when the patch would change
    // status (explicit body.status, or the legacy completed boolean). Two
    // concurrent status writes against the same baseline can otherwise both
    // pass JS-side validation and both succeed; the second is an invalid
    // transition already authorized. matchedCount === 0 then signals a
    // concurrent change. See CLAUDE.md anti-pattern entry.
    const filter = { _id: new ObjectId(id), userId };
    const isStatusChange =
      body.status !== undefined || typeof body.completed === "boolean";
    if (isStatusChange) {
      filter.status = existing.status || "pending";
    }

    const result = await remindersCollection.updateOne(filter, {
      $set: updateData,
    });

    if (result.matchedCount === 0) {
      if (isStatusChange) {
        return apiError(
          "Reminder status changed by another request, please retry",
          409,
        );
      }
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
