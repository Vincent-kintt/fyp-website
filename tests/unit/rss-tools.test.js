import { describe, it, expect, vi, beforeEach } from "vitest";

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
});
