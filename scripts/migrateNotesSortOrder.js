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
 * Ordering matches lib/notes/tree.js `compareNotes`: numeric / null /
 * undefined sortOrder is coerced to "" by `formatNote` on the wire, so the
 * app sorts them BEFORE any non-empty string key (lex "" < "a..."), with
 * `_id` as tiebreaker. The migration mirrors this exactly — non-string keys
 * sort before string keys; within each bucket, lex / id tiebreak — so the
 * post-migration visual order matches what users were seeing pre-migration.
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

// Comparator that matches lib/notes/tree.js `compareNotes` semantics after
// `formatNote` coerces non-string sortOrder to null:
//   1. Non-string sortOrder (number/null/undefined) → "" → sorts BEFORE any
//      non-empty string sortOrder.
//   2. Within the non-string bucket, no sortOrder distinguishes items; fall
//      through to the _id tiebreak.
//   3. Within the string bucket, lex compare on the raw string, then _id
//      tiebreak. Invalid strings (e.g. "a91000", "!", "~") are still strings
//      and lex-compare normally.
//   4. _id tiebreak via String(...) for both branches — ObjectId.toString()
//      returns the hex form, which lex-sorts identically to its byte order.
function migrationSortCompare(a, b) {
  const aIsString = typeof a.sortOrder === "string";
  const bIsString = typeof b.sortOrder === "string";

  if (aIsString !== bIsString) return aIsString ? 1 : -1;

  if (aIsString) {
    if (a.sortOrder < b.sortOrder) return -1;
    if (a.sortOrder > b.sortOrder) return 1;
  }

  const aId = String(a._id);
  const bId = String(b._id);
  if (aId < bId) return -1;
  if (aId > bId) return 1;
  return 0;
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

    // If a group contains ANY invalid item we must re-migrate the ENTIRE
    // group — otherwise freshly-generated keys for invalid items land at an
    // undefined lex position relative to the retained valid keys, producing
    // non-deterministic ordering between siblings.
    const hasInvalidInGroup = group.items.some(
      (i) => !isValidFractionalKey(i.sortOrder),
    );

    if (!hasInvalidInGroup) {
      skipped += group.items.length;
      continue;
    }

    const toMigrate = group.items.slice();
    let invalidInGroup = 0;
    for (const item of toMigrate) {
      if (
        typeof item.sortOrder === "string" &&
        item.sortOrder.length > 0 &&
        !isValidFractionalKey(item.sortOrder)
      ) {
        invalidInGroup++;
        invalidStringsTotal++;
      }
    }

    if (invalidInGroup > 0) {
      invalidByUser.set(
        userId,
        (invalidByUser.get(userId) ?? 0) + invalidInGroup,
      );
    }

    // Preserve current app-visible order. Mirrors lib/notes/tree.js
    // `compareNotes` exactly: formatNote coerces non-string sortOrder to null,
    // compareNotes then treats null as "", and "" < any non-empty string
    // lexicographically — so non-string keys (numeric, null, undefined)
    // sort BEFORE string keys. Within each bucket, lex compare then `_id`
    // tiebreak (stringified ObjectId sort matches compareNotes's id tiebreak).
    toMigrate.sort(migrationSortCompare);

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
