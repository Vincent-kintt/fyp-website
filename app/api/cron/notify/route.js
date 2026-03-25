import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { sendPushNotification } from "@/lib/push";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const remindersCollection = await getCollection("reminders");
    const subscriptionsCollection = await getCollection("push_subscriptions");
    const now = new Date();

    // Find reminders that are due and haven't been notified
    const dueReminders = await remindersCollection
      .find({
        dateTime: { $lte: now },
        status: { $in: ["pending", "in_progress"] },
        notificationSent: { $ne: true },
      })
      .limit(50)
      .toArray();

    let sent = 0;
    let failed = 0;
    let cleaned = 0;

    for (const reminder of dueReminders) {
      // Atomically claim — prevents double-send even with overlapping cron
      const claimed = await remindersCollection.findOneAndUpdate(
        {
          _id: reminder._id,
          notificationSent: { $ne: true },
        },
        {
          $set: { notificationSent: true, notifiedAt: now },
        }
      );

      if (!claimed) continue;

      const subscriptions = await subscriptionsCollection
        .find({ userId: reminder.userId })
        .toArray();

      if (subscriptions.length === 0) continue;

      const payload = {
        title: `Reminder: ${reminder.title}`,
        body: reminder.description
          ? reminder.description.slice(0, 200)
          : "Your reminder is due now",
        tag: reminder._id.toString(),
        url: `/reminders/${reminder._id.toString()}`,
        reminderId: reminder._id.toString(),
      };

      for (const sub of subscriptions) {
        const result = await sendPushNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        );

        if (result.success) {
          sent++;
        } else if (result.statusCode === 410 || result.statusCode === 404) {
          await subscriptionsCollection.deleteOne({ _id: sub._id });
          cleaned++;
        } else {
          failed++;
          console.error(
            `[cron/notify] Push failed for sub ${sub._id}: ${result.statusCode} ${result.error}`
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: dueReminders.length,
      sent,
      failed,
      cleaned,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[cron/notify] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
