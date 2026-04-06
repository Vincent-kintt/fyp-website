import { tool } from "ai";
import { z } from "zod";
import { getCollection } from "@/lib/db.js";
import { ObjectId } from "mongodb";
import { blocksToText } from "@/lib/notes/blocksToText.js";

export function createNoteTools(userId) {
  return {
    searchNotes: tool({
      description:
        "Search the user's notes by title. Returns a list of matching notes with title and a short snippet. Use readNote to get the full content of a specific note.",
      inputSchema: z.object({
        query: z.string().describe("Search query to match against note titles"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe("Maximum number of results (default 5)"),
      }),
      execute: async ({ query, limit = 5 }) => {
        // Escape regex metacharacters to prevent injection
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const notes = await getCollection("notes");
        const results = await notes
          .find({
            userId,
            deletedAt: null,
            title: { $regex: escaped, $options: "i" },
          })
          .sort({ updatedAt: -1 })
          .limit(limit)
          .toArray();

        return {
          success: true,
          notes: results.map((n) => {
            const plaintext = blocksToText(n.content);
            return {
              noteId: n._id.toString(),
              title: n.title || "Untitled",
              snippet: plaintext.slice(0, 200),
              updatedAt: n.updatedAt,
            };
          }),
        };
      },
      toModelOutput: ({ output }) => {
        if (!output.success) return JSON.stringify(output);
        return JSON.stringify({
          success: true,
          notes: output.notes.map(({ noteId, title, snippet, updatedAt }) => ({
            noteId,
            title,
            snippet,
            updatedAt,
          })),
        });
      },
    }),

    readNote: tool({
      description:
        "Read the full content of a specific note by its ID. Returns the note title and full plaintext content.",
      inputSchema: z.object({
        noteId: z.string().describe("The note ID to read"),
      }),
      execute: async ({ noteId }) => {
        let oid;
        try {
          oid = new ObjectId(noteId);
        } catch {
          return { success: false, error: "Invalid note ID" };
        }

        const notes = await getCollection("notes");
        const note = await notes.findOne({
          _id: oid,
          userId,
          deletedAt: null,
        });

        if (!note) {
          return { success: false, error: "Note not found" };
        }

        const content = blocksToText(note.content);
        return {
          success: true,
          noteId: note._id.toString(),
          title: note.title || "Untitled",
          content,
          updatedAt: note.updatedAt,
        };
      },
    }),
  };
}
