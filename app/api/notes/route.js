import { ObjectId } from "mongodb";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { parseJsonBodyWithSchema } from "@/lib/api/body.js";
import { getNotesCollection, formatNote } from "@/lib/notes/db";
import { generateKeyAfter } from "@/lib/notes/sortOrder.js";

const createNoteSchema = z.object({
  title: z
    .string({ error: "Title is required" })
    .trim()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less"),
  parentId: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
});

// GET /api/notes - List all notes for logged-in user
export const GET = withAuth(
  async ({ userId }) => {
    const notesCollection = await getNotesCollection();
    const notes = await notesCollection
      .find({ userId, deletedAt: null, type: { $ne: "inbox" } })
      .sort({ updatedAt: -1 })
      .toArray();

    return apiSuccess(notes.map(formatNote));
  },
  { label: "GET /api/notes" },
);

// POST /api/notes - Create a new note for logged-in user
export const POST = withAuth(
  async ({ request, userId }) => {
    const { data: body, error } = await parseJsonBodyWithSchema(
      request,
      createNoteSchema,
    );
    if (error) return error;
    const { title, parentId, icon } = body;

    const notesCollection = await getNotesCollection();

    let resolvedParentId = null;
    if (parentId) {
      if (!ObjectId.isValid(parentId)) {
        return apiError("Invalid parentId", 400);
      }
      resolvedParentId = new ObjectId(parentId);
    }

    if (resolvedParentId) {
      const parentExists = await notesCollection.findOne({
        _id: resolvedParentId,
        userId,
      });
      if (!parentExists) return apiError("Parent note not found", 404);
    }

    // Find the current last sibling's fractional key. Two concurrent POSTs
    // may both read the same lastSibling and both compute the same key;
    // the (sortOrder, _id) compound sort breaks the tie at read time, so we
    // don't need a unique index or random jitter here.
    const siblingQuery = { userId, parentId: resolvedParentId };
    const lastSibling = await notesCollection
      .find(siblingQuery)
      .sort({ sortOrder: -1, _id: -1 })
      .limit(1)
      .toArray();

    const lastKey =
      typeof lastSibling[0]?.sortOrder === "string"
        ? lastSibling[0].sortOrder
        : null;
    const sortOrder = generateKeyAfter(lastKey);

    const now = new Date();
    const newNote = {
      userId,
      title,
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
  },
  { label: "POST /api/notes" },
);
