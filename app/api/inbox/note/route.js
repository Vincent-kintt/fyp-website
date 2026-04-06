import { auth } from "@/auth";
import { apiSuccess, apiError } from "@/lib/reminderUtils";
import { getNotesCollection, formatNote } from "@/lib/notes/db";

// POST /api/inbox/note — Get-or-create the inbox note for the current user
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return apiError("Unauthorized", 401);
    }

    const notesCollection = await getNotesCollection();
    const now = new Date();

    const doc = await notesCollection.findOneAndUpdate(
      { userId: session.user.id, type: "inbox" },
      {
        $setOnInsert: {
          title: "Inbox",
          content: [],
          parentId: null,
          icon: null,
          sortOrder: 0,
          createdAt: now,
          deletedAt: null,
        },
        $set: { updatedAt: now },
      },
      { upsert: true, returnDocument: "after" },
    );

    return apiSuccess(formatNote(doc));
  } catch (error) {
    console.error("POST /api/inbox/note error:", error);
    return apiError("Internal server error", 500);
  }
}

// PATCH /api/inbox/note — Save inbox content
export async function PATCH(request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json();
    const { content } = body;

    if (content !== undefined && !Array.isArray(content)) {
      return apiError("content must be an array", 400);
    }

    const notesCollection = await getNotesCollection();

    const updated = await notesCollection.findOneAndUpdate(
      { userId: session.user.id, type: "inbox" },
      { $set: { content, updatedAt: new Date() } },
      { returnDocument: "after" },
    );

    if (!updated) {
      return apiError("Inbox note not found", 404);
    }

    return apiSuccess(formatNote(updated));
  } catch (error) {
    console.error("PATCH /api/inbox/note error:", error);
    return apiError("Internal server error", 500);
  }
}
