import { describe, it, expect, vi } from "vitest";
import { finalizeAiResponse } from "@/components/notes/editor/commands/finalizeAiResponse.js";

function createEditorShim({
  parsedBlocks = [],
  existingBlockIds = ["loading-1", "cmd-1"],
} = {}) {
  const existingSet = new Set(existingBlockIds);
  let insertCounter = 0;
  return {
    tryParseMarkdownToBlocks: vi.fn(() => parsedBlocks),
    getBlock: vi.fn((id) => (existingSet.has(id) ? { id } : null)),
    removeBlocks: vi.fn(),
    insertBlocks: vi.fn((blocks) =>
      blocks.map((b) => ({ ...b, id: `inserted-${++insertCounter}` })),
    ),
    updateBlock: vi.fn(),
  };
}

const t = (key) => `T(${key})`;

describe("finalizeAiResponse — empty accumulated", () => {
  it("updates loading block with default aiError when accumulated is empty", async () => {
    const editor = createEditorShim();
    await finalizeAiResponse(editor, {
      loadingBlock: { id: "loading-1" },
      commandBlock: { id: "cmd-1" },
      accumulated: "",
      t,
    });
    expect(editor.updateBlock).toHaveBeenCalledWith(
      { id: "loading-1" },
      { type: "paragraph", content: "T(aiError)" },
    );
    expect(editor.tryParseMarkdownToBlocks).not.toHaveBeenCalled();
    expect(editor.removeBlocks).not.toHaveBeenCalled();
    expect(editor.insertBlocks).not.toHaveBeenCalled();
  });

  it("treats whitespace-only accumulated as empty", async () => {
    const editor = createEditorShim();
    await finalizeAiResponse(editor, {
      loadingBlock: { id: "loading-1" },
      commandBlock: { id: "cmd-1" },
      accumulated: "   \n  ",
      t,
    });
    expect(editor.updateBlock).toHaveBeenCalledWith(
      { id: "loading-1" },
      { type: "paragraph", content: "T(aiError)" },
    );
    expect(editor.tryParseMarkdownToBlocks).not.toHaveBeenCalled();
  });

  it("swallows updateBlock throw when loadingBlock already deleted", async () => {
    const editor = createEditorShim();
    editor.updateBlock.mockImplementation(() => {
      throw new Error("block deleted");
    });
    await expect(
      finalizeAiResponse(editor, {
        loadingBlock: { id: "loading-1" },
        commandBlock: { id: "cmd-1" },
        accumulated: "",
        t,
      }),
    ).resolves.toBeUndefined();
  });

  it("uses custom errorKey when provided", async () => {
    const editor = createEditorShim();
    await finalizeAiResponse(editor, {
      loadingBlock: { id: "loading-1" },
      commandBlock: { id: "cmd-1" },
      accumulated: "",
      t,
      errorKey: "customError",
    });
    expect(editor.updateBlock).toHaveBeenCalledWith(
      { id: "loading-1" },
      { type: "paragraph", content: "T(customError)" },
    );
  });
});

describe("finalizeAiResponse — non-empty accumulated, no side effects", () => {
  it("parses markdown, removes loading, inserts parsed blocks when both blocks still exist", async () => {
    const parsedBlocks = [{ type: "paragraph", content: "hello" }];
    const editor = createEditorShim({ parsedBlocks });
    await finalizeAiResponse(editor, {
      loadingBlock: { id: "loading-1" },
      commandBlock: { id: "cmd-1" },
      accumulated: "hello",
      t,
    });
    expect(editor.tryParseMarkdownToBlocks).toHaveBeenCalledWith("hello");
    expect(editor.removeBlocks).toHaveBeenCalledWith([{ id: "loading-1" }]);
    expect(editor.insertBlocks).toHaveBeenCalledWith(parsedBlocks, { id: "cmd-1" }, "after");
  });

  it("skips removeBlocks when loadingBlock no longer exists, but still inserts parsed", async () => {
    const parsedBlocks = [{ type: "paragraph", content: "hello" }];
    const editor = createEditorShim({ parsedBlocks, existingBlockIds: ["cmd-1"] });
    await finalizeAiResponse(editor, {
      loadingBlock: { id: "loading-1" },
      commandBlock: { id: "cmd-1" },
      accumulated: "hello",
      t,
    });
    expect(editor.removeBlocks).not.toHaveBeenCalled();
    expect(editor.insertBlocks).toHaveBeenCalledWith(parsedBlocks, { id: "cmd-1" }, "after");
  });

  it("skips insertBlocks when commandBlock no longer exists", async () => {
    const parsedBlocks = [{ type: "paragraph", content: "hello" }];
    const editor = createEditorShim({ parsedBlocks, existingBlockIds: ["loading-1"] });
    await finalizeAiResponse(editor, {
      loadingBlock: { id: "loading-1" },
      commandBlock: { id: "cmd-1" },
      accumulated: "hello",
      t,
    });
    expect(editor.removeBlocks).toHaveBeenCalled();
    expect(editor.insertBlocks).not.toHaveBeenCalled();
  });

  it("skips insertBlocks when tryParseMarkdownToBlocks returns empty array", async () => {
    const editor = createEditorShim({ parsedBlocks: [] });
    await finalizeAiResponse(editor, {
      loadingBlock: { id: "loading-1" },
      commandBlock: { id: "cmd-1" },
      accumulated: "hello",
      t,
    });
    expect(editor.tryParseMarkdownToBlocks).toHaveBeenCalledWith("hello");
    expect(editor.removeBlocks).toHaveBeenCalled();
    expect(editor.insertBlocks).not.toHaveBeenCalled();
  });
});

describe("finalizeAiResponse — side effects (createReminder)", () => {
  it("appends italic side-effect label after last inserted block when one createReminder side effect present", async () => {
    const parsedBlocks = [{ type: "paragraph", content: "done" }];
    const editor = createEditorShim({ parsedBlocks });
    await finalizeAiResponse(editor, {
      loadingBlock: { id: "loading-1" },
      commandBlock: { id: "cmd-1" },
      accumulated: "done",
      sideEffects: [
        { tool: "createReminder", title: "Lunch", dateTime: "2026-05-20T12:00" },
      ],
      t,
    });
    expect(editor.insertBlocks).toHaveBeenCalledTimes(2);
    expect(editor.insertBlocks).toHaveBeenNthCalledWith(
      1,
      parsedBlocks,
      { id: "cmd-1" },
      "after",
    );
    const secondCall = editor.insertBlocks.mock.calls[1];
    expect(secondCall[0]).toEqual([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "T(agentSideEffect) Lunch (2026-05-20T12:00)",
            styles: { italic: true },
          },
        ],
      },
    ]);
    expect(secondCall[2]).toBe("after");
  });

  it("omits date suffix when effect.dateTime is empty/falsy", async () => {
    const parsedBlocks = [{ type: "paragraph", content: "done" }];
    const editor = createEditorShim({ parsedBlocks });
    await finalizeAiResponse(editor, {
      loadingBlock: { id: "loading-1" },
      commandBlock: { id: "cmd-1" },
      accumulated: "done",
      sideEffects: [{ tool: "createReminder", title: "No date", dateTime: "" }],
      t,
    });
    const secondCall = editor.insertBlocks.mock.calls[1];
    expect(secondCall[0][0].content[0].text).toBe("T(agentSideEffect) No date");
  });

  it("inserts each side-effect block at the same lastBlock reference (preserves inline characterization)", async () => {
    const parsedBlocks = [
      { type: "paragraph", content: "first" },
      { type: "paragraph", content: "last" },
    ];
    const editor = createEditorShim({ parsedBlocks });
    await finalizeAiResponse(editor, {
      loadingBlock: { id: "loading-1" },
      commandBlock: { id: "cmd-1" },
      accumulated: "first\nlast",
      sideEffects: [
        { tool: "createReminder", title: "A", dateTime: "2026-05-20" },
        { tool: "createReminder", title: "B", dateTime: "2026-05-21" },
      ],
      t,
    });
    expect(editor.insertBlocks).toHaveBeenCalledTimes(3);
    const sideEffect1Ref = editor.insertBlocks.mock.calls[1][1];
    const sideEffect2Ref = editor.insertBlocks.mock.calls[2][1];
    expect(sideEffect1Ref).toEqual(sideEffect2Ref);
  });

  it("uses custom sideEffectLabelKey when provided", async () => {
    const parsedBlocks = [{ type: "paragraph", content: "done" }];
    const editor = createEditorShim({ parsedBlocks });
    await finalizeAiResponse(editor, {
      loadingBlock: { id: "loading-1" },
      commandBlock: { id: "cmd-1" },
      accumulated: "done",
      sideEffects: [{ tool: "createReminder", title: "X" }],
      t,
      sideEffectLabelKey: "customLabel",
    });
    const secondCall = editor.insertBlocks.mock.calls[1];
    expect(secondCall[0][0].content[0].text).toBe("T(customLabel) X");
  });

  it("does not insert side-effect blocks when parsed blocks were empty", async () => {
    const editor = createEditorShim({ parsedBlocks: [] });
    await finalizeAiResponse(editor, {
      loadingBlock: { id: "loading-1" },
      commandBlock: { id: "cmd-1" },
      accumulated: "hello",
      sideEffects: [{ tool: "createReminder", title: "X", dateTime: "Y" }],
      t,
    });
    expect(editor.insertBlocks).not.toHaveBeenCalled();
  });
});
