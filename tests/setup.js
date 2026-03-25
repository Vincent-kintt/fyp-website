/**
 * Test setup: in-memory MongoDB via mongodb-memory-server
 * Provides getTestCollection() for integration tests
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";

let mongod;
let client;
let db;

export async function setupTestDb() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  client = new MongoClient(uri);
  await client.connect();
  db = client.db("test_db");
  return { client, db };
}

export async function teardownTestDb() {
  if (client) await client.close();
  if (mongod) await mongod.stop();
}

export function getTestDb() {
  return db;
}

export function getTestCollection(name) {
  return db.collection(name);
}
