import { apiSuccess } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { getRssFeedsCollection } from "@/lib/rss/db";

export const GET = withAuth(
  async () => {
    const feedsCol = await getRssFeedsCollection();
    const feeds = await feedsCol
      .find({ isDefault: true })
      .sort({ category: 1 })
      .toArray();

    const grouped = {};
    for (const feed of feeds) {
      if (!grouped[feed.category]) grouped[feed.category] = [];
      grouped[feed.category].push({
        id: feed._id.toString(),
        url: feed.url,
        title: feed.title,
        category: feed.category,
      });
    }

    return apiSuccess(grouped);
  },
  { label: "GET /api/rss/catalog" },
);
