import { getCollection } from "@/lib/db";
import { ObjectId } from "mongodb";

export async function getRssFeedsCollection() {
  return getCollection("rssFeeds");
}

export async function getRssSubscriptionsCollection() {
  return getCollection("rssSubscriptions");
}

export function formatSubscription(doc, feedDoc) {
  return {
    id: doc._id.toString(),
    feedId: doc.feedId.toString(),
    url: feedDoc?.url || null,
    title: feedDoc?.title || null,
    category: feedDoc?.category || null,
    subscribedAt: doc.subscribedAt,
  };
}

/**
 * Canonical key for matching an LLM-supplied feed URL against a subscribed one.
 * Scheme-insensitive on purpose (an http catalog feed must match an https
 * re-emission); host is lowercased; default ports are already dropped by URL;
 * a trailing slash is normalized away. Path case is preserved deliberately
 * (arXiv `cs.AI` and `cs.ai` are distinct feeds), and the query string is kept
 * verbatim. Throws on a malformed URL — callers decide how to handle that.
 */
export function normalizeUrlKey(rawUrl) {
  const u = new URL(rawUrl);
  const host = u.hostname.toLowerCase();
  const port = u.port ? `:${u.port}` : "";
  const path = u.pathname.replace(/\/+$/, "") || "/";
  return `${host}${port}${path}${u.search}`;
}

/**
 * Resolve the canonical feed URLs the user is actually subscribed to. Used as
 * the allowlist source for server-side RSS fetching.
 */
export async function getSubscribedUrls(userId) {
  const subsCol = await getRssSubscriptionsCollection();
  const subs = await subsCol.find({ userId }).toArray();
  if (subs.length === 0) return [];

  const feedsCol = await getRssFeedsCollection();
  const feeds = await feedsCol
    .find({ _id: { $in: subs.map((s) => s.feedId) } })
    .toArray();
  return feeds.map((f) => f.url).filter(Boolean);
}
