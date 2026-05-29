import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db.js", () => ({
  getCollection: vi.fn(),
}));

import { getCollection } from "@/lib/db.js";
import { createRssTools, MAX_FEED_URLS } from "@/lib/ai/rssTools.js";

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

  describe("getUserSubscriptions", () => {
    it("returns empty array when no subscriptions", async () => {
      const result = await tools.getUserSubscriptions.execute({});
      expect(result.success).toBe(true);
      expect(result.subscriptions).toEqual([]);
    });

    it("returns subscriptions with feed details", async () => {
      const feedId = { toString: () => "feed-1" };
      mockSubsCol.toArray.mockResolvedValue([
        { _id: { toString: () => "sub-1" }, userId, feedId },
      ]);
      mockFeedsCol.find.mockReturnThis();
      mockFeedsCol.toArray.mockResolvedValue([
        { _id: feedId, url: "https://example.com/feed", title: "Example", category: "technology" },
      ]);

      const result = await tools.getUserSubscriptions.execute({});
      expect(result.success).toBe(true);
      expect(result.subscriptions).toHaveLength(1);
      expect(result.subscriptions[0].url).toBe("https://example.com/feed");
    });
  });

  describe("fetchRSSFeeds", () => {
    const catalogUrl = "https://example.com/feed";

    // Configure the name-branched collection mocks so getSubscribedUrls()
    // resolves the given canonical feed URLs from the user's subscriptions.
    // getSubscribedUrls reads rssSubscriptions (carry feedId) then rssFeeds
    // (carry url), so the two collections must stay distinct for the
    // canonical-fetch assertion to be meaningful.
    function subscribeTo(urls) {
      const feedDocs = urls.map((url, i) => {
        const id = { toString: () => `feed-${i}` };
        return { _id: id, url };
      });
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

    it("rejects non-subscribed urls before fetching (allowlist gate is pre-fetch)", async () => {
      subscribeTo([catalogUrl]);
      const fetchMock = vi.fn(() =>
        okResponse(rssXml({ pubDate: "Tue, 07 Apr 2026 08:00:00 +0800" })),
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await tools.fetchRSSFeeds.execute({
        feedUrls: [catalogUrl, "https://evil.com/feed"],
      });

      const evilEntry = result.feeds.find((f) => f.url === "https://evil.com/feed");
      expect(evilEntry).toBeDefined();
      expect(evilEntry.error).toBe("Not in your subscriptions");
      expect(evilEntry.articles).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("blocks internal/reserved addresses even when present in subscriptions", async () => {
      const internalUrl = "http://169.254.169.254/feed";
      subscribeTo([internalUrl]);
      const fetchMock = vi.fn(() => okResponse(rssXml({ pubDate: "Tue, 07 Apr 2026 08:00:00 +0800" })));
      vi.stubGlobal("fetch", fetchMock);

      const result = await tools.fetchRSSFeeds.execute({ feedUrls: [internalUrl] });

      const entry = result.feeds.find((f) => f.url === internalUrl);
      expect(entry).toBeDefined();
      expect(entry.error).toBe("Internal/reserved address blocked");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("matches scheme-insensitively and fetches the canonical (subscribed) url", async () => {
      const canonical = "http://feeds.arstechnica.com/arstechnica/index/";
      subscribeTo([canonical]);
      const fetchMock = vi.fn(() => okResponse(rssXml({ pubDate: "Tue, 07 Apr 2026 08:00:00 +0800" })));
      vi.stubGlobal("fetch", fetchMock);

      const result = await tools.fetchRSSFeeds.execute({
        feedUrls: ["https://feeds.arstechnica.com/arstechnica/index/"],
      });

      const hasRejection = result.feeds.some(
        (f) => f.error === "Not in your subscriptions",
      );
      expect(hasRejection).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(canonical, expect.anything());
    });

    it("enforces MAX_FEED_URLS on the input schema", () => {
      const tooMany = Array(MAX_FEED_URLS + 1).fill("https://x.com/feed");
      expect(
        tools.fetchRSSFeeds.inputSchema.safeParse({ feedUrls: tooMany }).success,
      ).toBe(false);

      const atLimit = Array(MAX_FEED_URLS).fill("https://x.com/feed");
      expect(
        tools.fetchRSSFeeds.inputSchema.safeParse({ feedUrls: atLimit }).success,
      ).toBe(true);
    });

    it("parses articles within today's window on the happy path", async () => {
      subscribeTo([catalogUrl]);
      const fetchMock = vi.fn(() =>
        okResponse(
          rssXml({ itemTitle: "Hello World", pubDate: "Tue, 07 Apr 2026 12:00:00 +0800" }),
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await tools.fetchRSSFeeds.execute({ feedUrls: [catalogUrl] });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.feeds[0].error).toBeUndefined();
      expect(result.feeds[0].totalCount).toBe(1);
      expect(result.feeds[0].articles[0].title).toBe("Hello World");
    });

    it("isolates per-feed transport failures (Promise.allSettled)", async () => {
      const urlA = "https://a.example.com/feed";
      const urlB = "https://b.example.com/feed";
      subscribeTo([urlA, urlB]);
      const fetchMock = vi.fn((url) => {
        if (url === urlA) return Promise.reject(new Error("ECONNREFUSED"));
        return okResponse(rssXml({ itemTitle: "From B", pubDate: "Tue, 07 Apr 2026 09:00:00 +0800" }));
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await tools.fetchRSSFeeds.execute({ feedUrls: [urlA, urlB] });

      expect(result.success).toBe(true);
      const entryA = result.feeds.find((f) => f.url === urlA);
      const entryB = result.feeds.find((f) => f.url === urlB);
      expect(entryA.error).toBeTruthy();
      expect(entryA.articles).toEqual([]);
      expect(entryB.error).toBeUndefined();
      expect(entryB.articles[0].title).toBe("From B");
    });
  });
});
