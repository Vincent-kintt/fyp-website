import { describe, it, expect } from "vitest";
import { DEFAULT_FEEDS, VALID_CATEGORIES } from "@/lib/rss/defaultFeeds.js";

describe("DEFAULT_FEEDS", () => {
  it("has feeds for every valid category", () => {
    const categoriesInFeeds = [...new Set(DEFAULT_FEEDS.map((f) => f.category))];
    for (const cat of VALID_CATEGORIES) {
      expect(categoriesInFeeds).toContain(cat);
    }
  });

  it("every feed has required fields", () => {
    for (const feed of DEFAULT_FEEDS) {
      expect(feed.url).toBeTruthy();
      expect(feed.url).toMatch(/^https?:\/\//);
      expect(feed.title).toBeTruthy();
      expect(VALID_CATEGORIES).toContain(feed.category);
    }
  });

  it("has no duplicate URLs", () => {
    const urls = DEFAULT_FEEDS.map((f) => f.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
