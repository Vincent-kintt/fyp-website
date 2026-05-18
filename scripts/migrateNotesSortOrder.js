/**
 * Migration: convert integer sortOrder values on the `notes` collection to
 * fractional indexing strings (see lib/notes/sortOrder.js).
 *
 * Idempotent: notes whose sortOrder is already a string are skipped.
 *
 * Stop-the-world: groups notes by (userId, parentId) and assigns N evenly-spaced
 * keys via generateNKeysBetween — the current relative order is preserved.
 *
 * Run with: node --env-file=.env.local scripts/migrateNotesSortOrder.js
 */

import { MongoClient } from "mongodb";
import { generateNKeysBetween } from "fractional-indexing";

export async function migrateNotesSortOrder(db) {
  const notes = db.collection("notes");

  // Group all non-string-sortOrder notes by (userId, parentId)
  const groupsCursor = notes.aggregate([
    {
      $match: {
        // Inbox notes use type === "inbox" and sortOrder: 0 placeholder; they
        // don't participate in ordering, so leave them numeric.
        type: { $ne: "inbox" },
      },
    },
    {
      $group: {
        _id: { userId: "$userId", parentId: "$parentId" },
        items: {
          $push: { _id: "$_id", sortOrder: "$sortOrder" },
        },
      },
    },
  ]);

  let converted = 0;
  let skipped = 0;

  for await (const group of groupsCursor) {
    // Filter items that still have non-string sortOrder; skip those already migrated.
    const toMigrate = [];
    for (const item of group.items) {
      if (typeof item.sortOrder === "string" && item.sortOrder.length > 0) {
        skipped++;
      } else {
        toMigrate.push(item);
      }
    }

    if (toMigrate.length === 0) continue;

    // Preserve current relative order by sorting by existing numeric sortOrder.
    // Falsy (undefined / null) sortOrder sorts to the front consistently.
    toMigrate.sort((a, b) => {
      const av = typeof a.sortOrder === "number" ? a.sortOrder : 0;
      const bv = typeof b.sortOrder === "number" ? b.sortOrder : 0;
      return av - bv;
    });

    const keys = generateNKeysBetween(null, null, toMigrate.length);

    const ops = toMigrate.map((item, i) => ({
      updateOne: {
        filter: { _id: item._id },
        update: { $set: { sortOrder: keys[i] } },
      },
    }));

    const result = await notes.bulkWrite(ops);
    converted += result.modifiedCount;
  }

  return { converted, skipped };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) {
    console.error("Error: MONGODB_URI / MONGODB_DB must be set.");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    const db = client.db(dbName);
    const summary = await migrateNotesSortOrder(db);
    console.log(
      `Migration complete: converted=${summary.converted} skipped=${summary.skipped}`,
    );
  } finally {
    await client.close();
    console.log("Disconnected from MongoDB");
  }
}

const invokedDirectly =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("migrateNotesSortOrder.js");
if (invokedDirectly) {
  main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
