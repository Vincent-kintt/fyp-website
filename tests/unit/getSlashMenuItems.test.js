import { describe, it, expect, vi } from "vitest";

vi.mock("@blocknote/react", () => ({
  getDefaultReactSlashMenuItems: () => [
    { title: "DefaultItem", group: "Default" },
  ],
}));

import { getSlashMenuItems } from "@/components/notes/editor/menus/getSlashMenuItems";

function makeEditorInstance({ block } = {}) {
  return {
    getTextCursorPosition: vi.fn(() => ({
      block: block || { id: "blk1", content: [{ text: "" }] },
    })),
    updateBlock: vi.fn(),
    setTextCursorPosition: vi.fn(),
    insertBlocks: vi.fn((b) =>
      b.map((bl, i) => ({ ...bl, id: `new-${i}` })),
    ),
  };
}

const t = (k) => `T(${k})`;

describe("getSlashMenuItems", () => {
  it("returns only default items when disableAiCommands=true", () => {
    const items = getSlashMenuItems({
      editorInstance: makeEditorInstance(),
      t,
      executeAiCommand: vi.fn(),
      disableAiCommands: true,
    });
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("DefaultItem");
  });

  it("appends 5 AI items after defaults when disableAiCommands=false", () => {
    const items = getSlashMenuItems({
      editorInstance: makeEditorInstance(),
      t,
      executeAiCommand: vi.fn(),
      disableAiCommands: false,
    });
    expect(items).toHaveLength(6); // 1 default + 5 AI
    const aiTitles = items.slice(1).map((i) => i.title);
    expect(aiTitles).toEqual([
      "T(askAi)",
      "T(summarize)",
      "T(digestLabel)",
      "T(agent)",
      "T(rss)",
    ]);
  });

  it("each AI item has group='AI', aliases array, and onItemClick function", () => {
    const items = getSlashMenuItems({
      editorInstance: makeEditorInstance(),
      t,
      executeAiCommand: vi.fn(),
    });
    const aiItems = items.filter((i) => i.group === "AI");
    expect(aiItems).toHaveLength(5);
    for (const item of aiItems) {
      expect(item.aliases).toBeInstanceOf(Array);
      expect(typeof item.onItemClick).toBe("function");
      expect(item.subtext).toBeTruthy();
    }
  });

  it("askAi onItemClick on empty block updates block to /ask and moves cursor (no insertBlocks)", () => {
    const block = { id: "blk1", content: [{ text: "" }] };
    const editorInstance = makeEditorInstance({ block });
    const items = getSlashMenuItems({
      editorInstance,
      t,
      executeAiCommand: vi.fn(),
    });
    const askItem = items.find((i) => i.title === "T(askAi)");
    askItem.onItemClick();
    expect(editorInstance.updateBlock).toHaveBeenCalledWith(block, {
      type: "paragraph",
      content: "/ask ",
    });
    expect(editorInstance.setTextCursorPosition).toHaveBeenCalledWith(block, "end");
    expect(editorInstance.insertBlocks).not.toHaveBeenCalled();
  });

  it("askAi onItemClick on non-empty block inserts new /ask block below (no updateBlock)", () => {
    const block = { id: "blk1", content: [{ text: "existing" }] };
    const editorInstance = makeEditorInstance({ block });
    const items = getSlashMenuItems({
      editorInstance,
      t,
      executeAiCommand: vi.fn(),
    });
    const askItem = items.find((i) => i.title === "T(askAi)");
    askItem.onItemClick();
    expect(editorInstance.insertBlocks).toHaveBeenCalledWith(
      [{ type: "paragraph", content: "/ask " }],
      block,
      "after",
    );
    expect(editorInstance.updateBlock).not.toHaveBeenCalled();
  });

  it("summarize onItemClick on empty block calls executeAiCommand('summarize', '', blockId)", () => {
    const block = { id: "blk1", content: [{ text: "" }] };
    const editorInstance = makeEditorInstance({ block });
    const executeAiCommand = vi.fn();
    const items = getSlashMenuItems({ editorInstance, t, executeAiCommand });
    const summarizeItem = items.find((i) => i.title === "T(summarize)");
    summarizeItem.onItemClick();
    expect(executeAiCommand).toHaveBeenCalledWith("summarize", "", "blk1");
  });

  it("rss onItemClick on empty block calls executeAiCommand('rss', 'today', blockId)", () => {
    const block = { id: "blk1", content: [{ text: "" }] };
    const editorInstance = makeEditorInstance({ block });
    const executeAiCommand = vi.fn();
    const items = getSlashMenuItems({ editorInstance, t, executeAiCommand });
    const rssItem = items.find((i) => i.title === "T(rss)");
    rssItem.onItemClick();
    expect(executeAiCommand).toHaveBeenCalledWith("rss", "today", "blk1");
  });
});
