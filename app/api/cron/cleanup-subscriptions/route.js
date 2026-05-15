import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { withCronAuth } from "@/lib/api/cronAuth.js";

export const GET = withCronAuth(
  async () => {
    const subscriptionsCollection = await getCollection("push_subscriptions");
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await subscriptionsCollection.deleteMany({
      updatedAt: { $lt: thirtyDaysAgo },
    });

    return NextResponse.json({
      success: true,
      deleted: result.deletedCount,
      timestamp: new Date().toISOString(),
    });
  },
  { label: "GET /api/cron/cleanup-subscriptions" },
);
