import { apiSuccess, apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import {
  getRssFeedsCollection,
  getRssSubscriptionsCollection,
  formatSubscription,
} from "@/lib/rss/db";
import { VALID_CATEGORIES } from "@/lib/rss/defaultFeeds";

// GET /api/rss — list user's subscriptions
export const GET = withAuth(
  async ({ userId }) => {
    const subsCol = await getRssSubscriptionsCollection();
    const feedsCol = await getRssFeedsCollection();

    const subs = await subsCol.find({ userId }).toArray();
    if (subs.length === 0) return apiSuccess([]);

    // Application-level join
    const feedIds = subs.map((s) => s.feedId);
    const feeds = await feedsCol.find({ _id: { $in: feedIds } }).toArray();
    const feedMap = new Map(feeds.map((f) => [f._id.toString(), f]));

    const result = subs.map((s) =>
      formatSubscription(s, feedMap.get(s.feedId.toString())),
    );
    return apiSuccess(result);
  },
  { label: "GET /api/rss" },
);

// POST /api/rss — subscribe by category
export const POST = withAuth(
  async ({ request, userId }) => {
    const { categories } = await request.json();
    if (!Array.isArray(categories) || categories.length === 0) {
      return apiError("At least one category is required", 400);
    }

    for (const cat of categories) {
      if (!VALID_CATEGORIES.includes(cat)) {
        return apiError(`Invalid category: ${cat}`, 400);
      }
    }

    const feedsCol = await getRssFeedsCollection();
    const subsCol = await getRssSubscriptionsCollection();

    const feeds = await feedsCol
      .find({ isDefault: true, category: { $in: categories } })
      .toArray();

    if (feeds.length === 0) {
      return apiError("No feeds found for the selected categories", 400);
    }

    const existingSubs = await subsCol
      .find({ userId, feedId: { $in: feeds.map((f) => f._id) } })
      .toArray();
    const existingFeedIds = new Set(
      existingSubs.map((s) => s.feedId.toString()),
    );

    const newSubs = feeds
      .filter((f) => !existingFeedIds.has(f._id.toString()))
      .map((f) => ({ userId, feedId: f._id, subscribedAt: new Date() }));

    let insertedCount = 0;
    if (newSubs.length > 0) {
      const result = await subsCol.insertMany(newSubs);
      insertedCount = result.insertedCount;
    }

    return apiSuccess({
      subscribed: insertedCount,
      skipped: feeds.length - insertedCount,
    });
  },
  { label: "POST /api/rss" },
);
