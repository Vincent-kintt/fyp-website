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
