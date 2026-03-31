import { getCollection } from "@/lib/db";
import { auth } from "@/auth";
import { ObjectId } from "mongodb";
import {
  normalizeTags,
  getMainCategory,
  isValidStatus,
  isValidStatusTransition,
  deriveCompletedFromStatus,
  validateDuration
} from "@/lib/utils";
import { formatReminder, normalizeSubtasks, apiSuccess, apiError } from "@/lib/reminderUtils";

// GET /api/reminders/[id] - Get a single reminder (must belong to user)
export async function GET(request, { params }) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return apiError("Unauthorized", 401);
    }

    const { id } = await params;

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return apiError("Invalid reminder ID", 400);
    }

    const remindersCollection = await getCollection("reminders");
    const reminder = await remindersCollection.findOne({
      _id: new ObjectId(id),
      userId: session.user.id, // Ensure reminder belongs to user
    });

    if (!reminder) {
      return apiError("Reminder not found", 404);
    }

    return apiSuccess(formatReminder(reminder));
  } catch (error) {
    console.error("GET /api/reminders/[id] error:", error);
    return apiError(error.message, 500);
  }
}

// PUT /api/reminders/[id] - Update a reminder (must belong to user)
export async function PUT(request, { params }) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return apiError("Unauthorized", 401);
    }

    const { id } = await params;
    const body = await request.json();
    const { title, description, remark, dateTime, duration, status, category, tags, recurring, recurringType, priority, subtasks } = body;

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return apiError("Invalid reminder ID", 400);
    }

    // Validation
    if (!title || !dateTime) {
      return apiError("Missing required fields (title, dateTime)", 400);
    }

    if (title && title.length > 200) {
      return NextResponse.json(
        { success: false, error: "Title must be 200 characters or less" },
        { status: 400 },
      );
    }
    if (description && description.length > 5000) {
      return NextResponse.json(
        {
          success: false,
          error: "Description must be 5000 characters or less",
        },
        { status: 400 },
      );
    }
    if (remark && remark.length > 2000) {
      return NextResponse.json(
        { success: false, error: "Remark must be 2000 characters or less" },
        { status: 400 },
      );
    }
    if (tags && (tags.length > 20 || tags.some((t) => t.length > 50))) {
      return NextResponse.json(
        { success: false, error: "Too many tags or tag too long" },
        { status: 400 },
      );
    }

    // Validate duration if provided
    if (duration !== undefined && duration !== null) {
      const durationValidation = validateDuration(duration);
      if (!durationValidation.isValid) {
        return apiError(durationValidation.error, 400);
      }
    }

    // Validate status if provided
    if (status !== undefined && !isValidStatus(status)) {
      return apiError(`Invalid status: ${status}. Valid values: pending, in_progress, completed, snoozed`, 400);
    }

    // Process tags
    const processedTags = normalizeTags(tags || []);
    const effectiveCategory = category || getMainCategory(processedTags) || "personal";

    const remindersCollection = await getCollection("reminders");

    // Validate status transition if status is being changed
    if (status !== undefined) {
      const currentReminder = await remindersCollection.findOne({
        _id: new ObjectId(id),
        userId: session.user.id,
      });

      if (!currentReminder) {
        return apiError("Reminder not found", 404);
      }

      const currentStatus = currentReminder.status || "pending";
      if (!isValidStatusTransition(currentStatus, status)) {
        return apiError(`Invalid status transition from '${currentStatus}' to '${status}'`, 400);
      }
    }

    const updateData = {
      title,
      description: description || "",
      remark: remark || "",
      dateTime: new Date(dateTime),
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

    // Handle status update
    if (status !== undefined) {
      updateData.status = status;
      updateData.completed = deriveCompletedFromStatus(status);
    }

    const result = await remindersCollection.updateOne(
      {
        _id: new ObjectId(id),
        userId: session.user.id, // Ensure reminder belongs to user
      },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return apiError("Reminder not found", 404);
    }

    // Fetch updated reminder (include userId filter for security)
    const updatedReminder = await remindersCollection.findOne({
      _id: new ObjectId(id),
      userId: session.user.id,
    });

    return apiSuccess(formatReminder(updatedReminder));
  } catch (error) {
    console.error("PUT /api/reminders/[id] error:", error);
    return apiError(error.message, 500);
  }
}

// DELETE /api/reminders/[id] - Delete a reminder (must belong to user)
export async function DELETE(request, { params }) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return apiError("Unauthorized", 401);
    }

    const { id } = await params;

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return apiError("Invalid reminder ID", 400);
    }

    const remindersCollection = await getCollection("reminders");

    // Get reminder before deleting for response
    const reminder = await remindersCollection.findOne({
      _id: new ObjectId(id),
      userId: session.user.id, // Ensure reminder belongs to user
    });

    if (!reminder) {
      return apiError("Reminder not found", 404);
    }

    const result = await remindersCollection.deleteOne({
      _id: new ObjectId(id),
      userId: session.user.id, // Ensure reminder belongs to user
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
      username: reminder.username,
    };

    return apiSuccess(formattedReminder);
  } catch (error) {
    console.error("DELETE /api/reminders/[id] error:", error);
    return apiError(error.message, 500);
  }
}

// PATCH /api/reminders/[id] - Partial update (e.g., toggle completed)
export async function PATCH(request, { params }) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return apiError("Unauthorized", 401);
    }

    const { id } = await params;
    const body = await request.json();

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return apiError("Invalid reminder ID", 400);
    }

    const remindersCollection = await getCollection("reminders");

    // Build update object with only provided fields
    const updateData = { updatedAt: new Date() };

    // Handle status update (new lifecycle field)
    if (body.status !== undefined) {
      if (!isValidStatus(body.status)) {
        return apiError(`Invalid status: ${body.status}`, 400);
      }

      // Fetch current reminder to validate status transition
      const currentReminder = await remindersCollection.findOne({
        _id: new ObjectId(id),
        userId: session.user.id,
      });

      if (currentReminder) {
        const currentStatus = currentReminder.status || "pending";
        if (!isValidStatusTransition(currentStatus, body.status)) {
          return apiError(`Invalid status transition from '${currentStatus}' to '${body.status}'`, 400);
        }

        updateData.status = body.status;
        updateData.completed = deriveCompletedFromStatus(body.status);

        // Track status change timestamps
        if (body.status === "in_progress" && currentStatus !== "in_progress") {
          updateData.startedAt = new Date();
        }
        if (body.status === "completed" && currentStatus !== "completed") {
          updateData.completedAt = new Date();
        }

        // Handle snooze: require snoozedUntil when snoozing
        if (body.status === "snoozed") {
          if (!body.snoozedUntil) {
            return apiError("snoozedUntil is required when snoozing", 400);
          }
          updateData.snoozedUntil = new Date(body.snoozedUntil);
        }

        // Clear snoozedUntil when leaving snoozed state
        if (currentStatus === "snoozed" && body.status !== "snoozed") {
          updateData.snoozedUntil = null;
        }
      }
    } else if (typeof body.completed === "boolean") {
      // Backward compatibility: handle completed boolean
      updateData.completed = body.completed;
      updateData.status = body.completed ? "completed" : "pending";
      if (body.completed) {
        updateData.completedAt = new Date();
      }
    }

    // Handle duration update
    if (body.duration !== undefined) {
      const durationValidation = validateDuration(body.duration);
      if (!durationValidation.isValid) {
        return apiError(durationValidation.error, 400);
      }
      updateData.duration = body.duration;
    }

    if (body.title && body.title.length > 200) {
      return NextResponse.json(
        { success: false, error: "Title must be 200 characters or less" },
        { status: 400 },
      );
    }
    if (body.description && body.description.length > 5000) {
      return NextResponse.json(
        {
          success: false,
          error: "Description must be 5000 characters or less",
        },
        { status: 400 },
      );
    }
    if (body.remark && body.remark.length > 2000) {
      return NextResponse.json(
        { success: false, error: "Remark must be 2000 characters or less" },
        { status: 400 },
      );
    }
    if (
      body.tags &&
      (body.tags.length > 20 || body.tags.some((t) => t.length > 50))
    ) {
      return NextResponse.json(
        { success: false, error: "Too many tags or tag too long" },
        { status: 400 },
      );
    }

    if (body.title) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.remark !== undefined) updateData.remark = body.remark;
    if (body.dateTime) {
      updateData.dateTime = new Date(body.dateTime);
      updateData.notificationSent = false;
    }
    if (body.category) updateData.category = body.category;
    if (body.tags !== undefined) updateData.tags = normalizeTags(body.tags || []);
    if (body.priority) updateData.priority = body.priority;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (body.subtasks !== undefined) {
      updateData.subtasks = normalizeSubtasks(body.subtasks);
    }

    const result = await remindersCollection.updateOne(
      {
        _id: new ObjectId(id),
        userId: session.user.id,
      },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return apiError("Reminder not found", 404);
    }

    // Fetch updated reminder (include userId filter for security)
    const updatedReminder = await remindersCollection.findOne({
      _id: new ObjectId(id),
      userId: session.user.id,
    });

    return apiSuccess(formatReminder(updatedReminder));
  } catch (error) {
    console.error("PATCH /api/reminders/[id] error:", error);
    return apiError(error.message, 500);
  }
}
