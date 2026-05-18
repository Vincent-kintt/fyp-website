/**
 * Migration: convert integer / malformed sortOrder values on the `notes`
 * collection to fractional indexing strings (see lib/notes/sortOrder.js).
 *
 * Idempotent: notes whose sortOrder is already a VALID fractional key are
 * skipped. Numeric values, missing values, and strings that fail
 * `generateKeyBetween` validation (e.g. trailing-zero keys like `a91000` left
 * over from older inserts) are all re-migrated alongside legacy numerics.
 *
 * Stop-the-world: groups notes by (userId, parentId) and assigns N evenly-spaced
 * keys via generateNKeysBetween — the current relative order is preserved.
 *
 * Flags:
 *   --dry-run    Log planned updates without writing to the database.
 *
 * Run with: node --env-file=.env.local scripts/migrateNotesSortOrder.js
 *           node --env-file=.env.local scripts/migrateNotesSortOrder.js --dry-run
 */

import { MongoClient } from "mongodb";
import {
  generateKeyBetween,
  generateNKeysBetween,
} from "fractional-indexing";

// A sortOrder is a valid fractional key iff `generateKeyBetween(s, null)`
// accepts it as the previous neighbour. The library validates head char,
// integer-part length, and rejects trailing-zero fractionals — exactly the
// invariants downstream inserts rely on. Anything that throws here would
// crash POST /api/notes when picked as `lastSibling.sortOrder`.
function isValidFractionalKey(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    generateKeyBetween(value, null);
    return true;
  } catch {
    return false;
  }
}

export async function migrateNotesSortOrder(db, { dryRun = false } = {}) {
  const notes = db.collection("notes");

  // Group all notes by (userId, parentId). We can't pre-filter by type at the
  // aggregate stage anymore — string validity must be inspected per doc.
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
  let invalidStringsTotal = 0;
  const invalidByUser = new Map();

  for await (const group of groupsCursor) {
    const userId = String(group._id.userId);
    const toMigrate = [];
    let invalidInGroup = 0;

    for (const item of group.items) {
      if (isValidFractionalKey(item.sortOrder)) {
        skipped++;
      } else {
        if (typeof item.sortOrder === "string" && item.sortOrder.length > 0) {
          invalidInGroup++;
          invalidStringsTotal++;
        }
        toMigrate.push(item);
      }
    }

    if (invalidInGroup > 0) {
      invalidByUser.set(
        userId,
        (invalidByUser.get(userId) ?? 0) + invalidInGroup,
      );
    }

    if (toMigrate.length === 0) continue;

    // Preserve current relative order by sorting by existing numeric sortOrder.
    // Falsy (undefined / null) and invalid strings sort to the front
    // consistently — they're already broken, so any deterministic placement
    // is acceptable; the post-migration relative order remains stable
    // because lex order on the regenerated keys matches insertion order.
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

    if (dryRun) {
      converted += ops.length;
      continue;
    }

    const result = await notes.bulkWrite(ops);
    converted += result.modifiedCount;
  }

  // Audit log: per-user invalid-string counts (helps trace which user owns
  // the malformed keys without dumping every _id).
  for (const [userId, count] of invalidByUser) {
    console.log(
      `User ${userId}: ${count} invalid string keys detected, will be re-migrated`,
    );
  }

  return { converted, skipped, invalidStrings: invalidStringsTotal, dryRun };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) {
    console.error("Error: MONGODB_URI / MONGODB_DB must be set.");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log(
      `Connected to MongoDB${dryRun ? " (dry-run, no writes)" : ""}`,
    );
    const db = client.db(dbName);
    const summary = await migrateNotesSortOrder(db, { dryRun });
    console.log(
      `Migration ${dryRun ? "dry-run" : "complete"}: converted=${summary.converted} skipped=${summary.skipped} invalidStrings=${summary.invalidStrings}`,
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
