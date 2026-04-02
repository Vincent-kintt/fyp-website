// tests/unit/notes-commands.test.js
import { describe, it, expect } from "vitest";
import { parseCommand } from "@/lib/notes/commands.js";

describe("parseCommand", () => {
  it("parses /ask command with input", () => {
    const result = parseCommand("/ask What is RAG?");
    expect(result).toEqual({ type: "ask", input: "What is RAG?" });
  });

  it("parses /summarize with URL", () => {
    const result = parseCommand("/summarize https://example.com");
    expect(result).toEqual({ type: "summarize", input: "https://example.com" });
  });

  it("parses /summarize without input", () => {
    const result = parseCommand("/summarize");
    expect(result).toEqual({ type: "summarize", input: "" });
  });

  it("parses /digest (no input expected)", () => {
    const result = parseCommand("/digest");
    expect(result).toEqual({ type: "digest", input: "" });
  });

  it("returns null for unknown commands", () => {
    expect(parseCommand("/unknown foo")).toBeNull();
  });

  it("returns null for non-command text", () => {
    expect(parseCommand("just regular text")).toBeNull();
  });

  it("trims whitespace from input", () => {
    const result = parseCommand("/ask   What is AI?  ");
    expect(result).toEqual({ type: "ask", input: "What is AI?" });
  });
});
