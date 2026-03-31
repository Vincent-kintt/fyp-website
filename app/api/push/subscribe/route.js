import { NextResponse } from "next/server";
import { getCollection } from "@/lib/db";
import { auth } from "@/auth";

// POST /api/push/subscribe — save or refresh push subscription
export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid subscription: endpoint and keys (p256dh, auth) required",
        },
        { status: 400 },
      );
    }

    // Validate endpoint URL format (prevent SSRF)
    try {
      const url = new URL(endpoint);
      if (!url.protocol.startsWith("https")) {
        return NextResponse.json(
          { success: false, error: "Subscription endpoint must use HTTPS" },
          { status: 400 },
        );
      }
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid subscription endpoint URL" },
        { status: 400 },
      );
    }

    const subscriptionsCollection = await getCollection("push_subscriptions");

    const result = await subscriptionsCollection.updateOne(
      { endpoint, userId: session.user.id },
      {
        $set: {
          userId: session.user.id,
          endpoint,
          keys,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    return NextResponse.json({
      success: true,
      data: {
        upserted: !!result.upsertedId,
        modified: result.modifiedCount > 0,
      },
    });
  } catch (error) {
    console.error("POST /api/push/subscribe error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/push/subscribe — remove push subscription
export async function DELETE(request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: "endpoint is required" },
        { status: 400 },
      );
    }

    const subscriptionsCollection = await getCollection("push_subscriptions");

    const result = await subscriptionsCollection.deleteOne({
      endpoint,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      data: { deleted: result.deletedCount > 0 },
    });
  } catch (error) {
    console.error("DELETE /api/push/subscribe error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
