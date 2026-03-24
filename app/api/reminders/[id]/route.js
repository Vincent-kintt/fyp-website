import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { auth } from "@/auth";
import { ObjectId } from "mongodb";
import { 
  normalizeTags, 
  getMainCategory,
  isValidStatus,
  isValidStatusTransition,
  deriveStatusFromCompleted,
  deriveCompletedFromStatus,
  validateDuration
} from "@/lib/utils";

// GET /api/reminders/[id] - Get a single reminder (must belong to user)
export async function GET(request, { params }) {
  try {
    const session = await auth();

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
      userId: session.user.id, // Ensure reminder belongs to user
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
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { title, description, remark, dateTime, duration, status, category, tags, recurring, recurringType, priority, subtasks } = body;

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid reminder ID" },
        { status: 400 }
      );
    }

    // Validation
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

    // Validate status if provided
    if (status !== undefined && !isValidStatus(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status: ${status}. Valid values: pending, in_progress, completed, snoozed` },
        { status: 400 }
      );
    }

    // Process tags
    const processedTags = normalizeTags(tags || []);
    const effectiveCategory = category || getMainCategory(processedTags) || "personal";

    const remindersCollection = await getCollection("reminders");

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
      subtasks: Array.isArray(subtasks) ? subtasks.map((st, idx) => ({
        id: st.id || `st-${Date.now()}-${idx}`,
        title: st.title,
        completed: st.completed || false,
      })) : [],
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
      remark: updatedReminder.remark || "",
      dateTime: updatedReminder.dateTime.toISOString(),
      duration: updatedReminder.duration || null,
      category: updatedReminder.category || getMainCategory(updatedReminder.tags),
      tags: updatedReminder.tags || [],
      recurring: updatedReminder.recurring,
      recurringType: updatedReminder.recurringType,
      status: updatedReminder.status || deriveStatusFromCompleted(updatedReminder.completed),
      completed: updatedReminder.completed || false,
      snoozedUntil: updatedReminder.snoozedUntil || null,
      startedAt: updatedReminder.startedAt || null,
      completedAt: updatedReminder.completedAt || null,
      priority: updatedReminder.priority || "medium",
      subtasks: updatedReminder.subtasks || [],
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
    const session = await auth();

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
      userId: session.user.id, // Ensure reminder belongs to user
    });

    if (!reminder) {
      return NextResponse.json(
        { success: false, error: "Reminder not found" },
        { status: 404 }
      );
    }

    const result = await remindersCollection.deleteOne({
      _id: new ObjectId(id),
      userId: session.user.id, // Ensure reminder belongs to user
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
      category: reminder.category || getMainCategory(reminder.tags),
      tags: reminder.tags || [],
      recurring: reminder.recurring,
      recurringType: reminder.recurringType,
      completed: reminder.completed || false,
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

// PATCH /api/reminders/[id] - Partial update (e.g., toggle completed)
export async function PATCH(request, { params }) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid reminder ID" },
        { status: 400 }
      );
    }

    const remindersCollection = await getCollection("reminders");

    // Build update object with only provided fields
    const updateData = { updatedAt: new Date() };
    
    // Handle status update (new lifecycle field)
    if (body.status !== undefined) {
      if (!isValidStatus(body.status)) {
        return NextResponse.json(
          { success: false, error: `Invalid status: ${body.status}` },
          { status: 400 }
        );
      }
      
      // Fetch current reminder to validate status transition
      const currentReminder = await remindersCollection.findOne({
        _id: new ObjectId(id),
        userId: session.user.id,
      });
      
      if (currentReminder) {
        const currentStatus = currentReminder.status || "pending";
        if (!isValidStatusTransition(currentStatus, body.status)) {
          return NextResponse.json(
            { success: false, error: `Invalid status transition from '${currentStatus}' to '${body.status}'` },
            { status: 400 }
          );
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
        return NextResponse.json(
          { success: false, error: durationValidation.error },
          { status: 400 }
        );
      }
      updateData.duration = body.duration;
    }
    
    if (body.title) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.remark !== undefined) updateData.remark = body.remark;
    if (body.dateTime) updateData.dateTime = new Date(body.dateTime);
    if (body.category) updateData.category = body.category;
    if (body.tags !== undefined) updateData.tags = normalizeTags(body.tags || []);
    if (body.priority) updateData.priority = body.priority;
    if (body.subtasks !== undefined) {
      updateData.subtasks = Array.isArray(body.subtasks) ? body.subtasks.map((st, idx) => ({
        id: st.id || `st-${Date.now()}-${idx}`,
        title: st.title,
        completed: st.completed || false,
      })) : [];
    }

    const result = await remindersCollection.updateOne(
      {
        _id: new ObjectId(id),
        userId: session.user.id,
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
      remark: updatedReminder.remark || "",
      dateTime: updatedReminder.dateTime,
      duration: updatedReminder.duration || null,
      category: updatedReminder.category || getMainCategory(updatedReminder.tags),
      tags: updatedReminder.tags || [],
      recurring: updatedReminder.recurring,
      recurringType: updatedReminder.recurringType,
      status: updatedReminder.status || deriveStatusFromCompleted(updatedReminder.completed),
      completed: updatedReminder.completed || false,
      snoozedUntil: updatedReminder.snoozedUntil || null,
      startedAt: updatedReminder.startedAt || null,
      completedAt: updatedReminder.completedAt || null,
      priority: updatedReminder.priority || "medium",
      subtasks: updatedReminder.subtasks || [],
      username: updatedReminder.username,
      createdAt: updatedReminder.createdAt,
      updatedAt: updatedReminder.updatedAt,
    };

    return NextResponse.json({
      success: true,
      data: formattedReminder,
    });
  } catch (error) {
    console.error("PATCH /api/reminders/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
