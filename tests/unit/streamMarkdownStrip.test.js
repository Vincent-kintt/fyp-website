import { describe, it, expect } from "vitest";
import { stripStreamingMarkdown } from "@/lib/notes/streamMarkdownStrip.js";

describe("stripStreamingMarkdown", () => {
  it("returns empty string for empty input", () => {
    expect(stripStreamingMarkdown("")).toBe("");
  });

  it("returns plain text unchanged when no markdown patterns present", () => {
    expect(stripStreamingMarkdown("hello world")).toBe("hello world");
  });

  it("strips a single # heading marker", () => {
    expect(stripStreamingMarkdown("# heading")).toBe("heading");
  });

  it("strips ## through ###### heading markers", () => {
    expect(
      stripStreamingMarkdown("## h2\n### h3\n#### h4\n##### h5\n###### h6"),
    ).toBe("h2\nh3\nh4\nh5\nh6");
  });

  it("leaves '####### h7' unchanged (regex needs 1-6 # followed by whitespace; 7th # is not whitespace)", () => {
    expect(stripStreamingMarkdown("####### h7")).toBe("####### h7");
  });

  it("requires whitespace after #; '#heading' is unchanged", () => {
    expect(stripStreamingMarkdown("#heading")).toBe("#heading");
  });

  it("strips **bold** wrappers", () => {
    expect(stripStreamingMarkdown("this is **bold** text")).toBe(
      "this is bold text",
    );
  });

  it("strips *italic* wrappers", () => {
    expect(stripStreamingMarkdown("this is *italic* text")).toBe(
      "this is italic text",
    );
  });

  it("converts '- item' to '— item'", () => {
    expect(stripStreamingMarkdown("- item")).toBe("— item");
  });

  it("converts '* item' and '+ item' to '— item'", () => {
    expect(stripStreamingMarkdown("* item\n+ other")).toBe("— item\n— other");
  });

  it("strips mixed markdown: heading + bold + list", () => {
    const input =
      "# title\n\nThis is **bold** and here is a list:\n- first\n- second";
    const expected =
      "title\n\nThis is bold and here is a list:\n— first\n— second";
    expect(stripStreamingMarkdown(input)).toBe(expected);
  });

  it("returns empty string for non-string input (defensive)", () => {
    expect(stripStreamingMarkdown(null)).toBe("");
    expect(stripStreamingMarkdown(undefined)).toBe("");
    expect(stripStreamingMarkdown(42)).toBe("");
  });
});
