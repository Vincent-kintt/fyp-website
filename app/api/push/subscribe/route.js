import { getCollection } from "@/lib/db";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { parseJsonBodyWithSchema } from "@/lib/api/body.js";

const subscribeSchema = z.object({
  endpoint: z
    .string({
      error: "Invalid subscription: endpoint and keys (p256dh, auth) required",
    })
    .min(1, "Invalid subscription: endpoint and keys (p256dh, auth) required"),
  keys: z.object(
    {
      p256dh: z
        .string({
          error:
            "Invalid subscription: endpoint and keys (p256dh, auth) required",
        })
        .min(
          1,
          "Invalid subscription: endpoint and keys (p256dh, auth) required",
        ),
      auth: z
        .string({
          error:
            "Invalid subscription: endpoint and keys (p256dh, auth) required",
        })
        .min(
          1,
          "Invalid subscription: endpoint and keys (p256dh, auth) required",
        ),
    },
    {
      error: "Invalid subscription: endpoint and keys (p256dh, auth) required",
    },
  ),
});

const unsubscribeSchema = z.object({
  endpoint: z
    .string({ error: "endpoint is required" })
    .min(1, "endpoint is required"),
});

// POST /api/push/subscribe — save or refresh push subscription
export const POST = withAuth(
  async ({ request, userId }) => {
    const { data: body, error } = await parseJsonBodyWithSchema(
      request,
      subscribeSchema,
    );
    if (error) return error;
    const { endpoint, keys } = body;

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
    const { data: body, error } = await parseJsonBodyWithSchema(
      request,
      unsubscribeSchema,
    );
    if (error) return error;
    const { endpoint } = body;

    const subscriptionsCollection = await getCollection("push_subscriptions");

    const result = await subscriptionsCollection.deleteOne({ endpoint, userId });

    return apiSuccess({ deleted: result.deletedCount > 0 });
  },
  { label: "DELETE /api/push/subscribe" },
);
