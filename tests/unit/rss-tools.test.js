import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db.js", () => ({
  getCollection: vi.fn(),
}));

import { getCollection } from "@/lib/db.js";
import { createRssTools } from "@/lib/ai/rssTools.js";

describe("createRssTools", () => {
  const userId = "user-123";
  const todayStart = "2026-04-07T00:00:00+08:00";
  const todayEnd = "2026-04-07T23:59:59+08:00";
  let tools;
  let mockSubsCol;
  let mockFeedsCol;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSubsCol = {
      find: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    };
    mockFeedsCol = {
      find: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    };

    getCollection.mockImplementation((name) => {
      if (name === "rssSubscriptions") return Promise.resolve(mockSubsCol);
      if (name === "rssFeeds") return Promise.resolve(mockFeedsCol);
      return Promise.resolve({});
    });

    tools = createRssTools(userId, todayStart, todayEnd);
  });

  describe("fetchRSSFeeds", () => {
    // getSubscribedFeeds joins rssSubscriptions (carry feedId) with rssFeeds
    // (carry url/title/category). Configure both, branched by collection name,
    // so the join produces the given subscribed feeds.
    function subscribeTo(feeds) {
      const feedDocs = feeds.map((feed, i) => ({
        _id: { toString: () => `feed-${i}` },
        url: feed.url,
        title: feed.title,
        category: feed.category,
      }));
      mockSubsCol.toArray.mockResolvedValue(
        feedDocs.map((f, i) => ({
          _id: { toString: () => `sub-${i}` },
          userId,
          feedId: f._id,
        })),
      );
      mockFeedsCol.toArray.mockResolvedValue(feedDocs);
    }

    function rssXml({ title = "Example Feed", itemTitle = "Today Article", pubDate }) {
      return `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>${title}</title>
  <item>
    <title>${itemTitle}</title>
    <link>https://example.com/articles/1</link>
    <description>An article</description>
    <pubDate>${pubDate}</pubDate>
  </item>
</channel></rss>`;
    }

    function okResponse(body) {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(body),
      });
    }

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("fetches all subscribed feeds with no arguments, returning url/title/category/status/articles", async () => {
      subscribeTo([
        { url: "https://a.example.com/feed", title: "Feed A", category: "technology" },
        { url: "https://b.example.com/feed", title: "Feed B", category: "science" },
      ]);
      const fetchMock = vi.fn(() =>
        okResponse(rssXml({ pubDate: "Tue, 07 Apr 2026 08:00:00 +0800" })),
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await tools.fetchRSSFeeds.execute({});

      expect(result.success).toBe(true);
      expect(result.feeds).toHaveLength(2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      for (const feed of result.feeds) {
        expect(feed).toHaveProperty("url");
        expect(feed).toHaveProperty("title");
        expect(feed).toHaveProperty("category");
        expect(feed.status).toBe("ok");
        expect(Array.isArray(feed.articles)).toBe(true);
      }
    });

    it("carries the feed category into the output (grouping data preserved)", async () => {
      subscribeTo([
        { url: "https://a.example.com/feed", title: "Feed A", category: "world_news" },
      ]);
      const fetchMock = vi.fn(() =>
        okResponse(rssXml({ pubDate: "Tue, 07 Apr 2026 08:00:00 +0800" })),
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await tools.fetchRSSFeeds.execute({});

      expect(result.feeds[0].category).toBe("world_news");
    });

    it("blocks internal/reserved addresses without fetching (defense-in-depth)", async () => {
      const internalUrl = "http://169.254.169.254/feed";
      subscribeTo([{ url: internalUrl, title: "Poisoned", category: "technology" }]);
      const fetchMock = vi.fn(() =>
        okResponse(rssXml({ pubDate: "Tue, 07 Apr 2026 08:00:00 +0800" })),
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await tools.fetchRSSFeeds.execute({});

      const entry = result.feeds.find((f) => f.url === internalUrl);
      expect(entry).toBeDefined();
      expect(entry.status).toBe("error");
      expect(entry.error).toContain("Internal/reserved address blocked");
      expect(entry.articles).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("isolates per-feed transport failures (Promise.allSettled)", async () => {
      const urlA = "https://a.example.com/feed";
      const urlB = "https://b.example.com/feed";
      subscribeTo([
        { url: urlA, title: "Feed A", category: "technology" },
        { url: urlB, title: "Feed B", category: "science" },
      ]);
      const fetchMock = vi.fn((url) => {
        if (url === urlA) return Promise.reject(new Error("ECONNREFUSED"));
        return okResponse(
          rssXml({ itemTitle: "From B", pubDate: "Tue, 07 Apr 2026 09:00:00 +0800" }),
        );
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await tools.fetchRSSFeeds.execute({});

      expect(result.success).toBe(true);
      const entryA = result.feeds.find((f) => f.url === urlA);
      const entryB = result.feeds.find((f) => f.url === urlB);
      expect(entryA.status).toBe("error");
      expect(entryA.articles).toEqual([]);
      expect(entryB.status).toBe("ok");
      expect(entryB.articles[0].title).toBe("From B");
    });

    it("parses articles within today's window on the happy path", async () => {
      const url = "https://a.example.com/feed";
      subscribeTo([{ url, title: "Feed A", category: "technology" }]);
      const fetchMock = vi.fn(() =>
        okResponse(
          rssXml({ itemTitle: "Hello World", pubDate: "Tue, 07 Apr 2026 12:00:00 +0800" }),
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await tools.fetchRSSFeeds.execute({});

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.feeds[0].status).toBe("ok");
      expect(result.feeds[0].totalCount).toBe(1);
      expect(result.feeds[0].articles[0].title).toBe("Hello World");
    });

    it("returns an empty feeds list and does not fetch when there are no subscriptions", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const result = await tools.fetchRSSFeeds.execute({});

      expect(result).toEqual({ success: true, feeds: [] });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
