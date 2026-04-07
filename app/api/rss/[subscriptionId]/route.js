import { auth } from "@/auth";
import { ObjectId } from "mongodb";
import { apiSuccess, apiError } from "@/lib/reminderUtils";
import { getRssSubscriptionsCollection } from "@/lib/rss/db";

export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const { subscriptionId } = await params;
    if (!ObjectId.isValid(subscriptionId)) {
      return apiError("Invalid subscription ID", 400);
    }

    const subsCol = await getRssSubscriptionsCollection();
    const result = await subsCol.deleteOne({
      _id: new ObjectId(subscriptionId),
      userId: session.user.id,
    });

    if (result.deletedCount === 0) {
      return apiError("Subscription not found", 404);
    }

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/rss error:", error);
    return apiError("Internal server error", 500);
  }
}
