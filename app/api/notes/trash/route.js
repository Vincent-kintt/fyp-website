import { auth } from "@/auth";
import { apiSuccess, apiError } from "@/lib/reminderUtils";
import { getNotesCollection, formatNote } from "@/lib/notes/db";

export async function GET() {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return apiError("Unauthorized", 401);
    }

    const notesCollection = await getNotesCollection();
    const notes = await notesCollection
      .find({
        userId: session.user.id,
        deletedAt: { $ne: null },
        type: { $ne: "inbox-capture" },
      })
      .sort({ deletedAt: -1 })
      .toArray();

    return apiSuccess(notes.map(formatNote));
  } catch (error) {
    console.error("GET /api/notes/trash error:", error);
    return apiError("Internal server error", 500);
  }
}
