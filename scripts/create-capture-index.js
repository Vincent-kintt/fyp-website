import connectDB, { getDatabase } from "../lib/db.js";

async function createCaptureIndex() {
  await connectDB();
  const db = await getDatabase();
  const collection = db.collection("notes");

  await collection.createIndex(
    { userId: 1, type: 1 },
    {
      unique: true,
      partialFilterExpression: { type: "inbox-capture" },
      name: "unique_inbox_capture_per_user",
    },
  );

  console.log("Created unique partial index: unique_inbox_capture_per_user");
  process.exit(0);
}

createCaptureIndex().catch((err) => {
  console.error("Failed to create index:", err);
  process.exit(1);
});
