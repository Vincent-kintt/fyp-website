import { tool } from "ai";
import { z } from "zod";
import { parseFeed } from "feedsmith";
import { textOutput } from "@/lib/ai/tools.js";
import { getSubscribedFeeds } from "@/lib/rss/db.js";
import { isFeedUrlSafe } from "@/lib/rss/urlGuard.js";
import { logAIEvent } from "@/lib/ai/logAIEvent.js";

export function createRssTools(userId, todayStart, todayEnd) {
  return {
    fetchRSSFeeds: tool({
      description:
        "Fetch and parse today's articles from ALL of the user's subscribed RSS feeds. Each feed is returned with its category and a per-feed status. This is the only RSS tool — call it once, with no arguments.",
      inputSchema: z.object({}),
      execute: async () => {
        const subscribed = await getSubscribedFeeds(userId); // [{ url, title, category }]
        if (subscribed.length === 0) return { success: true, feeds: [] };

        const results = await Promise.allSettled(
          subscribed.map((f) => fetchSingleFeed(f, todayStart, todayEnd)),
        );

        const feeds = results.map((res, i) => {
          if (res.status === "fulfilled") return res.value;
          const f = subscribed[i];
          return {
            url: f.url,
            title: f.title || f.url,
            category: f.category,
            status: "error",
            error: res.reason?.message || "Failed to fetch",
            articles: [],
            totalCount: 0,
          };
        });

        const failed = feeds.filter((f) => f.status === "error");
        if (failed.length) {
          logAIEvent("rss_feeds_failed", {
            userId,
            count: failed.length,
            urls: failed.map((f) => f.url),
          });
        }

        return { success: true, feeds };
      },
      toModelOutput: ({ output }) => textOutput(output),
    }),
  };
}

async function fetchSingleFeed(sub, todayStart, todayEnd) {
  // Defense-in-depth: a subscribed URL still has to clear the SSRF guard in
  // case a poisoned/malformed catalog entry ever reaches the DB.
  const guard = isFeedUrlSafe(sub.url);
  if (!guard.ok) throw new Error(guard.reason);

  const res = await fetch(sub.url, {
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
    url: sub.url,
    title: feed.title || sub.title || sub.url,
    category: sub.category,
    status: "ok",
    articles,
    totalCount: allArticles.length,
  };
}
