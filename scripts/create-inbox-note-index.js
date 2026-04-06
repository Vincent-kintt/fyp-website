import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

async function createIndex() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
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
  } finally {
    await client.close();
  }
}

createIndex().catch(console.error);
