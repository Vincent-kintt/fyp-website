import { describe, it, expect, vi } from "vitest";

vi.mock("@/components/notes/NoteIcon", () => ({
  default: () => null,
}));

import { getMentionItems } from "@/components/notes/editor/menus/getMentionItems";

const t = (k) => `T(${k})`;

function makeEditorInstance() {
  return {
    insertInlineContent: vi.fn(),
  };
}

describe("getMentionItems", () => {
  it("returns empty array when notes is null", () => {
    expect(
      getMentionItems({ notes: null, t, editorInstance: makeEditorInstance() }),
    ).toEqual([]);
  });

  it("returns empty array when notes is undefined", () => {
    expect(
      getMentionItems({ notes: undefined, t, editorInstance: makeEditorInstance() }),
    ).toEqual([]);
  });

  it("returns empty array when notes is empty array", () => {
    expect(
      getMentionItems({ notes: [], t, editorInstance: makeEditorInstance() }),
    ).toEqual([]);
  });

  it("returns one item per note with correct title and aliases", () => {
    const notes = [
      { id: "n1", title: "Alpha", icon: null },
      { id: "n2", title: "Beta", icon: "📝" },
    ];
    const items = getMentionItems({
      notes,
      t,
      editorInstance: makeEditorInstance(),
    });
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Alpha");
    expect(items[1].title).toBe("Beta");
    expect(items[0].aliases).toEqual([]);
    expect(items[1].aliases).toEqual([]);
  });

  it("uses t('untitled') as fallback for note without title", () => {
    const items = getMentionItems({
      notes: [{ id: "n1", title: "", icon: null }],
      t,
      editorInstance: makeEditorInstance(),
    });
    expect(items[0].title).toBe("T(untitled)");
  });

  it("supports duplicate titles (regression for index-key fix in MentionMenu)", () => {
    const notes = [
      { id: "n1", title: "Same", icon: null },
      { id: "n2", title: "Same", icon: null },
    ];
    const items = getMentionItems({
      notes,
      t,
      editorInstance: makeEditorInstance(),
    });
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Same");
    expect(items[1].title).toBe("Same");
    // Items remain distinct by ordering; MentionMenu's index-based key handles
    // the React reconciliation collision.
  });

  it("onItemClick inserts a noteLink inline content with the note's id", () => {
    const editorInstance = makeEditorInstance();
    const items = getMentionItems({
      notes: [{ id: "note-xyz", title: "X", icon: null }],
      t,
      editorInstance,
    });
    items[0].onItemClick();
    expect(editorInstance.insertInlineContent).toHaveBeenCalledWith([
      { type: "noteLink", props: { noteId: "note-xyz" } },
      " ",
    ]);
  });

  it("every item has group=t('mentionNotes')", () => {
    const items = getMentionItems({
      notes: [
        { id: "n1", title: "X" },
        { id: "n2", title: "Y" },
      ],
      t,
      editorInstance: makeEditorInstance(),
    });
    for (const item of items) {
      expect(item.group).toBe("T(mentionNotes)");
    }
  });
});
