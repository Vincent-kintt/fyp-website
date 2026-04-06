import { auth } from "@/auth";
import { ObjectId } from "mongodb";
import { apiSuccess, apiError } from "@/lib/reminderUtils";
import {
  getNotesCollection,
  formatNote,
} from "@/lib/notes/db";

// GET /api/notes - List all notes for logged-in user
export async function GET() {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return apiError("Unauthorized", 401);
    }

    const notesCollection = await getNotesCollection();
    const notes = await notesCollection
      .find({ userId: session.user.id, deletedAt: null, type: { $ne: "inbox" } })
      .sort({ updatedAt: -1 })
      .toArray();

    return apiSuccess(notes.map(formatNote));
  } catch (error) {
    console.error("GET /api/notes error:", error);
    return apiError("Internal server error", 500);
  }
}

// POST /api/notes - Create a new note for logged-in user
export async function POST(request) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json();
    const { title, parentId, icon } = body;

    // Validate title
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return apiError("Title is required", 400);
    }
    if (title.length > 200) {
      return apiError("Title must be 200 characters or less", 400);
    }

    const notesCollection = await getNotesCollection();

    // Resolve parentId to ObjectId or null
    let resolvedParentId = null;
    if (parentId) {
      if (!ObjectId.isValid(parentId)) {
        return apiError("Invalid parentId", 400);
      }
      resolvedParentId = new ObjectId(parentId);
    }

    if (resolvedParentId) {
      const parentExists = await notesCollection.findOne({ _id: resolvedParentId, userId: session.user.id });
      if (!parentExists) return apiError("Parent note not found", 404);
    }

    // Auto-compute sortOrder: max sibling sortOrder + 1000, or 1000 if first
    const siblingQuery = { userId: session.user.id, parentId: resolvedParentId };
    const lastSibling = await notesCollection
      .find(siblingQuery)
      .sort({ sortOrder: -1 })
      .limit(1)
      .toArray();

    const sortOrder =
      lastSibling.length > 0 ? (lastSibling[0].sortOrder || 0) + 1000 : 1000;

    const now = new Date();
    const newNote = {
      userId: session.user.id,
      title: title.trim(),
      parentId: resolvedParentId,
      content: [],
      icon: icon || null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    };

    const result = await notesCollection.insertOne(newNote);
    const insertedDoc = { ...newNote, _id: result.insertedId };

    return apiSuccess(formatNote(insertedDoc), 201);
  } catch (error) {
    console.error("POST /api/notes error:", error);
    return apiError("Internal server error", 500);
  }
}
