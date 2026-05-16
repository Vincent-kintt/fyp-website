import { apiSuccess, apiError } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { parseJsonBody } from "@/lib/api/body.js";
import { getNotesCollection, formatNote } from "@/lib/notes/db";

// POST /api/inbox/note — Get-or-create the inbox note for the current user
export const POST = withAuth(
  async ({ userId }) => {
    const notesCollection = await getNotesCollection();
    const now = new Date();

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
          deletedAt: null,
        },
        $set: { updatedAt: now },
      },
      { upsert: true, returnDocument: "after" },
    );

    return apiSuccess(formatNote(doc));
  },
  { label: "POST /api/inbox/note" },
);

// PATCH /api/inbox/note — Save inbox content
export const PATCH = withAuth(
  async ({ request, userId }) => {
    const { data: body, error } = await parseJsonBody(request);
    if (error) return error;
    const { content, extractedTasks, confirmedTasks } = body;

    if (content !== undefined && !Array.isArray(content)) {
      return apiError("content must be an array", 400);
    }

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
