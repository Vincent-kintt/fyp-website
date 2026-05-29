import { tool } from "ai";
import { z } from "zod";
import { getCollection } from "@/lib/db.js";
import { parseFeed } from "feedsmith";
import { textOutput } from "@/lib/ai/tools.js";
import { getSubscribedUrls, normalizeUrlKey } from "@/lib/rss/db.js";
import { isFeedUrlSafe } from "@/lib/rss/urlGuard.js";
import { logAIEvent } from "@/lib/ai/logAIEvent.js";

// Upper bound on a single fetchRSSFeeds call. >= the catalog size (21) so a
// legitimate "fetch everything" request fits; guards against absurd arrays.
export const MAX_FEED_URLS = 40;

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
          .max(MAX_FEED_URLS)
          .describe("Array of RSS feed URLs to fetch"),
      }),
      execute: async ({ feedUrls }) => {
        // Allowlist: only the user's own subscribed feeds may be fetched. Keyed
        // by canonical URL so the LLM can re-emit a feed with a different
        // scheme/trailing-slash/host-case and still match.
        const allowed = new Map();
        for (const url of await getSubscribedUrls(userId)) {
          try {
            allowed.set(normalizeUrlKey(url), url);
          } catch {
            // Skip a single malformed catalog URL rather than failing the
            // whole digest.
          }
        }

        const rejected = [];
        const safe = []; // canonical (subscribed) URLs only
        for (const url of feedUrls) {
          let key;
          try {
            key = normalizeUrlKey(url);
          } catch {
            key = null;
          }
          const canonical = key ? allowed.get(key) : undefined;
          if (!canonical) {
            rejected.push({ url, reason: "Not in your subscriptions" });
            continue;
          }
          const guard = isFeedUrlSafe(canonical);
          if (!guard.ok) {
            rejected.push({ url, reason: guard.reason });
            continue;
          }
          safe.push(canonical);
        }

        if (rejected.length) {
          logAIEvent("rss_fetch_rejected", {
            userId,
            count: rejected.length,
            urls: rejected,
          });
        }

        const results = await Promise.allSettled(
          safe.map((url) => fetchSingleFeed(url, todayStart, todayEnd)),
        );

        const feeds = [
          ...rejected.map((r) => ({
            url: r.url,
            title: r.url,
            error: r.reason,
            articles: [],
            totalCount: 0,
          })),
          ...results.map((res, i) =>
            res.status === "fulfilled"
              ? res.value
              : {
                  url: safe[i],
                  title: safe[i],
                  error: res.reason?.message || "Failed to fetch",
                  articles: [],
                  totalCount: 0,
                },
          ),
        ];

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

  // feedsmith RSS 2.0 uses `pubDate`; Atom feeds use `published` or `updated`
  const allArticles = (feed.items || []).filter((item) => {
    const pubDate = item.pubDate || item.published || item.updated;
    if (!pubDate) return false;
    const d = new Date(pubDate);
    return d >= startDate && d <= endDate;
  });

  const articles = allArticles.slice(0, 10).map((item) => ({
    title: item.title || "Untitled",
    link: item.link || item.links?.[0]?.href || "",
    description: (item.description || item.summary || "").slice(0, 300),
    pubDate: (item.pubDate || item.published || item.updated || "").toString(),
  }));

  return {
    url,
    title: feed.title || url,
    articles,
    totalCount: allArticles.length,
  };
}
