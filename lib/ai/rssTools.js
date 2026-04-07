import { tool } from "ai";
import { z } from "zod";
import { getCollection } from "@/lib/db.js";
import { parseFeed } from "feedsmith";
import { textOutput } from "@/lib/ai/tools.js";

export function createRssTools(userId, todayStart, todayEnd) {
  return {
    getUserSubscriptions: tool({
      description:
        "Get the user's RSS feed subscriptions. Returns a list of subscribed feeds with URLs, titles, and categories. Call this first to know which feeds to fetch.",
      inputSchema: z.object({}),
      execute: async () => {
        const subsCol = await getCollection("rssSubscriptions");
        const feedsCol = await getCollection("rssFeeds");

        const subs = await subsCol.find({ userId }).toArray();
        if (subs.length === 0) {
          return { success: true, subscriptions: [] };
        }

        const feedIds = subs.map((s) => s.feedId);
        const feeds = await feedsCol.find({ _id: { $in: feedIds } }).toArray();
        const feedMap = new Map(feeds.map((f) => [f._id.toString(), f]));

        return {
          success: true,
          subscriptions: subs
            .map((s) => {
              const feed = feedMap.get(s.feedId.toString());
              if (!feed) return null;
              return {
                feedId: s.feedId.toString(),
                url: feed.url,
                title: feed.title,
                category: feed.category,
              };
            })
            .filter(Boolean),
        };
      },
      toModelOutput: ({ output }) => textOutput(output),
    }),

    fetchRSSFeeds: tool({
      description:
        "Fetch and parse RSS feeds from the given URLs. Returns today's articles grouped by feed. Use this after getUserSubscriptions to retrieve the actual content.",
      inputSchema: z.object({
        feedUrls: z
          .array(z.string().url())
          .min(1)
          .describe("Array of RSS feed URLs to fetch"),
      }),
      execute: async ({ feedUrls }) => {
        const results = await Promise.allSettled(
          feedUrls.map((url) => fetchSingleFeed(url, todayStart, todayEnd)),
        );

        const feeds = [];
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          if (result.status === "fulfilled") {
            feeds.push(result.value);
          } else {
            feeds.push({
              url: feedUrls[i],
              title: feedUrls[i],
              error: result.reason?.message || "Failed to fetch",
              articles: [],
              totalCount: 0,
            });
          }
        }

        return { success: true, feeds };
      },
      toModelOutput: ({ output }) => textOutput(output),
    }),
  };
}

async function fetchSingleFeed(url, todayStart, todayEnd) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { "User-Agent": "FYP-RSS-Reader/1.0" },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const xml = await res.text();
  const { feed } = parseFeed(xml);

  const startDate = new Date(todayStart);
  const endDate = new Date(todayEnd);

  const allArticles = (feed.items || []).filter((item) => {
    const pubDate = item.published || item.updated;
    if (!pubDate) return false;
    const d = new Date(pubDate);
    return d >= startDate && d <= endDate;
  });

  const articles = allArticles.slice(0, 10).map((item) => ({
    title: item.title || "Untitled",
    link: item.links?.[0]?.href || item.link || "",
    description: (item.description || item.summary || "").slice(0, 300),
    pubDate: (item.published || item.updated || "").toString(),
  }));

  return {
    url,
    title: feed.title || url,
    articles,
    totalCount: allArticles.length,
  };
}
