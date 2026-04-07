import connectDB, { getDatabase } from "../lib/db.js";
import { DEFAULT_FEEDS } from "../lib/rss/defaultFeeds.js";

async function seedRssFeeds() {
  await connectDB();
  const db = await getDatabase();
  const col = db.collection("rssFeeds");

  console.log("Seeding RSS feeds...");

  // Check if already seeded
  const existing = await col.countDocuments({ isDefault: true });
  if (existing > 0) {
    console.log(`Already seeded (${existing} default feeds exist). Skipping insert.`);
  } else {
    const docs = DEFAULT_FEEDS.map((feed) => ({
      url: feed.url,
      title: feed.title,
      category: feed.category,
      isDefault: true,
      createdBy: null,
      createdAt: new Date(),
    }));
    const result = await col.insertMany(docs);
    console.log(`Inserted ${result.insertedCount} default feeds.`);
  }

  // Create indexes
  console.log("Creating indexes...");

  await col.createIndex(
    { isDefault: 1, category: 1 },
    { name: "rssFeeds_default_category" },
  );

  const subCol = db.collection("rssSubscriptions");
  await subCol.createIndex(
    { userId: 1 },
    { name: "rssSubs_userId" },
  );
  await subCol.createIndex(
    { userId: 1, feedId: 1 },
    { unique: true, name: "rssSubs_userId_feedId" },
  );

  console.log("RSS indexes created successfully.");
  process.exit(0);
}

seedRssFeeds().catch((err) => {
  console.error("Failed to seed RSS feeds:", err);
  process.exit(1);
});
