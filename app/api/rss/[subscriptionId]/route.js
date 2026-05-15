import { ObjectId } from "mongodb";
import { apiSuccess, apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { getRssSubscriptionsCollection } from "@/lib/rss/db";

export const DELETE = withAuth(
  async ({ params, userId }) => {
    const { subscriptionId } = await params;
    if (!ObjectId.isValid(subscriptionId)) {
      return apiError("Invalid subscription ID", 400);
    }

    const subsCol = await getRssSubscriptionsCollection();
    const result = await subsCol.deleteOne({
      _id: new ObjectId(subscriptionId),
      userId,
    });

    if (result.deletedCount === 0) {
      return apiError("Subscription not found", 404);
    }

    return apiSuccess({ deleted: true });
  },
  { label: "DELETE /api/rss/[subscriptionId]" },
);
