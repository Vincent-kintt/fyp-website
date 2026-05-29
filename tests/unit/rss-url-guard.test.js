import { describe, it, expect } from "vitest";
import { isFeedUrlSafe } from "@/lib/rss/urlGuard.js";

describe("isFeedUrlSafe", () => {
  const blocked = [
    ["loopback IPv4", "http://127.0.0.1/feed"],
    ["cloud metadata link-local", "http://169.254.169.254/latest/meta-data/"],
    ["RFC1918 10/8", "http://10.0.0.5/feed"],
    ["RFC1918 192.168/16", "http://192.168.1.1/feed"],
    ["IPv6 loopback", "http://[::1]/feed"],
    ["IPv4-mapped IPv6 loopback", "http://[::ffff:127.0.0.1]/feed"],
    ["this-host 0.0.0.0", "http://0.0.0.0/feed"],
    ["decimal-encoded loopback", "http://2130706433/feed"],
    ["hex-encoded loopback", "http://0x7f.0.0.1/feed"],
    ["file scheme", "file:///etc/passwd"],
    ["gopher scheme", "gopher://x/"],
    ["ftp scheme", "ftp://x/"],
    ["userinfo confusion", "http://www.nature.com@evil.com/feed"],
    ["malformed url", "not a url"],
  ];

  for (const [label, url] of blocked) {
    it(`blocks ${label} (${url})`, () => {
      expect(isFeedUrlSafe(url).ok).toBe(false);
    });
  }

  const allowed = [
    ["public hostname feed", "https://feeds.bbci.co.uk/news/world/rss.xml"],
    ["public IP literal", "https://8.8.8.8/feed"],
  ];

  for (const [label, url] of allowed) {
    it(`allows ${label} (${url})`, () => {
      expect(isFeedUrlSafe(url).ok).toBe(true);
    });
  }
});
