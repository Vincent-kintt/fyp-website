import { getCollection } from "@/lib/db";
import { auth } from "@/auth";
import { normalizeTags, getMainCategory, validateDuration } from "@/lib/utils";
import {
  formatReminder,
  normalizeSubtasks,
  apiSuccess,
  apiError,
  validateReminderFields,
} from "@/lib/reminderUtils";

// GET /api/reminders - Get all reminders for logged-in user
export async function GET(request) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return apiError("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const type = searchParams.get("type");
    const tag = searchParams.get("tag");
    const inboxStateParam = searchParams.get("inboxState");

    const remindersCollection = await getCollection("reminders");

    // Build query filter - only get reminders for this user
    const filter = {
      userId: session.user.id,
    };

    // inboxState filtering — default excludes inbox tasks
    if (inboxStateParam === "inbox") {
      filter.inboxState = "inbox";
    } else if (inboxStateParam === "all") {
      // no inboxState filter
    } else {
      // default: exclude inbox tasks so null-dateTime tasks don't leak
      filter.inboxState = { $ne: "inbox" };
    }

    // Filter by category (backward compatible)
    if (category && category !== "all") {
      // Support both legacy category field and new tags array
      filter.$or = [{ category: category }, { tags: category }];
    }

    // Filter by specific tag
    if (tag) {
      // If category filter is already set with $or, combine with $and to avoid conflict
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { tags: tag }];
        delete filter.$or;
      } else {
        filter.tags = tag;
      }
    }

    // Filter by type (recurring or one-time)
    if (type && type !== "all") {
      filter.recurring = type === "recurring";
    }

    // Pagination params
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const usePagination = pageParam !== null || limitParam !== null;

    let page = parseInt(pageParam, 10);
    let limit = parseInt(limitParam, 10);

    if (usePagination) {
      // Validate: page must be integer >= 1
      if (isNaN(page) || page < 1 || !Number.isInteger(page)) {
        page = 1;
      }
      // Validate: limit must be integer >= 0
      if (isNaN(limit) || limit < 0 || !Number.isInteger(limit)) {
        limit = 50;
      }
    }

    const sort = inboxStateParam === "inbox" ? { createdAt: -1 } : { dateTime: 1 };
    const cursor = remindersCollection.find(filter).sort(sort);

    if (usePagination && limit > 0) {
      const total = await remindersCollection.countDocuments(filter);
      const totalPages = Math.ceil(total / limit);
      const skip = (page - 1) * limit;

      const reminders = await cursor.skip(skip).limit(limit).toArray();
      const formattedReminders = reminders.map(formatReminder);

      return apiSuccess(formattedReminders, 200, {
        page,
        limit,
        total,
        totalPages,
      });
    }

    // No pagination (backward compatible) — return all results
    const reminders = await cursor.toArray();
    const formattedReminders = reminders.map(formatReminder);

    return apiSuccess(formattedReminders);
  } catch (error) {
    console.error("GET /api/reminders error:", error);
    return apiError("Internal server error", 500);
  }
}

// POST /api/reminders - Create a new reminder for logged-in user
export async function POST(request) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json();
    const {
      title,
      description,
      dateTime,
      duration,
      category,
      tags,
      recurring,
      recurringType,
      priority,
      subtasks,
      remark,
    } = body;

    // Validation
    if (!title) {
      return apiError("Missing required field (title)", 400);
    }
    const inboxState = body.inboxState || "processed";
    if (inboxState !== "inbox" && !dateTime) {
      return apiError("Missing required field (dateTime) for non-inbox tasks", 400);
    }

    const fieldError = validateReminderFields({ title, description, remark, tags });
    if (fieldError) return fieldError;

    // Validate duration if provided
    if (duration !== undefined && duration !== null) {
      const durationValidation = validateDuration(duration);
      if (!durationValidation.isValid) {
        return apiError(durationValidation.error, 400);
      }
    }

    // Process tags - normalize and ensure we have at least one
    const processedTags = normalizeTags(tags || []);
    const effectiveCategory =
      category || getMainCategory(processedTags) || "personal";

    const remindersCollection = await getCollection("reminders");

    const newReminder = {
      userId: session.user.id,
      username: session.user.username,
      title,
      description: description || "",
      remark: remark || "",
      dateTime: dateTime ? new Date(dateTime) : null,
      inboxState,
      duration: duration || null, // Duration in minutes for time blocking
      category: effectiveCategory,
      tags: processedTags,
      recurring: recurring || false,
      recurringType: recurring ? recurringType : null,
      priority: priority || "medium",
      status: "pending", // New status lifecycle field
      completed: false, // Backward compatibility: always store completed field
      subtasks: normalizeSubtasks(subtasks),
      sortOrder: body.sortOrder || 0,
      notificationSent: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await remindersCollection.insertOne(newReminder);

    // Return created reminder with id
    const insertedDoc = { ...newReminder, _id: result.insertedId };

    return apiSuccess(formatReminder(insertedDoc), 201);
  } catch (error) {
    console.error("POST /api/reminders error:", error);
    return apiError("Internal server error", 500);
  }
}
