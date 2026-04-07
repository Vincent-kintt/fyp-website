import { describe, it, expect } from "vitest";
import { blocksToText } from "@/lib/notes/blocksToText.js";
import { extractPreview } from "@/lib/notes/preview.js";

describe("blocksToText with noteLink", () => {
  it("converts noteLink inline content to [Note: id]", () => {
    const blocks = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "See " },
          { type: "noteLink", props: { noteId: "abc123" } },
          { type: "text", text: " for details" },
        ],
      },
    ];
    expect(blocksToText(blocks)).toBe("See [Note: abc123] for details");
  });

  it("handles noteLink without noteId prop", () => {
    const blocks = [
      {
        type: "paragraph",
        content: [{ type: "noteLink", props: {} }],
      },
    ];
    expect(blocksToText(blocks)).toBe("[Note: unknown]");
  });
});

describe("extractPreview with noteLink", () => {
  it("includes [note] placeholder for noteLink content", () => {
    const blocks = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Check " },
          { type: "noteLink", props: { noteId: "abc" } },
        ],
      },
    ];
    expect(extractPreview(blocks)).toBe("Check [note]");
  });
});
