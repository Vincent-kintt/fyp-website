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
