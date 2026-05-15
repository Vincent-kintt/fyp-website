import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { withCronAuth } from "@/lib/api/cronAuth.js";

export const GET = withCronAuth(
  async () => {
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
  },
  { label: "GET /api/cron/unsnooze" },
);
