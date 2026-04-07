import { auth } from "@/auth";
import { apiSuccess, apiError } from "@/lib/reminderUtils";
import { getRssFeedsCollection } from "@/lib/rss/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

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
  } catch (error) {
    console.error("GET /api/rss/catalog error:", error);
    return apiError("Internal server error", 500);
  }
}
