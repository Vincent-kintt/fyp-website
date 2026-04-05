import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

async function createIndex() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const reminders = db.collection("reminders");

    const result = await reminders.createIndex(
      { userId: 1, inboxState: 1, createdAt: -1 },
      {
        partialFilterExpression: { inboxState: "inbox" },
        name: "inbox_state_partial",
      },
    );
    console.log("Created inbox index:", result);
  } finally {
    await client.close();
  }
}

createIndex().catch(console.error);
