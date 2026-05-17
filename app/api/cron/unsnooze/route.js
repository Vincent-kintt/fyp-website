import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { withCronAuth } from "@/lib/api/cronAuth.js";
import { wakeSnoozedTasks } from "@/lib/reminders/wakeSnoozedTasks.js";

export const GET = withCronAuth(
  async () => {
    const collection = await getCollection("reminders");
    const { reactivated, timestamp } = await wakeSnoozedTasks({ collection });
    return NextResponse.json({ success: true, reactivated, timestamp });
  },
  { label: "GET /api/cron/unsnooze" },
);
