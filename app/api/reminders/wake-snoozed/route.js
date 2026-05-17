// User-scoped wrapper around `wakeSnoozedTasks`. Lets an authenticated client
// bulk-reactivate its own expired snoozed reminders in real time, without
// waiting for the daily cron job. The auth wrapper applies the
// `private, no-store` cache contract on every exit path.

import { withAuth } from "@/lib/api/auth.js";
import { apiSuccess } from "@/lib/api/response.js";
import { getCollection } from "@/lib/db";
import { wakeSnoozedTasks } from "@/lib/reminders/wakeSnoozedTasks.js";

export const POST = withAuth(
  async ({ userId }) => {
    const collection = await getCollection("reminders");
    const result = await wakeSnoozedTasks({
      collection,
      filter: { userId },
    });
    return apiSuccess(result);
  },
  { label: "POST /api/reminders/wake-snoozed" },
);
