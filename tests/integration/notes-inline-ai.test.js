// tests/integration/notes-inline-ai.test.js
import { describe, it, expect, beforeEach } from "vitest";
import { parseCommand } from "@/lib/notes/commands.js";

describe("Inline AI command detection", () => {
  describe("parseCommand integration", () => {
    it("detects /ask with prompt", () => {
      const result = parseCommand("/ask what are the action items?");
      expect(result).toEqual({ type: "ask", input: "what are the action items?" });
    });

    it("detects /ask with empty prompt", () => {
      const result = parseCommand("/ask");
      expect(result).toEqual({ type: "ask", input: "" });
    });

    it("detects /ask with only spaces after", () => {
      const result = parseCommand("/ask   ");
      expect(result).toEqual({ type: "ask", input: "" });
    });

    it("detects /summarize without input", () => {
      const result = parseCommand("/summarize");
      expect(result).toEqual({ type: "summarize", input: "" });
    });

    it("detects /summarize with input", () => {
      const result = parseCommand("/summarize the first section");
      expect(result).toEqual({ type: "summarize", input: "the first section" });
    });

    it("detects /digest without input", () => {
      const result = parseCommand("/digest");
      expect(result).toEqual({ type: "digest", input: "" });
    });

    it("detects /agent with prompt", () => {
      const result = parseCommand("/agent search for Next.js middleware docs");
      expect(result).toEqual({ type: "agent", input: "search for Next.js middleware docs" });
    });

    it("detects /agent with empty prompt", () => {
      const result = parseCommand("/agent");
      expect(result).toEqual({ type: "agent", input: "" });
    });

    it("detects /agent with only spaces after", () => {
      const result = parseCommand("/agent   ");
      expect(result).toEqual({ type: "agent", input: "" });
    });

    it("ignores text that starts with / but is not a command", () => {
      expect(parseCommand("/unknown hello")).toBeNull();
      expect(parseCommand("/rewrite this")).toBeNull();
      expect(parseCommand("/translate to english")).toBeNull();
    });

    it("ignores regular text", () => {
      expect(parseCommand("hello world")).toBeNull();
      expect(parseCommand("this is /ask embedded")).toBeNull();
      expect(parseCommand("")).toBeNull();
    });

    it("handles leading/trailing whitespace", () => {
      const result = parseCommand("  /ask  hello  ");
      expect(result).toEqual({ type: "ask", input: "hello" });
    });
  });

  describe("consumed tracking Map logic", () => {
    let executedCommands;

    beforeEach(() => {
      executedCommands = new Map();
    });

    it("allows first execution of a command", () => {
      const blockId = "block-1";
      const blockText = "/ask what is this?";
      const prevText = executedCommands.get(blockId);

      expect(prevText).toBeUndefined();
      executedCommands.set(blockId, blockText);
      expect(executedCommands.get(blockId)).toBe(blockText);
    });

    it("blocks re-execution with same text", () => {
      const blockId = "block-1";
      const blockText = "/ask what is this?";
      executedCommands.set(blockId, blockText);

      const prevText = executedCommands.get(blockId);
      const shouldSkip = prevText !== undefined && prevText === blockText;
      expect(shouldSkip).toBe(true);
    });

    it("allows re-execution when prompt is edited", () => {
      const blockId = "block-1";
      executedCommands.set(blockId, "/ask what is this?");

      const newText = "/ask what are the key points?";
      const prevText = executedCommands.get(blockId);
      const shouldSkip = prevText !== undefined && prevText === newText;
      expect(shouldSkip).toBe(false);
    });

    it("tracks multiple blocks independently", () => {
      executedCommands.set("block-1", "/ask hello");
      executedCommands.set("block-2", "/summarize");

      expect(executedCommands.get("block-1")).toBe("/ask hello");
      expect(executedCommands.get("block-2")).toBe("/summarize");
      expect(executedCommands.has("block-3")).toBe(false);
    });
  });
});
