import { describe, it, expect } from "vitest";
import { extractPreview } from "@/lib/notes/preview";

describe("extractPreview", () => {
  it("returns empty string for empty content", () => {
    expect(extractPreview([])).toBe("");
    expect(extractPreview(null)).toBe("");
    expect(extractPreview(undefined)).toBe("");
  });

  it("extracts text from paragraph blocks", () => {
    const content = [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Hello world" }],
      },
    ];
    expect(extractPreview(content)).toBe("Hello world");
  });

  it("joins multiple blocks with space", () => {
    const content = [
      { type: "paragraph", content: [{ type: "text", text: "First line" }] },
      { type: "paragraph", content: [{ type: "text", text: "Second line" }] },
    ];
    expect(extractPreview(content)).toBe("First line Second line");
  });

  it("truncates to maxLength", () => {
    const content = [
      { type: "paragraph", content: [{ type: "text", text: "A".repeat(200) }] },
    ];
    const result = extractPreview(content, 80);
    expect(result.length).toBeLessThanOrEqual(83);
    expect(result.endsWith("...")).toBe(true);
  });

  it("handles nested inline content", () => {
    const content = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hello " },
          { type: "text", text: "world", styles: { bold: true } },
        ],
      },
    ];
    expect(extractPreview(content)).toBe("Hello world");
  });

  it("handles heading blocks", () => {
    const content = [
      { type: "heading", content: [{ type: "text", text: "Title" }] },
    ];
    expect(extractPreview(content)).toBe("Title");
  });

  it("handles blocks with no content array", () => {
    const content = [
      { type: "image", props: { url: "test.png" } },
      { type: "paragraph", content: [{ type: "text", text: "After image" }] },
    ];
    expect(extractPreview(content)).toBe("After image");
  });
});
