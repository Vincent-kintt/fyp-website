import { getCollection } from "@/lib/db";

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

/** Resolve the user's subscribed feeds (url + title + category) for server-side fetching. */
export async function getSubscribedFeeds(userId) {
  const subsCol = await getRssSubscriptionsCollection();
  const subs = await subsCol.find({ userId }).toArray();
  if (subs.length === 0) return [];

  const feedsCol = await getRssFeedsCollection();
  const feeds = await feedsCol
    .find({ _id: { $in: subs.map((s) => s.feedId) } })
    .toArray();
  return feeds
    .filter((f) => f.url)
    .map((f) => ({ url: f.url, title: f.title, category: f.category }));
}
