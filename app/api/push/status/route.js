import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { auth } from "@/auth";

// GET /api/push/status — check if user has active push subscriptions
export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const subscriptionsCollection = await getCollection("push_subscriptions");
    const count = await subscriptionsCollection.countDocuments({
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      data: { enabled: count > 0, count },
    });
  } catch (error) {
    console.error("GET /api/push/status error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
