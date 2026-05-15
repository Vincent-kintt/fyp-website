import { getCollection } from "@/lib/db";
import { normalizeTags, getMainCategory, validateDuration } from "@/lib/utils";
import {
  formatReminder,
  normalizeSubtasks,
  validateReminderFields,
} from "@/lib/reminderUtils";
import { apiSuccess, apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";

// GET /api/reminders - Get all reminders for logged-in user
export const GET = withAuth(
  async ({ request, userId }) => {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const type = searchParams.get("type");
    const tag = searchParams.get("tag");
    const inboxStateParam = searchParams.get("inboxState");

    const remindersCollection = await getCollection("reminders");

    const filter = { userId };

    if (inboxStateParam === "inbox") {
      filter.inboxState = "inbox";
    } else if (inboxStateParam === "all") {
      // no inboxState filter
    } else {
      filter.inboxState = { $ne: "inbox" };
    }

    if (category && category !== "all") {
      filter.$or = [{ category: category }, { tags: category }];
    }

    if (tag) {
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { tags: tag }];
        delete filter.$or;
      } else {
        filter.tags = tag;
      }
    }

    if (type && type !== "all") {
      filter.recurring = type === "recurring";
    }

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const usePagination = pageParam !== null || limitParam !== null;

    let page = parseInt(pageParam, 10);
    let limit = parseInt(limitParam, 10);

    if (usePagination) {
      if (isNaN(page) || page < 1 || !Number.isInteger(page)) {
        page = 1;
      }
      if (isNaN(limit) || limit < 0 || !Number.isInteger(limit)) {
        limit = 50;
      }
    }

    const sort =
      inboxStateParam === "inbox" ? { createdAt: -1 } : { dateTime: 1 };
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

    const reminders = await cursor.toArray();
    const formattedReminders = reminders.map(formatReminder);

    return apiSuccess(formattedReminders);
  },
  { label: "GET /api/reminders" },
);

// POST /api/reminders - Create a new reminder for logged-in user
export const POST = withAuth(
  async ({ request, session, userId }) => {
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

    if (!title) {
      return apiError("Missing required field (title)", 400);
    }
    const inboxState = body.inboxState || "processed";
    if (inboxState !== "inbox" && !dateTime) {
      return apiError(
        "Missing required field (dateTime) for non-inbox tasks",
        400,
      );
    }

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

    const processedTags = normalizeTags(tags || []);
    const effectiveCategory =
      category || getMainCategory(processedTags) || "personal";

    const remindersCollection = await getCollection("reminders");

    const newReminder = {
      userId,
      username: session.user.username,
      title,
      description: description || "",
      remark: remark || "",
      dateTime: dateTime ? new Date(dateTime) : null,
      inboxState,
      duration: duration || null,
      category: effectiveCategory,
      tags: processedTags,
      recurring: recurring || false,
      recurringType: recurring ? recurringType : null,
      priority: priority || "medium",
      status: "pending",
      completed: false,
      subtasks: normalizeSubtasks(subtasks),
      sortOrder: body.sortOrder || 0,
      notificationSent: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await remindersCollection.insertOne(newReminder);
    const insertedDoc = { ...newReminder, _id: result.insertedId };

    return apiSuccess(formatReminder(insertedDoc), 201);
  },
  { label: "POST /api/reminders" },
);
