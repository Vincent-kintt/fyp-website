import { getCollection } from "@/lib/db";
import { auth } from "@/auth";
import {
  normalizeTags,
  getMainCategory,
  validateDuration,
} from "@/lib/utils";
import { formatReminder, normalizeSubtasks, apiSuccess, apiError } from "@/lib/reminderUtils";

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

    const remindersCollection = await getCollection("reminders");

    // Build query filter - only get reminders for this user
    const filter = {
      userId: session.user.id,
    };

    // Filter by category (backward compatible)
    if (category && category !== "all") {
      // Support both legacy category field and new tags array
      filter.$or = [
        { category: category },
        { tags: category }
      ];
    }

    // Filter by specific tag
    if (tag) {
      // If category filter is already set with $or, combine with $and to avoid conflict
      if (filter.$or) {
        filter.$and = [
          { $or: filter.$or },
          { tags: tag },
        ];
        delete filter.$or;
      } else {
        filter.tags = tag;
      }
    }

    // Filter by type (recurring or one-time)
    if (type && type !== "all") {
      filter.recurring = type === "recurring";
    }

    // Fetch reminders from MongoDB
    const reminders = await remindersCollection
      .find(filter)
      .sort({ dateTime: 1 })
      .toArray();

    // Convert _id to id for frontend compatibility
    const formattedReminders = reminders.map(formatReminder);

    return apiSuccess(formattedReminders);
  } catch (error) {
    console.error("GET /api/reminders error:", error);
    return apiError(error.message, 500);
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
    const { title, description, dateTime, duration, category, tags, recurring, recurringType, priority, subtasks, remark } = body;

    // Validation - tags or category required
    if (!title || !dateTime) {
      return apiError("Missing required fields (title, dateTime)", 400);
    }

    // Validate duration if provided
    if (duration !== undefined && duration !== null) {
      const durationValidation = validateDuration(duration);
      if (!durationValidation.isValid) {
        return apiError(durationValidation.error, 400);
      }
    }

    // Process tags - normalize and ensure we have at least one
    const processedTags = normalizeTags(tags || []);
    const effectiveCategory = category || getMainCategory(processedTags) || "personal";

    const remindersCollection = await getCollection("reminders");

    const newReminder = {
      userId: session.user.id,
      username: session.user.username,
      title,
      description: description || "",
      remark: remark || "",
      dateTime: new Date(dateTime),
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
    return apiError(error.message, 500);
  }
}
