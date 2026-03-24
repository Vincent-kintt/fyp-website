import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "reminder-app";

if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI is not set.");
  console.error("Run with: node --env-file=.env.local scripts/initUsers.js");
  process.exit(1);
}

async function initUsers() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(MONGODB_DB);
    const usersCollection = db.collection("users");

    // Check if users already exist
    const existingAdmin = await usersCollection.findOne({ username: "admin" });
    const existingUser = await usersCollection.findOne({ username: "user" });

    if (existingAdmin && existingUser) {
      console.log("Users already exist!");
      return;
    }

    // Hash passwords
    const adminPassword = await bcrypt.hash("admin", 10);
    const userPassword = await bcrypt.hash("user", 10);

    // Create users array
    const users = [
      {
        username: "admin",
        password: adminPassword,
        role: "admin",
        createdAt: new Date(),
      },
      {
        username: "user",
        password: userPassword,
        role: "user",
        createdAt: new Date(),
      },
    ];

    // Insert users if they don't exist
    const usersToInsert = [];

    if (!existingAdmin) {
      usersToInsert.push(users[0]);
    }

    if (!existingUser) {
      usersToInsert.push(users[1]);
    }

    if (usersToInsert.length > 0) {
      await usersCollection.insertMany(usersToInsert);
      console.log(`✅ Created ${usersToInsert.length} user(s) successfully!`);

      usersToInsert.forEach(user => {
        console.log(`   - Username: ${user.username}, Password: ${user.username}, Role: ${user.role}`);
      });
    }

    // Create unique index on username
    await usersCollection.createIndex({ username: 1 }, { unique: true });
    console.log("✅ Created unique index on username");

  } catch (error) {
    console.error("Error initializing users:", error);
  } finally {
    await client.close();
    console.log("Disconnected from MongoDB");
  }
}

initUsers();
