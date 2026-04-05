import { auth } from "@/auth";
import { apiSuccess, apiError } from "@/lib/reminderUtils";
import { getNotesCollection, formatNote } from "@/lib/notes/db";

// GET /api/inbox/capture — returns the user's capture document (creates if not exists)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const collection = await getNotesCollection();

    let doc = await collection.findOne({
      userId: session.user.id,
      type: "inbox-capture",
    });

    if (!doc) {
      const now = new Date();
      const newDoc = {
        userId: session.user.id,
        title: "Inbox",
        type: "inbox-capture",
        content: [],
        parentId: null,
        icon: null,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      const result = await collection.insertOne(newDoc);
      doc = { ...newDoc, _id: result.insertedId };
    }

    return apiSuccess(formatNote(doc));
  } catch (error) {
    // Handle duplicate key from race condition — retry find
    if (error.code === 11000) {
      try {
        const collection = await getNotesCollection();
        const session = await auth();
        const doc = await collection.findOne({
          userId: session.user.id,
          type: "inbox-capture",
        });
        if (doc) return apiSuccess(formatNote(doc));
      } catch {
        // fall through
      }
    }
    console.error("GET /api/inbox/capture error:", error);
    return apiError("Internal server error", 500);
  }
}

// PATCH /api/inbox/capture — update capture document content
export async function PATCH(request) {
  try {
    const session = await auth();
    if (!session?.user) return apiError("Unauthorized", 401);

    const body = await request.json();
    const { content } = body;

    if (content !== undefined && !Array.isArray(content)) {
      return apiError("content must be an array", 400);
    }

    const collection = await getNotesCollection();

    const updateData = { updatedAt: new Date() };
    if (content !== undefined) updateData.content = content;

    const updated = await collection.findOneAndUpdate(
      { userId: session.user.id, type: "inbox-capture" },
      { $set: updateData },
      { returnDocument: "after" },
    );

    if (!updated) {
      return apiError("Capture document not found", 404);
    }

    return apiSuccess(formatNote(updated));
  } catch (error) {
    console.error("PATCH /api/inbox/capture error:", error);
    return apiError("Internal server error", 500);
  }
}
