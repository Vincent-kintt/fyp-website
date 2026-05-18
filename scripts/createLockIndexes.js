// Correctness dependency for lib/locks/acquireUserAILock.js.
//
// The lock helper relies on a TTL index to reap docs whose owners crashed
// mid-stream and never released. `expireAfterSeconds: 0` tells MongoDB:
// delete the doc once its `expiresAt` field is in the past. The reaper
// runs roughly once per minute, but the acquire filter already treats an
// expired doc as available, so the reap window doesn't affect correctness
// — only how long the doc lingers on disk.
//
// Exported as a function so integration tests can apply the schema to
// mongodb-memory-server. Run as a script with:
//   npm run create-lock-indexes

import connectDB, { getDatabase } from "../lib/db.js";

export async function createLockIndexes(db) {
  const locks = db.collection("locks");

  const expiresAtIndex = await locks.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: "locks_ttl_expiresAt" },
  );

  return { expiresAtIndex };
}

async function main() {
  await connectDB();
  const db = await getDatabase();
  const result = await createLockIndexes(db);
  console.log("Created lock indexes:", result);
  process.exit(0);
}

// Only run main() when invoked as a script (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
