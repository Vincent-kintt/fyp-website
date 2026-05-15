import { describe, it, expect, vi } from "vitest";

// Mock NoteLinkInlineContent to avoid transitively loading next-intl/navigation
// (which the React inline-content render closure pulls in via useRouter).
// The schema only needs a noteLinkSpec shape, not a working render function.
vi.mock("@/components/notes/NoteLinkInlineContent", () => ({
  noteLinkSpec: {
    type: "noteLink",
    propSchema: { noteId: { default: "" } },
    content: "none",
    render: () => null,
  },
}));

import { noteEditorSchema } from "@/components/notes/editor/schema";

describe("noteEditorSchema", () => {
  it("exports a defined object", () => {
    expect(noteEditorSchema).toBeDefined();
    expect(typeof noteEditorSchema).toBe("object");
  });

  it("registers the noteLink inline content (under whichever key BlockNote exposes it)", () => {
    // Different BlockNote versions expose inline-content specs under different
    // property names (inlineContentSchema vs inlineContentSpecs). Just verify
    // the noteLink key exists under one of them.
    const candidates = [
      noteEditorSchema.inlineContentSchema,
      noteEditorSchema.inlineContentSpecs,
    ];
    const hasNoteLink = candidates.some(
      (obj) => obj && typeof obj === "object" && "noteLink" in obj,
    );
    expect(hasNoteLink).toBe(true);
  });
});
