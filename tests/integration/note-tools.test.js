import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db.js", () => ({
  getCollection: vi.fn(),
}));

vi.mock("@/lib/notes/blocksToText.js", () => ({
  blocksToText: vi.fn((blocks) => {
    if (!blocks || !Array.isArray(blocks)) return "";
    return blocks
      .map((b) => b.content?.map((c) => c.text || "").join("") || "")
      .join("\n");
  }),
}));

import { getCollection } from "@/lib/db.js";
import { createNoteTools } from "@/lib/ai/noteTools.js";

describe("createNoteTools", () => {
  const userId = "user-123";
  let tools;
  let mockNotesCollection;

  beforeEach(() => {
    mockNotesCollection = {
      find: vi.fn().mockReturnThis(),
      findOne: vi.fn(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      project: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
    };
    getCollection.mockResolvedValue(mockNotesCollection);
    tools = createNoteTools(userId);
  });

  describe("searchNotes", () => {
    it("returns matching notes with snippets", async () => {
      const mockNotes = [
        {
          _id: { toString: () => "note-1" },
          userId: "user-123",
          title: "Meeting Notes",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Discussion about project timeline" },
              ],
            },
          ],
          updatedAt: new Date("2026-04-01"),
        },
      ];
      mockNotesCollection.toArray.mockResolvedValue(mockNotes);

      const result = await tools.searchNotes.execute({ query: "meeting" });

      expect(result.success).toBe(true);
      expect(result.notes).toHaveLength(1);
      expect(result.notes[0].noteId).toBe("note-1");
      expect(result.notes[0].title).toBe("Meeting Notes");
      expect(result.notes[0].snippet).toBeDefined();
      expect(result.notes[0].snippet.length).toBeLessThanOrEqual(200);
    });

    it("scopes search to the authenticated user", async () => {
      mockNotesCollection.toArray.mockResolvedValue([]);
      await tools.searchNotes.execute({ query: "test" });
      const findCall = mockNotesCollection.find.mock.calls[0][0];
      expect(findCall.userId).toBe("user-123");
    });

    it("respects limit parameter", async () => {
      mockNotesCollection.toArray.mockResolvedValue([]);
      await tools.searchNotes.execute({ query: "test", limit: 3 });
      expect(mockNotesCollection.limit).toHaveBeenCalledWith(3);
    });

    it("defaults limit to 5", async () => {
      mockNotesCollection.toArray.mockResolvedValue([]);
      await tools.searchNotes.execute({ query: "test" });
      expect(mockNotesCollection.limit).toHaveBeenCalledWith(5);
    });

    it("excludes deleted notes", async () => {
      mockNotesCollection.toArray.mockResolvedValue([]);
      await tools.searchNotes.execute({ query: "test" });
      const findCall = mockNotesCollection.find.mock.calls[0][0];
      expect(findCall.deletedAt).toEqual(null);
    });
  });

  describe("readNote", () => {
    const validNoteId = "aaaaaaaaaaaaaaaaaaaaaaaa";

    it("returns note content as plaintext", async () => {
      mockNotesCollection.findOne.mockResolvedValue({
        _id: { toString: () => validNoteId },
        userId: "user-123",
        title: "My Note",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello world" }],
          },
        ],
        updatedAt: new Date("2026-04-01"),
      });
      const result = await tools.readNote.execute({ noteId: validNoteId });
      expect(result.success).toBe(true);
      expect(result.noteId).toBe(validNoteId);
      expect(result.title).toBe("My Note");
      expect(result.content).toContain("Hello world");
    });

    it("returns error for invalid ObjectId", async () => {
      const result = await tools.readNote.execute({ noteId: "nonexistent" });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("returns error for non-existent note", async () => {
      mockNotesCollection.findOne.mockResolvedValue(null);
      const result = await tools.readNote.execute({ noteId: validNoteId });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("scopes read to the authenticated user", async () => {
      mockNotesCollection.findOne.mockResolvedValue(null);
      await tools.readNote.execute({ noteId: validNoteId });
      const findCall = mockNotesCollection.findOne.mock.calls[0][0];
      expect(findCall.userId).toBe("user-123");
    });
  });
});
