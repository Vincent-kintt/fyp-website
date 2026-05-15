import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { executeAgentCommand } from "@/components/notes/editor/commands/useAgentCommand.js";

const AGENTIC_FIXTURE = readFileSync(
  new URL("../fixtures/notes-agentic-stream.txt", import.meta.url),
  "utf-8",
);
const REMINDER_FIXTURE = readFileSync(
  new URL("../fixtures/notes-agentic-stream-with-reminder.txt", import.meta.url),
  "utf-8",
);

function makeStreamResponse(sseText, { ok = true, status = 200, jsonBody } = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sseText));
      controller.close();
    },
  });
  return {
    ok,
    status,
    body: stream,
    json: async () => {
      if (jsonBody === "__throw__") throw new Error("not json");
      return jsonBody ?? { error: "" };
    },
  };
}

function sseFromChunks(chunks) {
  return chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("");
}

function makeBlock(overrides = {}) {
  return {
    id: "blk1",
    type: "paragraph",
    content: [{ text: "/agent help me" }],
    ...overrides,
  };
}

function makeEditor({
  block = makeBlock(),
  cursorBlock = block,
  parsedBlocks = [{ type: "paragraph", content: "agent reply" }],
  blockExists = true,
  doc = [],
} = {}) {
  let insertCounter = 0;
  const existing = new Map();
  if (blockExists && block) existing.set(block.id, block);

  return {
    document: doc,
    getBlock: vi.fn((id) => existing.get(id) ?? null),
    getTextCursorPosition: vi.fn(() => ({ block: cursorBlock })),
    insertBlocks: vi.fn((blocks) =>
      blocks.map((b) => {
        const newId = `inserted-${++insertCounter}`;
        const nb = { ...b, id: newId };
        existing.set(newId, nb);
        return nb;
      }),
    ),
    removeBlocks: vi.fn((blocks) => {
      blocks.forEach((b) => existing.delete(b.id));
    }),
    updateBlock: vi.fn(),
    tryParseMarkdownToBlocks: vi.fn(() => parsedBlocks),
  };
}

const DEFAULT_LABELS = {
  searchNotes: "agentSearchingNotes",
  createReminder: "agentCreatingReminder",
};

function makeCtx({
  titleRefValue = "My Note",
  localeRefValue = "en-US",
  tFn = (k) => `T(${k})`,
  executed = new Map(),
  toolProgressLabels = DEFAULT_LABELS,
} = {}) {
  return {
    titleRef: { current: titleRefValue },
    localeRef: { current: localeRefValue },
    t: tFn,
    executedCommandsRef: { current: executed },
    toolProgressLabels,
  };
}

let consoleErrorSpy;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  consoleErrorSpy.mockRestore();
});

describe("executeAgentCommand — block resolution", () => {
  it("returns early when commandBlockId is null and no cursor block", async () => {
    const editor = makeEditor({ blockExists: false });
    editor.getTextCursorPosition.mockReturnValue({ block: null });
    vi.stubGlobal("fetch", vi.fn());

    await executeAgentCommand(editor, makeCtx(), "input", null);

    expect(editor.insertBlocks).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("uses editor.getBlock(commandBlockId) when id is provided", async () => {
    const editor = makeEditor();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(makeStreamResponse(""))));

    await executeAgentCommand(editor, makeCtx(), "input", "blk1");

    expect(editor.getBlock).toHaveBeenCalledWith("blk1");
    expect(editor.getTextCursorPosition).not.toHaveBeenCalled();
  });

  it("falls back to editor.getTextCursorPosition().block when no commandBlockId", async () => {
    const editor = makeEditor();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(makeStreamResponse(""))));

    await executeAgentCommand(editor, makeCtx(), "input", null);

    expect(editor.getTextCursorPosition).toHaveBeenCalled();
  });

  it("aborts when commandBlockId is provided but getBlock returns null, even if cursor block exists", async () => {
    const cursorBlock = makeBlock({ id: "cursor", text: "/agent" });
    const editor = makeEditor({ blockExists: false, cursorBlock });
    vi.stubGlobal("fetch", vi.fn());

    await executeAgentCommand(editor, makeCtx(), "input", "stale-id");

    expect(editor.getBlock).toHaveBeenCalledWith("stale-id");
    expect(editor.getTextCursorPosition).not.toHaveBeenCalled();
    expect(editor.insertBlocks).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("executeAgentCommand — consumed tracking and loading block", () => {
  it("marks the command block as consumed before fetching", async () => {
    const editor = makeEditor({
      block: makeBlock({ content: [{ text: "/agent do thing" }] }),
    });
    const ctx = makeCtx();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(makeStreamResponse(""))));

    await executeAgentCommand(editor, ctx, "do thing", "blk1");

    expect(ctx.executedCommandsRef.current.get("blk1")).toBe("/agent do thing");
  });

  it("inserts a loading block with t('aiGenerating') content", async () => {
    const editor = makeEditor();
    const t = vi.fn((k) => `LABEL_${k}`);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(makeStreamResponse(""))));

    await executeAgentCommand(editor, makeCtx({ tFn: t }), "input", "blk1");

    expect(editor.insertBlocks).toHaveBeenNthCalledWith(
      1,
      [{ type: "paragraph", content: "LABEL_aiGenerating" }],
      expect.objectContaining({ id: "blk1" }),
      "after",
    );
  });
});

describe("executeAgentCommand — request body", () => {
  it("sends correct body to /api/ai/notes-agentic with English language (no `command` field)", async () => {
    const editor = makeEditor();
    const ctx = makeCtx({ titleRefValue: "Daily Notes", localeRefValue: "en-US" });
    const fetchMock = vi.fn(() => Promise.resolve(makeStreamResponse("")));
    vi.stubGlobal("fetch", fetchMock);

    await executeAgentCommand(editor, ctx, "help me", "blk1");

    expect(fetchMock).toHaveBeenCalledWith("/api/ai/notes-agentic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: "help me",
        noteTitle: "Daily Notes",
        noteContext: "",
        language: "en",
      }),
    });
  });

  it("sends language='zh' when localeRef.current starts with 'zh'", async () => {
    const editor = makeEditor();
    const ctx = makeCtx({ localeRefValue: "zh-TW" });
    const fetchMock = vi.fn(() => Promise.resolve(makeStreamResponse("")));
    vi.stubGlobal("fetch", fetchMock);

    await executeAgentCommand(editor, ctx, "help", "blk1");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.language).toBe("zh");
  });
});

describe("executeAgentCommand — streaming with parser", () => {
  it("updates loading block with progress label on tool-input-available", async () => {
    const sse = sseFromChunks([
      {
        type: "tool-input-available",
        toolName: "searchNotes",
        toolCallId: "c1",
        input: {},
      },
      { type: "finish", finishReason: "stop" },
    ]);
    const editor = makeEditor();
    const t = vi.fn((k) => `T(${k})`);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(makeStreamResponse(sse))));

    await executeAgentCommand(editor, makeCtx({ tFn: t }), "x", "blk1");

    const labelCall = editor.updateBlock.mock.calls.find(
      (c) => typeof c[1].content === "string" && c[1].content === "T(agentSearchingNotes)",
    );
    expect(labelCall, "expected progress-label updateBlock call").toBeDefined();
  });

  it("replays text-only fixture and finalizes with accumulated text (no side effects)", async () => {
    const editor = makeEditor();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(makeStreamResponse(AGENTIC_FIXTURE))));

    await executeAgentCommand(editor, makeCtx(), "x", "blk1");

    expect(editor.tryParseMarkdownToBlocks).toHaveBeenCalledWith(
      "Hello from the agent. Here is a brief response.\n\n- Point one\n- Point two\n",
    );
    expect(editor.removeBlocks).toHaveBeenCalled();
    // 1 loading + 1 parsed = 2 insertBlocks calls (no side effects)
    expect(editor.insertBlocks).toHaveBeenCalledTimes(2);
  });

  it("replays reminder fixture and finalizes with createReminder side effect", async () => {
    const editor = makeEditor();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(makeStreamResponse(REMINDER_FIXTURE))));

    await executeAgentCommand(editor, makeCtx(), "set reminder", "blk1");

    // 1 loading + 1 parsed + 1 side-effect label = 3 insertBlocks calls
    expect(editor.insertBlocks).toHaveBeenCalledTimes(3);
    const sideEffectCall = editor.insertBlocks.mock.calls[2];
    expect(sideEffectCall[0][0].content[0]).toEqual({
      type: "text",
      text: "T(agentSideEffect) Test reminder (2024-01-01T09:00:00Z)",
      styles: { italic: true },
    });
  });

  it("aborts BOTH UI updates AND parser feed when updateBlock throws mid-stream (inline characterization)", async () => {
    const sse = sseFromChunks([
      { type: "text-delta", id: "txt_1", delta: "hello " },
      { type: "text-delta", id: "txt_1", delta: "world" },
      { type: "finish", finishReason: "stop" },
    ]);
    const editor = makeEditor();
    editor.updateBlock.mockImplementationOnce(() => {
      throw new Error("loading block deleted");
    });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(makeStreamResponse(sse))));

    await executeAgentCommand(editor, makeCtx(), "x", "blk1");

    // Inline characterization: the `if (aborted || !part.success) return;`
    // guard skips parser.feed too once aborted. Accumulated stays at first chunk
    // ("hello "). Finalize still runs with that partial text.
    expect(editor.tryParseMarkdownToBlocks).toHaveBeenCalledWith("hello ");
  });
});

describe("executeAgentCommand — error handling", () => {
  it("handles 4xx with JSON error body, updates loading block with error message, DELETES consumed tracking", async () => {
    const editor = makeEditor();
    const ctx = makeCtx({ executed: new Map([["blk1", "/agent do"]]) });
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        makeStreamResponse("", { ok: false, status: 400, jsonBody: { error: "Bad agent input" } }),
      ),
    );

    await executeAgentCommand(editor, ctx, "do", "blk1");

    const errCall = editor.updateBlock.mock.calls.find(
      (c) => typeof c[1].content === "string" && c[1].content.includes("Bad agent input"),
    );
    expect(errCall, "expected error message in loading block").toBeDefined();

    // Agent path DELETES consumed tracking on error (allows retry — different
    // from inline path which does NOT delete).
    expect(ctx.executedCommandsRef.current.has("blk1")).toBe(false);
  });

  it("handles 5xx without parseable JSON: HTTP status in error message", async () => {
    const editor = makeEditor();
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        makeStreamResponse("", { ok: false, status: 503, jsonBody: "__throw__" }),
      ),
    );

    await executeAgentCommand(editor, makeCtx(), "x", "blk1");

    const errCall = editor.updateBlock.mock.calls.find(
      (c) => typeof c[1].content === "string" && c[1].content.includes("HTTP 503"),
    );
    expect(errCall, "expected HTTP 503 in error message").toBeDefined();
  });

  it("updates loading block with error and deletes consumed tracking on fetch reject (network error)", async () => {
    const editor = makeEditor();
    const ctx = makeCtx({ executed: new Map([["blk1", "/agent x"]]) });
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network down"))));

    await executeAgentCommand(editor, ctx, "x", "blk1");

    const errCall = editor.updateBlock.mock.calls.find(
      (c) => typeof c[1].content === "string" && c[1].content.includes("network down"),
    );
    expect(errCall, "expected network-down error in loading block").toBeDefined();
    expect(ctx.executedCommandsRef.current.has("blk1")).toBe(false);
  });
});
