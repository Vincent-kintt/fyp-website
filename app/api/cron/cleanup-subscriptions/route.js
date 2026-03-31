import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
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
  } catch (error) {
    console.error("[cron/cleanup-subscriptions] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
