import { describe, it, expect, vi } from "vitest";

// normalizeUrlKey lives in lib/rss/db.js, which top-level-imports @/lib/db.
// Mock it so this stays a pure unit test with no DB import-time coupling.
vi.mock("@/lib/db.js", () => ({
  getCollection: vi.fn(),
}));

import { DEFAULT_FEEDS, VALID_CATEGORIES } from "@/lib/rss/defaultFeeds.js";
import { normalizeUrlKey } from "@/lib/rss/db.js";

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

describe("normalizeUrlKey against the catalog (allowlist re-emission resilience)", () => {
  // Re-emission helpers: produce a URL the LLM might emit for the same feed.
  const upgradeScheme = (url) => {
    const u = new URL(url);
    u.protocol = "https:";
    return u.href;
  };
  const addTrailingSlash = (url) => {
    const u = new URL(url);
    if (!u.pathname.endsWith("/")) u.pathname += "/";
    return u.href;
  };
  const uppercaseHost = (url) => {
    const u = new URL(url);
    u.hostname = u.hostname.toUpperCase();
    return u.href;
  };

  const keyToUrl = new Map(DEFAULT_FEEDS.map((f) => [normalizeUrlKey(f.url), f.url]));

  it("each catalog url self-resolves via its normalized key", () => {
    for (const feed of DEFAULT_FEEDS) {
      expect(keyToUrl.get(normalizeUrlKey(feed.url))).toBe(feed.url);
    }
  });

  it("normalized keys are mutually unique (no silent shadowing in the Map)", () => {
    const keys = DEFAULT_FEEDS.map((f) => normalizeUrlKey(f.url));
    expect(new Set(keys).size).toBe(DEFAULT_FEEDS.length);
  });

  it("scheme/trailing-slash/host-case re-emission still resolves to the same feed", () => {
    for (const feed of DEFAULT_FEEDS) {
      for (const reemit of [upgradeScheme, addTrailingSlash, uppercaseHost]) {
        expect(keyToUrl.get(normalizeUrlKey(reemit(feed.url)))).toBe(feed.url);
      }
    }
  });

  it("does NOT case-fold the path (arxiv cs.AI vs cs.ai must stay distinct)", () => {
    const mixedCasePathFeed = DEFAULT_FEEDS.find((f) => {
      const path = new URL(f.url).pathname;
      return path !== path.toLowerCase();
    });

    // Lock the intent only if the catalog actually has a mixed-case path feed.
    expect(mixedCasePathFeed).toBeDefined();

    const u = new URL(mixedCasePathFeed.url);
    u.pathname = u.pathname.toLowerCase();
    const pathLowered = u.href;

    expect(keyToUrl.get(normalizeUrlKey(pathLowered))).not.toBe(mixedCasePathFeed.url);
  });
});
