import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";

// GET /api/reminders/[id] - Get a single reminder (must belong to user)
export async function GET(request, { params }) {
  try {
    const session = await getServerSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid reminder ID" },
        { status: 400 }
      );
    }

    const remindersCollection = await getCollection("reminders");
    const reminder = await remindersCollection.findOne({
      _id: new ObjectId(id),
      username: session.user.username, // Ensure reminder belongs to user
    });

    if (!reminder) {
      return NextResponse.json(
        { success: false, error: "Reminder not found" },
        { status: 404 }
      );
    }

    // Format response
    const formattedReminder = {
      id: reminder._id.toString(),
      title: reminder.title,
      description: reminder.description,
      dateTime: reminder.dateTime,
      category: reminder.category,
      recurring: reminder.recurring,
      recurringType: reminder.recurringType,
      username: reminder.username,
      createdAt: reminder.createdAt,
      updatedAt: reminder.updatedAt,
    };

    return NextResponse.json({
      success: true,
      data: formattedReminder,
    });
  } catch (error) {
    console.error("GET /api/reminders/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/reminders/[id] - Update a reminder (must belong to user)
export async function PUT(request, { params }) {
  try {
    const session = await getServerSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { title, description, dateTime, category, recurring, recurringType } = body;

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid reminder ID" },
        { status: 400 }
      );
    }

    // Validation
    if (!title || !dateTime || !category) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const remindersCollection = await getCollection("reminders");

    const updateData = {
      title,
      description: description || "",
      dateTime: new Date(dateTime),
      category,
      recurring: recurring || false,
      recurringType: recurring ? recurringType : null,
      updatedAt: new Date(),
    };

    const result = await remindersCollection.updateOne(
      {
        _id: new ObjectId(id),
        username: session.user.username, // Ensure reminder belongs to user
      },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: "Reminder not found" },
        { status: 404 }
      );
    }

    // Fetch updated reminder
    const updatedReminder = await remindersCollection.findOne({ _id: new ObjectId(id) });

    const formattedReminder = {
      id: updatedReminder._id.toString(),
      title: updatedReminder.title,
      description: updatedReminder.description,
      dateTime: updatedReminder.dateTime.toISOString(),
      category: updatedReminder.category,
      recurring: updatedReminder.recurring,
      recurringType: updatedReminder.recurringType,
      username: updatedReminder.username,
      createdAt: updatedReminder.createdAt.toISOString(),
      updatedAt: updatedReminder.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: formattedReminder,
    });
  } catch (error) {
    console.error("PUT /api/reminders/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/reminders/[id] - Delete a reminder (must belong to user)
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid reminder ID" },
        { status: 400 }
      );
    }

    const remindersCollection = await getCollection("reminders");

    // Get reminder before deleting for response
    const reminder = await remindersCollection.findOne({
      _id: new ObjectId(id),
      username: session.user.username, // Ensure reminder belongs to user
    });

    if (!reminder) {
      return NextResponse.json(
        { success: false, error: "Reminder not found" },
        { status: 404 }
      );
    }

    const result = await remindersCollection.deleteOne({
      _id: new ObjectId(id),
      username: session.user.username, // Ensure reminder belongs to user
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to delete reminder" },
        { status: 500 }
      );
    }

    const formattedReminder = {
      id: reminder._id.toString(),
      title: reminder.title,
      description: reminder.description,
      dateTime: reminder.dateTime,
      category: reminder.category,
      recurring: reminder.recurring,
      recurringType: reminder.recurringType,
      username: reminder.username,
    };

    return NextResponse.json({
      success: true,
      data: formattedReminder,
    });
  } catch (error) {
    console.error("DELETE /api/reminders/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
