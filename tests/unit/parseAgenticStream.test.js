import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createAgenticStreamParser } from "@/lib/notes/parseAgenticStream.js";

const agenticFixture = readFileSync(
  new URL("../fixtures/notes-agentic-stream.txt", import.meta.url),
  "utf-8",
);
const reminderFixture = readFileSync(
  new URL("../fixtures/notes-agentic-stream-with-reminder.txt", import.meta.url),
  "utf-8",
);

function parseSSEChunks(text) {
  return text
    .split(/\n\n/)
    .map((block) => block.trim())
    .filter((block) => block.startsWith("data:"))
    .map((block) => JSON.parse(block.replace(/^data:\s*/, "")));
}

describe("createAgenticStreamParser", () => {
  it("starts with empty accumulated text and no side effects", () => {
    const parser = createAgenticStreamParser();
    expect(parser.getAccumulated()).toBe("");
    expect(parser.getSideEffects()).toEqual([]);
  });

  it("returns null for non-object chunks", () => {
    const parser = createAgenticStreamParser();
    expect(parser.feed(null)).toBeNull();
    expect(parser.feed(undefined)).toBeNull();
    expect(parser.feed("string")).toBeNull();
    expect(parser.feed(42)).toBeNull();
  });

  it("returns null for unknown / finish chunk types", () => {
    const parser = createAgenticStreamParser();
    expect(parser.feed({ type: "unknown", whatever: 1 })).toBeNull();
    expect(parser.feed({ type: "finish", finishReason: "stop" })).toBeNull();
  });

  it("emits {type: 'text', accumulated} for text-delta chunks", () => {
    const parser = createAgenticStreamParser();
    const evt = parser.feed({ type: "text-delta", id: "txt_1", delta: "hello" });
    expect(evt).toEqual({ type: "text", accumulated: "hello" });
  });

  it("accumulates consecutive text-deltas", () => {
    const parser = createAgenticStreamParser();
    parser.feed({ type: "text-delta", id: "txt_1", delta: "hello " });
    parser.feed({ type: "text-delta", id: "txt_1", delta: "world" });
    expect(parser.getAccumulated()).toBe("hello world");
  });

  it("ignores text-delta with non-string delta (defensive)", () => {
    const parser = createAgenticStreamParser();
    expect(parser.feed({ type: "text-delta", id: "txt_1" })).toBeNull();
    expect(parser.feed({ type: "text-delta", id: "txt_1", delta: 42 })).toBeNull();
    expect(parser.getAccumulated()).toBe("");
  });

  it("emits {type: 'tool-input', toolName} for tool-input-available", () => {
    const parser = createAgenticStreamParser();
    const evt = parser.feed({
      type: "tool-input-available",
      toolName: "createReminder",
      toolCallId: "call_1",
      input: { title: "T", dateTime: "2024-01-01" },
    });
    expect(evt).toEqual({ type: "tool-input", toolName: "createReminder" });
    expect(parser.getSideEffects()).toEqual([]);
  });

  it("collects createReminder side effect (string-form output) when toolCallId matches prior tool-input", () => {
    const parser = createAgenticStreamParser();
    parser.feed({
      type: "tool-input-available",
      toolName: "createReminder",
      toolCallId: "call_1",
      input: {},
    });
    parser.feed({
      type: "tool-output-available",
      toolCallId: "call_1",
      output: JSON.stringify({
        success: true,
        reminder: {
          id: "R1",
          title: "Test reminder",
          dateTime: "2024-01-01T09:00:00Z",
        },
      }),
    });
    expect(parser.getSideEffects()).toEqual([
      {
        tool: "createReminder",
        title: "Test reminder",
        dateTime: "2024-01-01T09:00:00Z",
      },
    ]);
  });

  it("collects createReminder side effect (object-form output) when toolCallId matches", () => {
    const parser = createAgenticStreamParser();
    parser.feed({
      type: "tool-input-available",
      toolName: "createReminder",
      toolCallId: "call_2",
    });
    parser.feed({
      type: "tool-output-available",
      toolCallId: "call_2",
      output: { success: true, reminder: { title: "X", dateTime: "Y" } },
    });
    expect(parser.getSideEffects()).toEqual([
      { tool: "createReminder", title: "X", dateTime: "Y" },
    ]);
  });

  it("does not collect side effect when tool-output has no matching prior tool-input (orphan toolCallId)", () => {
    const parser = createAgenticStreamParser();
    parser.feed({
      type: "tool-output-available",
      toolCallId: "call_orphan",
      output: { success: true, reminder: { title: "X", dateTime: "Y" } },
    });
    expect(parser.getSideEffects()).toEqual([]);
  });

  it("does not collect side effect when tool is not createReminder even with reminder-shaped output", () => {
    const parser = createAgenticStreamParser();
    parser.feed({
      type: "tool-input-available",
      toolName: "fetchRSSFeeds",
      toolCallId: "call_rss",
    });
    parser.feed({
      type: "tool-output-available",
      toolCallId: "call_rss",
      output: { success: true, reminder: { title: "fake" } },
    });
    expect(parser.getSideEffects()).toEqual([]);
  });

  it("does not collect side effect when createReminder output lacks reminder field", () => {
    const parser = createAgenticStreamParser();
    parser.feed({
      type: "tool-input-available",
      toolName: "createReminder",
      toolCallId: "call_3",
    });
    parser.feed({
      type: "tool-output-available",
      toolCallId: "call_3",
      output: JSON.stringify({ success: true, feeds: [{ title: "RSS" }] }),
    });
    expect(parser.getSideEffects()).toEqual([]);
  });

  it("does not throw and collects nothing when createReminder output is non-JSON string", () => {
    const parser = createAgenticStreamParser();
    parser.feed({
      type: "tool-input-available",
      toolName: "createReminder",
      toolCallId: "call_4",
    });
    parser.feed({
      type: "tool-output-available",
      toolCallId: "call_4",
      output: "not valid json {{",
    });
    expect(parser.getSideEffects()).toEqual([]);
  });

  it("replays text-only fixture and accumulates full text", () => {
    const parser = createAgenticStreamParser();
    const chunks = parseSSEChunks(agenticFixture);
    chunks.forEach((c) => parser.feed(c));
    expect(parser.getAccumulated()).toBe(
      "Hello from the agent. Here is a brief response.\n\n- Point one\n- Point two\n",
    );
    expect(parser.getSideEffects()).toEqual([]);
  });

  it("replays with-reminder fixture: text + reminder side effect (tool-input precedes tool-output)", () => {
    const parser = createAgenticStreamParser();
    const chunks = parseSSEChunks(reminderFixture);
    chunks.forEach((c) => parser.feed(c));
    expect(parser.getAccumulated()).toBe(
      "Creating reminder... Reminder set for tomorrow at 9am.\n\nAnything else?",
    );
    expect(parser.getSideEffects()).toEqual([
      {
        tool: "createReminder",
        title: "Test reminder",
        dateTime: "2024-01-01T09:00:00Z",
      },
    ]);
  });

  it("getSideEffects returns a defensive copy: array push does not leak", () => {
    const parser = createAgenticStreamParser();
    parser.feed({
      type: "tool-input-available",
      toolName: "createReminder",
      toolCallId: "call_5",
    });
    parser.feed({
      type: "tool-output-available",
      toolCallId: "call_5",
      output: { success: true, reminder: { title: "X", dateTime: "Y" } },
    });
    const copy = parser.getSideEffects();
    copy.push({ tool: "injected" });
    expect(parser.getSideEffects()).toHaveLength(1);
  });

  it("getSideEffects returns a defensive copy: effect-object mutation does not leak", () => {
    const parser = createAgenticStreamParser();
    parser.feed({
      type: "tool-input-available",
      toolName: "createReminder",
      toolCallId: "call_6",
    });
    parser.feed({
      type: "tool-output-available",
      toolCallId: "call_6",
      output: { success: true, reminder: { title: "X", dateTime: "Y" } },
    });
    const copy = parser.getSideEffects();
    copy[0].title = "MUTATED";
    copy[0].extra = "added";
    expect(parser.getSideEffects()[0]).toEqual({
      tool: "createReminder",
      title: "X",
      dateTime: "Y",
    });
  });
});
