import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { executeRssCommand } from "@/components/notes/editor/commands/useRssCommand.js";

const RSS_FIXTURE = readFileSync(
  new URL("../fixtures/notes-rss-stream.txt", import.meta.url),
  "utf-8",
);

function makeJsonResponse(jsonBody, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => jsonBody,
  };
}

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

function makeBlock(overrides = {}) {
  return {
    id: "blk1",
    type: "paragraph",
    content: [{ text: "/rss" }],
    ...overrides,
  };
}

function makeEditor({
  block = makeBlock(),
  cursorBlock = block,
  parsedBlocks = [{ type: "paragraph", content: "rss out" }],
  blockExists = true,
} = {}) {
  let insertCounter = 0;
  const existing = new Map();
  if (blockExists && block) existing.set(block.id, block);

  return {
    document: [],
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
    removeBlocks: vi.fn((blocks) => blocks.forEach((b) => existing.delete(b.id))),
    updateBlock: vi.fn(),
    tryParseMarkdownToBlocks: vi.fn(() => parsedBlocks),
  };
}

const DEFAULT_LABELS = {
  fetchRSSFeeds: "rssFetchingFeeds",
};

function makeCtx({
  localeRefValue = "en-US",
  tFn = (k) => `T(${k})`,
  executed = new Map(),
  toolProgressLabels = DEFAULT_LABELS,
  onNeedOnboarding = vi.fn(),
} = {}) {
  return {
    localeRef: { current: localeRefValue },
    t: tFn,
    executedCommandsRef: { current: executed },
    toolProgressLabels,
    onNeedOnboarding,
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

describe("executeRssCommand — block resolution", () => {
  it("returns early when no commandBlock", async () => {
    const editor = makeEditor({ blockExists: false });
    editor.getTextCursorPosition.mockReturnValue({ block: null });
    vi.stubGlobal("fetch", vi.fn());

    await executeRssCommand(editor, makeCtx(), null);

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("marks block consumed before any fetch (consumed survives happy path)", async () => {
    const editor = makeEditor({
      block: makeBlock({ content: [{ text: "/rss today" }] }),
    });
    const ctx = makeCtx();
    // Two responses so the happy path completes without triggering the error
    // path that would otherwise delete the consumed entry.
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(makeJsonResponse({ data: [{ id: "sub1" }] }))
        .mockResolvedValueOnce(makeStreamResponse("")),
    );

    await executeRssCommand(editor, ctx, "blk1");

    expect(ctx.executedCommandsRef.current.get("blk1")).toBe("/rss today");
  });
});

describe("executeRssCommand — subscription precheck", () => {
  it("calls GET /api/rss before any streaming POST", async () => {
    const editor = makeEditor();
    const fetchMock = vi.fn(() =>
      Promise.resolve(makeJsonResponse({ data: [{ id: "sub1" }] })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await executeRssCommand(editor, makeCtx(), "blk1");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/rss");
  });

  it("opens onboarding (no streaming POST) when GET /api/rss returns empty data array", async () => {
    const editor = makeEditor();
    const onNeedOnboarding = vi.fn();
    const ctx = makeCtx({ onNeedOnboarding });
    const fetchMock = vi.fn(() => Promise.resolve(makeJsonResponse({ data: [] })));
    vi.stubGlobal("fetch", fetchMock);

    await executeRssCommand(editor, ctx, "blk1");

    expect(onNeedOnboarding).toHaveBeenCalledTimes(1);
    expect(typeof onNeedOnboarding.mock.calls[0][0]).toBe("function");
    // Only one fetch: the GET precheck. No streaming POST.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // No loading block inserted in onboarding gate (loading is deferred to retry).
    expect(editor.insertBlocks).not.toHaveBeenCalled();
  });

  it("opens onboarding when checkBody.data is missing entirely", async () => {
    const editor = makeEditor();
    const onNeedOnboarding = vi.fn();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(makeJsonResponse({}))));

    await executeRssCommand(editor, makeCtx({ onNeedOnboarding }), "blk1");

    expect(onNeedOnboarding).toHaveBeenCalled();
  });

  it("proceeds directly to streaming POST when subscriptions exist", async () => {
    const editor = makeEditor();
    const onNeedOnboarding = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ data: [{ id: "sub1" }] }))
      .mockResolvedValueOnce(makeStreamResponse(""));
    vi.stubGlobal("fetch", fetchMock);

    await executeRssCommand(editor, makeCtx({ onNeedOnboarding }), "blk1");

    expect(onNeedOnboarding).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/ai/notes-rss");
  });

  it("deletes consumed tracking when GET /api/rss returns non-OK", async () => {
    const editor = makeEditor();
    const ctx = makeCtx({ executed: new Map([["blk1", "/rss"]]) });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(makeJsonResponse({}, { ok: false, status: 500 }))),
    );

    await executeRssCommand(editor, ctx, "blk1");

    expect(ctx.executedCommandsRef.current.has("blk1")).toBe(false);
  });
});

describe("executeRssCommand — subscribeAndRetry from onboarding", () => {
  it("subscribeAndRetry POSTs categories then runs streaming RSS fetch", async () => {
    const editor = makeEditor();
    let captured;
    const onNeedOnboarding = vi.fn((fn) => {
      captured = fn;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ data: [] })) // initial GET (empty)
      .mockResolvedValueOnce(makeJsonResponse({ success: true })) // POST /api/rss subscribe
      .mockResolvedValueOnce(makeStreamResponse("")); // streaming POST
    vi.stubGlobal("fetch", fetchMock);

    await executeRssCommand(editor, makeCtx({ onNeedOnboarding }), "blk1");
    expect(onNeedOnboarding).toHaveBeenCalled();
    expect(captured).toBeTypeOf("function");

    await captured(["tech", "world"]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const subCall = fetchMock.mock.calls[1];
    expect(subCall[0]).toBe("/api/rss");
    expect(subCall[1].method).toBe("POST");
    expect(JSON.parse(subCall[1].body)).toEqual({ categories: ["tech", "world"] });
    expect(fetchMock.mock.calls[2][0]).toBe("/api/ai/notes-rss");
  });

  it("subscribeAndRetry throws when POST /api/rss fails", async () => {
    const editor = makeEditor();
    let captured;
    const onNeedOnboarding = vi.fn((fn) => {
      captured = fn;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ data: [] }))
      .mockResolvedValueOnce(makeJsonResponse({}, { ok: false, status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    await executeRssCommand(editor, makeCtx({ onNeedOnboarding }), "blk1");

    await expect(captured(["tech"])).rejects.toThrow(/Failed to subscribe/);
  });
});

describe("executeRssCommand — streaming POST", () => {
  it("sends correct body to /api/ai/notes-rss with language + timezone (no input/noteTitle/noteContext)", async () => {
    const editor = makeEditor();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ data: [{ id: "sub1" }] }))
      .mockResolvedValueOnce(makeStreamResponse(""));
    vi.stubGlobal("fetch", fetchMock);

    await executeRssCommand(
      editor,
      makeCtx({ localeRefValue: "zh-TW" }),
      "blk1",
    );

    const streamCall = fetchMock.mock.calls[1];
    expect(streamCall[0]).toBe("/api/ai/notes-rss");
    expect(streamCall[1].method).toBe("POST");
    const body = JSON.parse(streamCall[1].body);
    expect(body.language).toBe("zh");
    expect(typeof body.timezone).toBe("string");
    expect(body.input).toBeUndefined();
    expect(body.noteTitle).toBeUndefined();
    expect(body.noteContext).toBeUndefined();
  });

  it("replays RSS fixture and finalizes with accumulated text (no side effects for RSS path)", async () => {
    const editor = makeEditor();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(makeJsonResponse({ data: [{ id: "sub1" }] }))
        .mockResolvedValueOnce(makeStreamResponse(RSS_FIXTURE)),
    );

    await executeRssCommand(editor, makeCtx(), "blk1");

    expect(editor.tryParseMarkdownToBlocks).toHaveBeenCalled();
    // Inserts: 1 loading + 1 parsed = 2. RSS path produces no side-effect labels
    // (createReminder side effect collection requires tool-input-available with
    // toolName="createReminder", which the RSS stream does not emit).
    expect(editor.insertBlocks).toHaveBeenCalledTimes(2);
  });
});

describe("executeRssCommand — streaming error handling", () => {
  it("updates loading block with error and deletes consumed on streaming-POST 4xx", async () => {
    const editor = makeEditor();
    const ctx = makeCtx({ executed: new Map([["blk1", "/rss"]]) });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(makeJsonResponse({ data: [{ id: "sub1" }] }))
        .mockResolvedValueOnce(
          makeStreamResponse("", { ok: false, status: 500, jsonBody: { error: "RSS server down" } }),
        ),
    );

    await executeRssCommand(editor, ctx, "blk1");

    const errCall = editor.updateBlock.mock.calls.find(
      (c) => typeof c[1].content === "string" && c[1].content.includes("RSS server down"),
    );
    expect(errCall, "expected error message in loading block").toBeDefined();
    expect(ctx.executedCommandsRef.current.has("blk1")).toBe(false);
  });

  it("updates loading block with error and deletes consumed on streaming-POST network reject", async () => {
    const editor = makeEditor();
    const ctx = makeCtx({ executed: new Map([["blk1", "/rss"]]) });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(makeJsonResponse({ data: [{ id: "sub1" }] }))
        .mockRejectedValueOnce(new Error("network down")),
    );

    await executeRssCommand(editor, ctx, "blk1");

    const errCall = editor.updateBlock.mock.calls.find(
      (c) => typeof c[1].content === "string" && c[1].content.includes("network down"),
    );
    expect(errCall, "expected network error in loading block").toBeDefined();
    expect(ctx.executedCommandsRef.current.has("blk1")).toBe(false);
  });
});
