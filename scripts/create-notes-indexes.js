import connectDB, { getDatabase } from "../lib/db.js";

async function createNotesIndexes() {
  await connectDB();
  const db = await getDatabase();
  const col = db.collection("notes");

  console.log("Creating notes indexes...");

  await col.createIndex(
    { userId: 1, parentId: 1, sortOrder: 1 },
    { name: "notes_user_parent_sort" },
  );

  await col.createIndex(
    { userId: 1, updatedAt: -1 },
    { name: "notes_user_updated" },
  );

  console.log("Notes indexes created successfully.");
  process.exit(0);
}

createNotesIndexes().catch((err) => {
  console.error("Failed to create indexes:", err);
  process.exit(1);
});
