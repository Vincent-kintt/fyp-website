import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";

let mongod;
let client;
let db;

export async function startDb(dbName = "test_db") {
  mongod = await MongoMemoryServer.create();
  client = new MongoClient(mongod.getUri());
  await client.connect();
  db = client.db(dbName);
  return { db, client, mongod };
}

export async function stopDb() {
  if (client) await client.close();
  if (mongod) await mongod.stop();
}

export async function clearDb() {
  if (!db) return;
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    await db.collection(col.name).deleteMany({});
  }
}

export function getDb() {
  return db;
}
