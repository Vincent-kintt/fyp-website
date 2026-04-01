import { MongoClient, ObjectId } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "reminder-app";

if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI is not set.");
  console.error(
    "Run with: node --env-file=.env.local scripts/seedTestTasks.js",
  );
  process.exit(1);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function seed() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(MONGODB_DB);

    // Find admin user
    const admin = await db.collection("users").findOne({ username: "admin" });
    if (!admin) {
      console.error("Admin user not found");
      process.exit(1);
    }
    const userId = admin._id.toString();
    console.log(`Admin userId: ${userId}`);

    // Delete all existing reminders for admin
    const deleteResult = await db
      .collection("reminders")
      .deleteMany({ userId });
    console.log(`Deleted ${deleteResult.deletedCount} existing tasks`);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const tasks = [
      // Overdue (3)
      {
        title: "Submit project proposal",
        dateTime: addDays(today, -3),
        tags: ["work"],
        sortOrder: 1000,
      },
      {
        title: "Pay electricity bill",
        dateTime: addDays(today, -1),
        tags: ["personal"],
        sortOrder: 2000,
      },
      {
        title: "Reply to client email",
        dateTime: addDays(today, -2),
        tags: ["work"],
        sortOrder: 3000,
      },
      // Today (4)
      {
        title: "Team standup meeting",
        dateTime: new Date(today.getTime() + 10 * 60 * 60 * 1000),
        tags: ["work"],
        sortOrder: 4000,
      },
      {
        title: "Review pull requests",
        dateTime: new Date(today.getTime() + 14 * 60 * 60 * 1000),
        tags: ["work"],
        sortOrder: 5000,
      },
      {
        title: "Buy groceries",
        dateTime: new Date(today.getTime() + 18 * 60 * 60 * 1000),
        tags: ["personal"],
        sortOrder: 6000,
      },
      {
        title: "Exercise at gym",
        dateTime: new Date(today.getTime() + 19 * 60 * 60 * 1000),
        tags: ["health"],
        sortOrder: 7000,
      },
      // Tomorrow (3)
      {
        title: "Doctor appointment",
        dateTime: new Date(addDays(today, 1).getTime() + 9 * 60 * 60 * 1000),
        tags: ["health"],
        sortOrder: 8000,
      },
      {
        title: "Prepare presentation slides",
        dateTime: new Date(addDays(today, 1).getTime() + 13 * 60 * 60 * 1000),
        tags: ["work"],
        sortOrder: 9000,
      },
      {
        title: "Call mom",
        dateTime: new Date(addDays(today, 1).getTime() + 20 * 60 * 60 * 1000),
        tags: ["personal"],
        sortOrder: 10000,
      },
      // This Week (3)
      {
        title: "Finish report draft",
        dateTime: addDays(today, 3),
        tags: ["work"],
        sortOrder: 11000,
      },
      {
        title: "Dentist checkup",
        dateTime: addDays(today, 4),
        tags: ["health"],
        sortOrder: 12000,
      },
      {
        title: "Team dinner reservation",
        dateTime: addDays(today, 5),
        tags: ["personal"],
        sortOrder: 13000,
      },
      // Completed (1)
      {
        title: "Set up CI/CD pipeline",
        dateTime: addDays(today, -1),
        tags: ["work"],
        sortOrder: 14000,
        status: "completed",
        completed: true,
        completedAt: new Date(),
      },
      // Snoozed (1)
      {
        title: "Read design patterns book",
        dateTime: today,
        tags: ["learning"],
        sortOrder: 15000,
        status: "snoozed",
        snoozedUntil: addDays(today, 2),
      },
    ];

    const docs = tasks.map((t) => ({
      userId,
      username: "admin",
      title: t.title,
      description: "",
      remark: "",
      dateTime: t.dateTime,
      duration: null,
      category: t.tags[0],
      tags: t.tags,
      recurring: false,
      recurringType: null,
      priority: "medium",
      subtasks: [],
      status: t.status || "pending",
      completed: t.completed || false,
      completedAt: t.completedAt || null,
      snoozedUntil: t.snoozedUntil || null,
      sortOrder: t.sortOrder,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const insertResult = await db.collection("reminders").insertMany(docs);
    console.log(`Created ${insertResult.insertedCount} test tasks`);
    console.log(
      "\nDistribution: 3 Overdue, 4 Today, 3 Tomorrow, 3 This Week, 1 Completed, 1 Snoozed",
    );
  } finally {
    await client.close();
  }
}

seed().catch(console.error);
