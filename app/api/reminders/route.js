import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";

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

    const remindersCollection = await getCollection("reminders");

    // Build query filter - only get reminders for this user
    const filter = {
      username: session.user.username,
    };

    // Filter by category
    if (category && category !== "all") {
      filter.category = category;
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
      dateTime: reminder.dateTime,
      category: reminder.category,
      recurring: reminder.recurring,
      recurringType: reminder.recurringType,
      completed: reminder.completed || false,
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
    const { title, description, dateTime, category, recurring, recurringType } = body;

    // Validation
    if (!title || !dateTime || !category) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const remindersCollection = await getCollection("reminders");

    const newReminder = {
      userId: session.user.id,
      username: session.user.username,
      title,
      description: description || "",
      dateTime: new Date(dateTime),
      category,
      recurring: recurring || false,
      recurringType: recurring ? recurringType : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await remindersCollection.insertOne(newReminder);

    // Return created reminder with id
    const createdReminder = {
      id: result.insertedId.toString(),
      ...newReminder,
      completed: false,
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
