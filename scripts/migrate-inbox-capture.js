import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

async function migrate() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const notes = db.collection("notes");

    const captures = await notes.find({ type: "inbox-capture" }).toArray();
    console.log(`Found ${captures.length} inbox-capture documents`);

    for (const doc of captures) {
      await notes.updateOne(
        { _id: doc._id },
        {
          $set: { title: "Inbox Notes (migrated)" },
          $unset: { type: "" },
        },
      );
      console.log(`Migrated: ${doc._id}`);
    }

    // Drop the old partial index if it exists
    try {
      await notes.dropIndex("userId_1_type_1");
      console.log("Dropped old inbox-capture partial index");
    } catch {
      console.log("No inbox-capture index to drop");
    }

    console.log("Migration complete");
  } finally {
    await client.close();
  }
}

migrate().catch(console.error);
