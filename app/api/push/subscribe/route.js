import { getCollection } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { parseJsonBody } from "@/lib/api/body.js";

// POST /api/push/subscribe — save or refresh push subscription
export const POST = withAuth(
  async ({ request, userId }) => {
    const { data: body, error } = await parseJsonBody(request);
    if (error) return error;
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return apiError(
        "Invalid subscription: endpoint and keys (p256dh, auth) required",
        400,
      );
    }

    // Validate endpoint URL format (prevent SSRF)
    try {
      const url = new URL(endpoint);
      if (!url.protocol.startsWith("https")) {
        return apiError("Subscription endpoint must use HTTPS", 400);
      }
    } catch {
      return apiError("Invalid subscription endpoint URL", 400);
    }

    const subscriptionsCollection = await getCollection("push_subscriptions");

    const result = await subscriptionsCollection.updateOne(
      { endpoint, userId },
      {
        $set: { userId, endpoint, keys, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );

    return apiSuccess({
      upserted: !!result.upsertedId,
      modified: result.modifiedCount > 0,
    });
  },
  { label: "POST /api/push/subscribe" },
);

// DELETE /api/push/subscribe — remove push subscription
export const DELETE = withAuth(
  async ({ request, userId }) => {
    const { data: body, error } = await parseJsonBody(request);
    if (error) return error;
    const { endpoint } = body;

    if (!endpoint) {
      return apiError("endpoint is required", 400);
    }

    const subscriptionsCollection = await getCollection("push_subscriptions");

    const result = await subscriptionsCollection.deleteOne({ endpoint, userId });

    return apiSuccess({ deleted: result.deletedCount > 0 });
  },
  { label: "DELETE /api/push/subscribe" },
);
