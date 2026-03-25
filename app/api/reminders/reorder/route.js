import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { auth } from "@/auth";
import { ObjectId } from "mongodb";

// PATCH /api/reminders/reorder - Batch update sortOrder (and optionally dateTime)
export async function PATCH(request) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "items array is required" },
        { status: 400 }
      );
    }

    // Validate all IDs
    for (const item of items) {
      if (!item.id || !ObjectId.isValid(item.id)) {
        return NextResponse.json(
          { success: false, error: `Invalid reminder ID: ${item.id}` },
          { status: 400 }
        );
      }
      if (typeof item.sortOrder !== "number") {
        return NextResponse.json(
          { success: false, error: `sortOrder must be a number for ID: ${item.id}` },
          { status: 400 }
        );
      }
    }

    const remindersCollection = await getCollection("reminders");

    const ops = items.map((item) => {
      const updateFields = {
        sortOrder: item.sortOrder,
        updatedAt: new Date(),
      };

      // Optional dateTime update (for cross-section drag in Phase 3)
      if (item.dateTime) {
        updateFields.dateTime = new Date(item.dateTime);
        updateFields.notificationSent = false;
      }

      return {
        updateOne: {
          filter: {
            _id: new ObjectId(item.id),
            userId: session.user.id,
          },
          update: { $set: updateFields },
        },
      };
    });

    const result = await remindersCollection.bulkWrite(ops);

    return NextResponse.json({
      success: true,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("PATCH /api/reminders/reorder error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
