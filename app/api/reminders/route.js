import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { 
  normalizeTags, 
  getMainCategory, 
  isValidStatus,
  deriveStatusFromCompleted,
  deriveCompletedFromStatus,
  validateDuration,
  formatDuration
} from "@/lib/utils";

// GET /api/reminders - Get all reminders for logged-in user
export async function GET(request) {
  try {
    const session = await getServerSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const type = searchParams.get("type");
    const tag = searchParams.get("tag");

    const remindersCollection = await getCollection("reminders");

    // Build query filter - only get reminders for this user
    const filter = {
      username: session.user.username,
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
      filter.tags = tag;
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
    const formattedReminders = reminders.map((reminder) => ({
      id: reminder._id.toString(),
      title: reminder.title,
      description: reminder.description,
      remark: reminder.remark || "",
      dateTime: reminder.dateTime,
      duration: reminder.duration || null,
      category: reminder.category || getMainCategory(reminder.tags),
      tags: reminder.tags || [],
      recurring: reminder.recurring,
      recurringType: reminder.recurringType,
      status: reminder.status || deriveStatusFromCompleted(reminder.completed),
      completed: reminder.completed || false,
      snoozedUntil: reminder.snoozedUntil || null,
      startedAt: reminder.startedAt || null,
      completedAt: reminder.completedAt || null,
      priority: reminder.priority || "medium",
      subtasks: reminder.subtasks || [],
      username: reminder.username,
      createdAt: reminder.createdAt,
      updatedAt: reminder.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: formattedReminders,
    });
  } catch (error) {
    console.error("GET /api/reminders error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/reminders - Create a new reminder for logged-in user
export async function POST(request) {
  try {
    const session = await getServerSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, description, dateTime, duration, category, tags, recurring, recurringType, priority, subtasks, remark } = body;

    // Validation - tags or category required
    if (!title || !dateTime) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (title, dateTime)" },
        { status: 400 }
      );
    }

    // Validate duration if provided
    if (duration !== undefined && duration !== null) {
      const durationValidation = validateDuration(duration);
      if (!durationValidation.isValid) {
        return NextResponse.json(
          { success: false, error: durationValidation.error },
          { status: 400 }
        );
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
      subtasks: Array.isArray(subtasks) ? subtasks.map((st, idx) => ({
        id: st.id || `st-${Date.now()}-${idx}`,
        title: st.title,
        completed: st.completed || false,
      })) : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await remindersCollection.insertOne(newReminder);

    // Return created reminder with id
    const createdReminder = {
      id: result.insertedId.toString(),
      ...newReminder,
      status: "pending",
      completed: false,
      tags: processedTags,
      dateTime: newReminder.dateTime.toISOString(),
      createdAt: newReminder.createdAt.toISOString(),
      updatedAt: newReminder.updatedAt.toISOString(),
    };

    return NextResponse.json(
      { success: true, data: createdReminder },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/reminders error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
