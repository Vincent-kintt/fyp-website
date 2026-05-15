import { apiSuccess } from "@/lib/api/response.js";
import { withAuth } from "@/lib/api/auth.js";
import { getNotesCollection, formatNote } from "@/lib/notes/db";

export const GET = withAuth(
  async ({ userId }) => {
    const notesCollection = await getNotesCollection();
    const notes = await notesCollection
      .find({
        userId,
        deletedAt: { $ne: null },
        type: { $ne: "inbox" },
      })
      .sort({ deletedAt: -1 })
      .toArray();

    return apiSuccess(notes.map(formatNote));
  },
  { label: "GET /api/notes/trash" },
);
