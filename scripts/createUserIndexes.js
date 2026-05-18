// Race-safety dependency for POST /api/auth/register's atomic-insert path.
//
// The route relies on the MongoDB unique index to detect duplicate username
// or email under concurrent register requests, then catches `code: 11000` and
// maps it to 409. Without these indexes the race re-opens — two parallel
// requests with the same email can both insertOne and create duplicate
// accounts, and the route would silently 500 on whichever race conditions
// the DB driver surfaces.
//
// Run as part of DB bootstrap:
//   npm run create-user-indexes
//
// Exports `createUserIndexes(db)` so integration tests can apply the same
// schema against `mongodb-memory-server` and verify the contract end-to-end.

import connectDB, { getDatabase } from "../lib/db.js";

/**
 * Create unique indexes on `username` and `email` in the `users` collection.
 *
 * Plain unique (not partial). `partialFilterExpression: { email: {$exists: true} }`
 * would be necessary if we still had legacy users with null emails — current
 * `app/api/auth/register/route.js` always sets both fields, and the dev
 * seed (`scripts/initUsers.js`) does too, so unconditional unique is the
 * tighter contract.
 *
 * Both indexes are idempotent: `createIndex` is a no-op when an index with
 * the same key+options already exists.
 */
export async function createUserIndexes(db) {
  const users = db.collection("users");

  const usernameIndex = await users.createIndex(
    { username: 1 },
    { unique: true, name: "users_username_unique" },
  );

  const emailIndex = await users.createIndex(
    { email: 1 },
    { unique: true, name: "users_email_unique" },
  );

  return { usernameIndex, emailIndex };
}

async function main() {
  await connectDB();
  const db = await getDatabase();
  const result = await createUserIndexes(db);
  console.log("Created user indexes:", result);
  process.exit(0);
}

// Only run main() when invoked as a script (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
