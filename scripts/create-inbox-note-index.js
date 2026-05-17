// Race-safety dependency for POST /api/inbox/note's ensure (upsert) semantics.
//
// The route's POST handler does a findOneAndUpdate({ userId, type: "inbox" })
// with { upsert: true } to create the per-user inbox singleton on first visit.
// Under concurrent first-visit requests (e.g. the GET → POST → GET fallback in
// hooks/useInboxNote.js firing twice from a double-mount or two tabs), MongoDB
// would happily insert two inbox docs unless a unique index prevents it.
//
// The partial filter scopes uniqueness to inbox docs only — other note types
// (regular notes, future types) are unaffected.
import connectDB, { getDatabase } from "../lib/db.js";

async function createIndex() {
  await connectDB();
  const db = await getDatabase();
  const notes = db.collection("notes");

  const result = await notes.createIndex(
    { userId: 1, type: 1 },
    {
      unique: true,
      partialFilterExpression: { type: "inbox" },
      name: "inbox_note_unique",
    },
  );
  console.log("Created inbox note index:", result);
  process.exit(0);
}

createIndex().catch((err) => {
  console.error(err);
  process.exit(1);
});
