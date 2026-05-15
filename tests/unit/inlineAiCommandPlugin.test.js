import { describe, it, expect, vi } from "vitest";
import { PluginKey } from "@tiptap/pm/state";
import { createInlineAiCommandPlugin } from "@/components/notes/editor/plugins/inlineAiCommandPlugin.js";

function makeBlock({ type = "paragraph", text = "/ask hello", id = "blk1" } = {}) {
  return { id, type, content: text ? [{ text }] : [] };
}

function makeFakeEditor({
  block = makeBlock(),
  menuShown = false,
  hasTiptap = true,
  hasMenuExtension = true,
} = {}) {
  return {
    _tiptapEditor: hasTiptap ? {} : undefined,
    getTextCursorPosition: vi.fn(() => ({ block })),
    getExtension: vi.fn(() => (hasMenuExtension ? { shown: () => menuShown } : null)),
  };
}

function makeView({ from = 5, to = 5 } = {}) {
  return { state: { selection: { from, to } } };
}

function makeEnter(overrides = {}) {
  return {
    key: "Enter",
    shiftKey: false,
    isComposing: false,
    preventDefault: vi.fn(),
    ...overrides,
  };
}

function makeArgs(overrides = {}) {
  return {
    editor: makeFakeEditor(),
    executedCommandsRef: { current: new Map() },
    executeRef: { current: vi.fn() },
    ...overrides,
  };
}

describe("createInlineAiCommandPlugin — factory", () => {
  it("returns null when editor lacks _tiptapEditor", () => {
    const created = createInlineAiCommandPlugin({
      editor: { _tiptapEditor: undefined },
      executedCommandsRef: { current: new Map() },
      executeRef: { current: vi.fn() },
    });
    expect(created).toBeNull();
  });

  it("returns {plugin, pluginKey} on valid editor", () => {
    const created = createInlineAiCommandPlugin(makeArgs());
    expect(created.pluginKey).toBeInstanceOf(PluginKey);
    expect(typeof created.plugin.props.handleKeyDown).toBe("function");
  });
});

describe("createInlineAiCommandPlugin — key event gating", () => {
  it("returns false on non-Enter keys", () => {
    const args = makeArgs();
    const { plugin } = createInlineAiCommandPlugin(args);
    expect(plugin.props.handleKeyDown(makeView(), makeEnter({ key: "a" }))).toBe(false);
    expect(args.executeRef.current).not.toHaveBeenCalled();
  });

  it("returns false on Shift+Enter", () => {
    const args = makeArgs();
    const { plugin } = createInlineAiCommandPlugin(args);
    expect(plugin.props.handleKeyDown(makeView(), makeEnter({ shiftKey: true }))).toBe(false);
    expect(args.executeRef.current).not.toHaveBeenCalled();
  });

  it("returns false when isComposing (IME)", () => {
    const args = makeArgs();
    const { plugin } = createInlineAiCommandPlugin(args);
    expect(plugin.props.handleKeyDown(makeView(), makeEnter({ isComposing: true }))).toBe(false);
    expect(args.executeRef.current).not.toHaveBeenCalled();
  });
});

describe("createInlineAiCommandPlugin — context gating", () => {
  it("returns false when current block is not a paragraph", () => {
    const args = makeArgs({
      editor: makeFakeEditor({ block: makeBlock({ type: "bulletListItem" }) }),
    });
    const { plugin } = createInlineAiCommandPlugin(args);
    expect(plugin.props.handleKeyDown(makeView(), makeEnter())).toBe(false);
  });

  it("returns false when selection is not collapsed (from !== to)", () => {
    const args = makeArgs();
    const { plugin } = createInlineAiCommandPlugin(args);
    expect(plugin.props.handleKeyDown(makeView({ from: 3, to: 7 }), makeEnter())).toBe(false);
  });

  it("returns false when block text is not a recognized /command", () => {
    const args = makeArgs({
      editor: makeFakeEditor({ block: makeBlock({ text: "just normal text" }) }),
    });
    const { plugin } = createInlineAiCommandPlugin(args);
    expect(plugin.props.handleKeyDown(makeView(), makeEnter())).toBe(false);
  });
});

describe("createInlineAiCommandPlugin — empty-input handling", () => {
  it("returns false on /ask without input (lets Enter through for further typing)", () => {
    const args = makeArgs({
      editor: makeFakeEditor({ block: makeBlock({ text: "/ask" }) }),
    });
    const { plugin } = createInlineAiCommandPlugin(args);
    expect(plugin.props.handleKeyDown(makeView(), makeEnter())).toBe(false);
    expect(args.executeRef.current).not.toHaveBeenCalled();
  });

  it("returns false on /agent without input", () => {
    const args = makeArgs({
      editor: makeFakeEditor({ block: makeBlock({ text: "/agent" }) }),
    });
    const { plugin } = createInlineAiCommandPlugin(args);
    expect(plugin.props.handleKeyDown(makeView(), makeEnter())).toBe(false);
    expect(args.executeRef.current).not.toHaveBeenCalled();
  });
});

describe("createInlineAiCommandPlugin — slash-menu coexistence", () => {
  it("returns false when /summarize has no input AND menu is shown (menu handles)", () => {
    const args = makeArgs({
      editor: makeFakeEditor({
        block: makeBlock({ text: "/summarize" }),
        menuShown: true,
      }),
    });
    const { plugin } = createInlineAiCommandPlugin(args);
    expect(plugin.props.handleKeyDown(makeView(), makeEnter())).toBe(false);
    expect(args.executeRef.current).not.toHaveBeenCalled();
  });

  it("executes /ask hello even when menu is shown (user input overrides menu check)", () => {
    const event = makeEnter();
    const args = makeArgs({
      editor: makeFakeEditor({
        block: makeBlock({ text: "/ask hello", id: "blk1" }),
        menuShown: true,
      }),
    });
    const { plugin } = createInlineAiCommandPlugin(args);
    expect(plugin.props.handleKeyDown(makeView(), event)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(args.executeRef.current).toHaveBeenCalledWith("ask", "hello", "blk1");
  });

  it("executes /digest (no input, menu hidden) — menu check passes when menu not shown", () => {
    const event = makeEnter();
    const args = makeArgs({
      editor: makeFakeEditor({
        block: makeBlock({ text: "/digest", id: "blk1" }),
        menuShown: false,
      }),
    });
    const { plugin } = createInlineAiCommandPlugin(args);
    expect(plugin.props.handleKeyDown(makeView(), event)).toBe(true);
    expect(args.executeRef.current).toHaveBeenCalledWith("digest", "", "blk1");
  });
});

describe("createInlineAiCommandPlugin — consumed-tracking", () => {
  it("returns false when block was already consumed with the same text", () => {
    const args = makeArgs({
      editor: makeFakeEditor({ block: makeBlock({ text: "/ask hello", id: "blk1" }) }),
      executedCommandsRef: { current: new Map([["blk1", "/ask hello"]]) },
    });
    const { plugin } = createInlineAiCommandPlugin(args);
    expect(plugin.props.handleKeyDown(makeView(), makeEnter())).toBe(false);
    expect(args.executeRef.current).not.toHaveBeenCalled();
  });

  it("executes when block was consumed with DIFFERENT text (user edited the command)", () => {
    const event = makeEnter();
    const args = makeArgs({
      editor: makeFakeEditor({ block: makeBlock({ text: "/ask new", id: "blk1" }) }),
      executedCommandsRef: { current: new Map([["blk1", "/ask old"]]) },
    });
    const { plugin } = createInlineAiCommandPlugin(args);
    expect(plugin.props.handleKeyDown(makeView(), event)).toBe(true);
    expect(args.executeRef.current).toHaveBeenCalledWith("ask", "new", "blk1");
  });
});

describe("createInlineAiCommandPlugin — successful dispatch", () => {
  it("executes fresh /ask hello: preventDefault + executeRef called + returns true", () => {
    const event = makeEnter();
    const args = makeArgs({
      editor: makeFakeEditor({ block: makeBlock({ text: "/ask hello", id: "blk1" }) }),
    });
    const { plugin } = createInlineAiCommandPlugin(args);
    expect(plugin.props.handleKeyDown(makeView(), event)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(args.executeRef.current).toHaveBeenCalledWith("ask", "hello", "blk1");
  });

  it("does not throw when executeRef.current is null (graceful no-op call site)", () => {
    const event = makeEnter();
    const args = makeArgs({
      editor: makeFakeEditor({ block: makeBlock({ text: "/ask hello", id: "blk1" }) }),
      executeRef: { current: null },
    });
    const { plugin } = createInlineAiCommandPlugin(args);
    expect(plugin.props.handleKeyDown(makeView(), event)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("handler reads latest executeRef.current after plugin creation (stale-closure protection)", () => {
    const initialExecutor = vi.fn();
    const newExecutor = vi.fn();
    const executeRef = { current: initialExecutor };
    const event = makeEnter();
    const { plugin } = createInlineAiCommandPlugin({
      editor: makeFakeEditor({ block: makeBlock({ text: "/ask hello", id: "blk1" }) }),
      executedCommandsRef: { current: new Map() },
      executeRef,
    });

    // Simulate NoteEditor.js's useEffect updating executeAiCommandRef.current
    // on a later React render (after the plugin was already registered).
    executeRef.current = newExecutor;

    plugin.props.handleKeyDown(makeView(), event);

    expect(initialExecutor).not.toHaveBeenCalled();
    expect(newExecutor).toHaveBeenCalledWith("ask", "hello", "blk1");
  });
});
