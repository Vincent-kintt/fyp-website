import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { parseJsonBodyWithSchema } from "@/lib/api/body.js";
import { getNotesCollection, formatNote } from "@/lib/notes/db";

const inboxNotePatchSchema = z.object({
  content: z
    .array(z.unknown(), { error: "content must be an array" })
    .optional(),
  extractedTasks: z.array(z.unknown()).optional(),
  confirmedTasks: z.array(z.unknown()).optional(),
});

// GET /api/inbox/note — Read the current user's inbox note (404 if missing).
export const GET = withAuth(
  async ({ userId }) => {
    const notesCollection = await getNotesCollection();
    const doc = await notesCollection.findOne({ userId, type: "inbox" });
    if (!doc) return apiError("Inbox note not found", 404);
    return apiSuccess(formatNote(doc));
  },
  { label: "GET /api/inbox/note" },
);

// POST /api/inbox/note — Ensure (create-if-missing) the inbox note for the current user.
// Idempotent under the partial unique index { userId, type } where type === "inbox"
// (see scripts/create-inbox-note-index.js) — safe against concurrent first-visit races.
//
// The atomic findOneAndUpdate+upsert almost always swallows the race itself,
// but under heavy write-conflict load MongoDB can still surface E11000 to the
// caller. Catch it, re-read the winning doc, and return 200 — the race is the
// success path, not a 500.
export const POST = withAuth(
  async ({ userId }) => {
    const notesCollection = await getNotesCollection();
    const now = new Date();

    try {
      const doc = await notesCollection.findOneAndUpdate(
        { userId, type: "inbox" },
        {
          $setOnInsert: {
            title: "Inbox",
            content: [],
            parentId: null,
            icon: null,
            sortOrder: 0,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          },
        },
        { upsert: true, returnDocument: "after" },
      );

      return apiSuccess(formatNote(doc));
    } catch (err) {
      if (err?.code === 11000) {
        const existing = await notesCollection.findOne({
          userId,
          type: "inbox",
        });
        if (existing) return apiSuccess(formatNote(existing));
      }
      throw err;
    }
  },
  { label: "POST /api/inbox/note" },
);

// PATCH /api/inbox/note — Save inbox content
export const PATCH = withAuth(
  async ({ request, userId }) => {
    const { data: body, error } = await parseJsonBodyWithSchema(
      request,
      inboxNotePatchSchema,
    );
    if (error) return error;
    const { content, extractedTasks, confirmedTasks } = body;

    const updateFields = { updatedAt: new Date() };
    if (content !== undefined) updateFields.content = content;
    if (extractedTasks !== undefined)
      updateFields.extractedTasks = extractedTasks;
    if (confirmedTasks !== undefined)
      updateFields.confirmedTasks = confirmedTasks;

    const notesCollection = await getNotesCollection();

    const updated = await notesCollection.findOneAndUpdate(
      { userId, type: "inbox" },
      { $set: updateFields },
      { returnDocument: "after" },
    );

    if (!updated) {
      return apiError("Inbox note not found", 404);
    }

    return apiSuccess(formatNote(updated));
  },
  { label: "PATCH /api/inbox/note" },
);
