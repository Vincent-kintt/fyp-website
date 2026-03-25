import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

async function createIndexes() {
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db(MONGODB_DB);

  // push_subscriptions indexes
  const subs = db.collection("push_subscriptions");
  await subs.createIndex({ userId: 1 });
  await subs.createIndex({ endpoint: 1, userId: 1 }, { unique: true });
  await subs.createIndex({ updatedAt: 1 });

  // reminders: compound index for notification cron query
  const reminders = db.collection("reminders");
  await reminders.createIndex(
    { dateTime: 1, status: 1, notificationSent: 1 },
    { name: "idx_notification_due" }
  );

  console.log("Push notification indexes created successfully");
  await client.close();
}

createIndexes().catch(console.error);
