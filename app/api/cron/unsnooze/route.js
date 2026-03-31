import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";

export async function GET(request) {
  // Verify CRON_SECRET — deny by default when unset
  const authHeader = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const remindersCollection = await getCollection("reminders");
    const now = new Date();

    const result = await remindersCollection.updateMany(
      {
        status: "snoozed",
        snoozedUntil: { $lte: now },
      },
      {
        $set: {
          status: "pending",
          completed: false,
          snoozedUntil: null,
          updatedAt: now,
        },
      },
    );

    return NextResponse.json({
      success: true,
      reactivated: result.modifiedCount,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[cron/unsnooze] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
