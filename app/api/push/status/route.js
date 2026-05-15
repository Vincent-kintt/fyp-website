import { getCollection } from "@/lib/db";
import { apiSuccess } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";

// GET /api/push/status — check if user has active push subscriptions
export const GET = withAuth(
  async ({ userId }) => {
    const subscriptionsCollection = await getCollection("push_subscriptions");
    const count = await subscriptionsCollection.countDocuments({ userId });
    return apiSuccess({ enabled: count > 0, count });
  },
  { label: "GET /api/push/status" },
);
