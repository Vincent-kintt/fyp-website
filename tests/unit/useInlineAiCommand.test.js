import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeInlineAiCommand } from "@/components/notes/editor/commands/useInlineAiCommand.js";

function makeStreamResponse(text, { ok = true, status = 200, jsonBody } = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return {
    ok,
    status,
    body: stream,
    json: async () => {
      if (jsonBody === "__throw__") throw new Error("not json");
      return jsonBody ?? { error: text };
    },
  };
}

function makeBlock(overrides = {}) {
  return {
    id: "blk1",
    type: "paragraph",
    content: [{ text: "/ask hello" }],
    ...overrides,
  };
}

function makeEditor({
  block = makeBlock(),
  cursorBlock = block,
  parsedBlocks = [{ type: "paragraph", content: "answer" }],
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
        const newBlock = { ...b, id: newId };
        existing.set(newId, newBlock);
        return newBlock;
      }),
    ),
    removeBlocks: vi.fn((blocks) => {
      blocks.forEach((b) => existing.delete(b.id));
    }),
    updateBlock: vi.fn(),
    tryParseMarkdownToBlocks: vi.fn(() => parsedBlocks),
  };
}

function makeCtx({
  titleRefValue = "My Note",
  localeRefValue = "en-US",
  tFn = (k) => `T(${k})`,
  executed = new Map(),
} = {}) {
  return {
    titleRef: { current: titleRefValue },
    localeRef: { current: localeRefValue },
    t: tFn,
    executedCommandsRef: { current: executed },
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

describe("executeInlineAiCommand — block resolution", () => {
  it("returns early when commandBlockId provided but getBlock returns null and cursor block is null", async () => {
    const editor = makeEditor({ blockExists: false });
    editor.getTextCursorPosition.mockReturnValue({ block: null });
    vi.stubGlobal("fetch", vi.fn());

    await executeInlineAiCommand(editor, makeCtx(), "ask", "hello", "missing");

    expect(editor.insertBlocks).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("uses editor.getBlock(commandBlockId) when id is provided", async () => {
    const editor = makeEditor();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(makeStreamResponse("ok"))));

    await executeInlineAiCommand(editor, makeCtx(), "ask", "hello", "blk1");

    expect(editor.getBlock).toHaveBeenCalledWith("blk1");
    expect(editor.getTextCursorPosition).not.toHaveBeenCalled();
  });

  it("falls back to editor.getTextCursorPosition() when no commandBlockId (resolution phase)", async () => {
    const editor = makeEditor();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(makeStreamResponse("ok"))));

    await executeInlineAiCommand(editor, makeCtx(), "ask", "hello", null);

    expect(editor.getTextCursorPosition).toHaveBeenCalled();
    // getBlock may still be called later by finalizeAiResponse for existence checks,
    // but it should NOT be called with the original commandBlockId during resolution.
    const resolutionCalls = editor.getBlock.mock.calls.filter((args) => args[0] === null);
    expect(resolutionCalls).toEqual([]);
  });

  it("aborts (no fetch, no insert) when commandBlockId is provided but getBlock returns null, even if cursor block exists", async () => {
    // Characterization: original inline branch does NOT fall back to cursor when
    // commandBlockId is given but stale; it relies on the `if (!commandBlock) return;`
    // guard to abort.
    const cursorBlock = makeBlock({ id: "cursor-blk", text: "/ask cursor" });
    const editor = makeEditor({ blockExists: false, cursorBlock });
    vi.stubGlobal("fetch", vi.fn());

    await executeInlineAiCommand(editor, makeCtx(), "ask", "hello", "stale-id");

    expect(editor.getBlock).toHaveBeenCalledWith("stale-id");
    expect(editor.getTextCursorPosition).not.toHaveBeenCalled();
    expect(editor.insertBlocks).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("executeInlineAiCommand — consumed tracking and loading block", () => {
  it("marks the command block as consumed before fetching", async () => {
    const editor = makeEditor({
      block: makeBlock({ content: [{ text: "/ask hello world" }] }),
    });
    const ctx = makeCtx();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(makeStreamResponse("ok"))));

    await executeInlineAiCommand(editor, ctx, "ask", "hello world", "blk1");

    expect(ctx.executedCommandsRef.current.get("blk1")).toBe("/ask hello world");
  });

  it("inserts a loading block with t('aiGenerating') content after the command block", async () => {
    const editor = makeEditor();
    const t = vi.fn((k) => `LABEL_${k}`);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(makeStreamResponse("ok"))));

    await executeInlineAiCommand(editor, makeCtx({ tFn: t }), "ask", "hello", "blk1");

    expect(editor.insertBlocks).toHaveBeenNthCalledWith(
      1,
      [{ type: "paragraph", content: "LABEL_aiGenerating" }],
      expect.objectContaining({ id: "blk1" }),
      "after",
    );
  });
});

describe("executeInlineAiCommand — request body", () => {
  it("sends correct body to /api/ai/notes-agent with English language", async () => {
    const editor = makeEditor();
    const ctx = makeCtx({
      titleRefValue: "Daily Notes",
      localeRefValue: "en-US",
    });
    const fetchMock = vi.fn(() => Promise.resolve(makeStreamResponse("ok")));
    vi.stubGlobal("fetch", fetchMock);

    await executeInlineAiCommand(editor, ctx, "summarize", "input text", "blk1");

    expect(fetchMock).toHaveBeenCalledWith("/api/ai/notes-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: "summarize",
        input: "input text",
        noteTitle: "Daily Notes",
        noteContext: "",
        language: "en",
      }),
    });
  });

  it("sends language='zh' when localeRef.current starts with 'zh'", async () => {
    const editor = makeEditor();
    const ctx = makeCtx({ localeRefValue: "zh-TW" });
    const fetchMock = vi.fn(() => Promise.resolve(makeStreamResponse("ok")));
    vi.stubGlobal("fetch", fetchMock);

    await executeInlineAiCommand(editor, ctx, "ask", "hello", "blk1");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.language).toBe("zh");
  });

  it("falls back to noteContext when input is empty (e.g., /digest, /summarize without args)", async () => {
    const editor = makeEditor();
    const ctx = makeCtx();
    const fetchMock = vi.fn(() => Promise.resolve(makeStreamResponse("ok")));
    vi.stubGlobal("fetch", fetchMock);

    // Stub blocksToText behavior via document
    editor.document = [{ type: "paragraph", content: [{ type: "text", text: "context" }] }];

    await executeInlineAiCommand(editor, ctx, "digest", "", "blk1");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // input becomes noteContext (blocksToText output), command stays 'digest'
    expect(body.command).toBe("digest");
    expect(body.input).toBeTruthy();
  });
});

describe("executeInlineAiCommand — streaming", () => {
  it("accumulates stream chunks and updates loading block with stripped markdown each tick", async () => {
    const editor = makeEditor();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(makeStreamResponse("**hello** world"))));

    await executeInlineAiCommand(editor, makeCtx(), "ask", "x", "blk1");

    // updateBlock called at least once with stripped content
    const updateCalls = editor.updateBlock.mock.calls;
    const previewCall = updateCalls.find((c) =>
      typeof c[1].content === "string" && c[1].content.includes("hello world"),
    );
    expect(previewCall, "expected an updateBlock call with stripped content").toBeDefined();
  });

  it("calls finalizeAiResponse with accumulated text on stream end (parsed + inserted)", async () => {
    const editor = makeEditor({
      parsedBlocks: [{ type: "paragraph", content: "out" }],
    });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(makeStreamResponse("hello world"))));

    await executeInlineAiCommand(editor, makeCtx(), "ask", "x", "blk1");

    expect(editor.tryParseMarkdownToBlocks).toHaveBeenCalledWith("hello world");
    expect(editor.removeBlocks).toHaveBeenCalled();
    // After loading-block removal: insertBlocks called 2 times total
    // (1st: loading block, 2nd: parsed blocks via finalize)
    expect(editor.insertBlocks).toHaveBeenCalledTimes(2);
  });

  it("aborts (cancels reader, returns early) when editor.updateBlock throws mid-stream", async () => {
    const editor = makeEditor();
    editor.updateBlock.mockImplementationOnce(() => {
      throw new Error("block deleted");
    });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(makeStreamResponse("data"))));

    await executeInlineAiCommand(editor, makeCtx(), "ask", "x", "blk1");

    // tryParseMarkdownToBlocks NOT called because we returned before finalize
    expect(editor.tryParseMarkdownToBlocks).not.toHaveBeenCalled();
  });
});

describe("executeInlineAiCommand — error handling", () => {
  it("handles 4xx response with JSON error body: throws, updates loading block with error label + message", async () => {
    const editor = makeEditor();
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        makeStreamResponse("", { ok: false, status: 400, jsonBody: { error: "Bad input" } }),
      ),
    );

    await executeInlineAiCommand(editor, makeCtx(), "ask", "x", "blk1");

    const errorCall = editor.updateBlock.mock.calls.find((c) =>
      typeof c[1].content === "string" && c[1].content.includes("Bad input"),
    );
    expect(errorCall, "expected error message in loading block").toBeDefined();
  });

  it("handles 5xx response without parseable JSON: throws HTTP status, updates loading block with error", async () => {
    const editor = makeEditor();
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        makeStreamResponse("", { ok: false, status: 503, jsonBody: "__throw__" }),
      ),
    );

    await executeInlineAiCommand(editor, makeCtx(), "ask", "x", "blk1");

    const errorCall = editor.updateBlock.mock.calls.find((c) =>
      typeof c[1].content === "string" && c[1].content.includes("HTTP 503"),
    );
    expect(errorCall, "expected HTTP 503 in error message").toBeDefined();
  });

  it("updates loading block with error message when fetch rejects (network error)", async () => {
    const editor = makeEditor();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network down"))));

    await executeInlineAiCommand(editor, makeCtx(), "ask", "x", "blk1");

    const errorCall = editor.updateBlock.mock.calls.find((c) =>
      typeof c[1].content === "string" && c[1].content.includes("network down"),
    );
    expect(errorCall, "expected network-down error in loading block").toBeDefined();
  });

  it("silently swallows updateBlock throw on error path (loading block already deleted)", async () => {
    const editor = makeEditor();
    editor.updateBlock.mockImplementation(() => {
      throw new Error("gone");
    });
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network"))));

    await expect(
      executeInlineAiCommand(editor, makeCtx(), "ask", "x", "blk1"),
    ).resolves.toBeUndefined();
  });
});
