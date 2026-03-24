/**
 * Migration script: Backfill userId on reminders that only have username.
 *
 * Run with: node --env-file=.env.local scripts/migrateUserIds.js
 */

import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "reminder-app";

if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI is not set.");
  console.error("Run with: node --env-file=.env.local scripts/migrateUserIds.js");
  process.exit(1);
}

async function migrate() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(MONGODB_DB);
    const users = db.collection("users");
    const reminders = db.collection("reminders");

    // Build username -> userId lookup
    const allUsers = await users.find({}).toArray();
    const usernameToId = {};
    for (const user of allUsers) {
      usernameToId[user.username] = user._id.toString();
    }
    console.log(`Found ${allUsers.length} user(s): ${Object.keys(usernameToId).join(", ")}`);

    // Find reminders missing userId
    const missing = await reminders
      .find({ $or: [{ userId: { $exists: false } }, { userId: null }] })
      .toArray();

    console.log(`Found ${missing.length} reminder(s) missing userId`);

    let updated = 0;
    let skipped = 0;

    for (const reminder of missing) {
      const uid = usernameToId[reminder.username];
      if (uid) {
        await reminders.updateOne(
          { _id: reminder._id },
          { $set: { userId: uid } }
        );
        updated++;
      } else {
        console.warn(`  Skipped reminder "${reminder.title}" - no user found for username "${reminder.username}"`);
        skipped++;
      }
    }

    console.log(`Migration complete: ${updated} updated, ${skipped} skipped`);

    // Create index on userId for query performance
    await reminders.createIndex({ userId: 1 });
    console.log("Created index on reminders.userId");

  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await client.close();
    console.log("Disconnected from MongoDB");
  }
}

migrate();
