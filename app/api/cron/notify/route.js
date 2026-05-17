import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { sendPushNotification } from "@/lib/push";
import { withCronAuth } from "@/lib/api/cronAuth.js";
import { processDueReminders } from "@/lib/notifications/processDueReminders.js";

export const GET = withCronAuth(
  async () => {
    const remindersCollection = await getCollection("reminders");
    const subscriptionsCollection = await getCollection("push_subscriptions");
    const now = new Date();
    const counters = await processDueReminders({
      remindersCollection,
      subscriptionsCollection,
      sendPush: sendPushNotification,
      now,
    });
    return NextResponse.json({
      success: true,
      ...counters,
      timestamp: now.toISOString(),
    });
  },
  { label: "GET /api/cron/notify" },
);
