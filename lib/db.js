import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

function validateEnv() {
  if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable in .env.local");
  }
  if (!MONGODB_DB) {
    throw new Error("Please define the MONGODB_DB environment variable in .env.local");
  }
}

// Global cached connection for serverless functions
let cached = global.mongo;

if (!cached) {
  cached = global.mongo = { conn: null, promise: null };
}

/**
 * Connect to MongoDB using native driver
 * Implements connection pooling and caching for Next.js serverless functions
 */
async function connectDB() {
  validateEnv();
  
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached.promise = MongoClient.connect(MONGODB_URI, opts).then((client) => {
      return {
        client: client,
        db: client.db(MONGODB_DB),
      };
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

/**
 * Get database instance
 */
export async function getDatabase() {
  const { db } = await connectDB();
  return db;
}

/**
 * Get collection instance
 * @param {string} collectionName - Name of the collection
 */
export async function getCollection(collectionName) {
  const db = await getDatabase();
  return db.collection(collectionName);
}

export default connectDB;
