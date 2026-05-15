import { describe, it, expect, vi } from "vitest";
import { PluginKey } from "@tiptap/pm/state";
import { createSafeUnnestPlugin } from "@/components/notes/editor/plugins/safeUnnestPlugin.js";

function makeFakeEditor(liftImpl = vi.fn(() => true)) {
  return {
    _tiptapEditor: {
      commands: {
        liftListItem: liftImpl,
      },
    },
  };
}

const shiftTab = { key: "Tab", shiftKey: true };

describe("createSafeUnnestPlugin", () => {
  it("returns null when editor has no _tiptapEditor", () => {
    expect(createSafeUnnestPlugin({})).toBeNull();
    expect(createSafeUnnestPlugin({ _tiptapEditor: undefined })).toBeNull();
  });

  it("returns an object with plugin + pluginKey when editor is valid", () => {
    const created = createSafeUnnestPlugin(makeFakeEditor());
    expect(created).not.toBeNull();
    expect(created.pluginKey).toBeInstanceOf(PluginKey);
    expect(typeof created.plugin.props.handleKeyDown).toBe("function");
  });

  it("calls liftListItem('blockContainer') on Shift+Tab and returns its result", () => {
    const lift = vi.fn(() => true);
    const editor = makeFakeEditor(lift);
    const { plugin } = createSafeUnnestPlugin(editor);
    const handled = plugin.props.handleKeyDown(null, shiftTab);
    expect(lift).toHaveBeenCalledWith("blockContainer");
    expect(handled).toBe(true);
  });

  it("returns false on Tab without shiftKey (no liftListItem call)", () => {
    const lift = vi.fn(() => true);
    const { plugin } = createSafeUnnestPlugin(makeFakeEditor(lift));
    const handled = plugin.props.handleKeyDown(null, { key: "Tab", shiftKey: false });
    expect(handled).toBe(false);
    expect(lift).not.toHaveBeenCalled();
  });

  it("returns false on non-Tab keys (no liftListItem call)", () => {
    const lift = vi.fn(() => true);
    const { plugin } = createSafeUnnestPlugin(makeFakeEditor(lift));
    expect(plugin.props.handleKeyDown(null, { key: "Enter", shiftKey: true })).toBe(false);
    expect(plugin.props.handleKeyDown(null, { key: "a", shiftKey: true })).toBe(false);
    expect(lift).not.toHaveBeenCalled();
  });

  it("swallows RangeError('Invalid content...') from liftListItem and returns true", () => {
    const lift = vi.fn(() => {
      throw new RangeError("Invalid content for node");
    });
    const { plugin } = createSafeUnnestPlugin(makeFakeEditor(lift));
    expect(plugin.props.handleKeyDown(null, shiftTab)).toBe(true);
  });

  it("rethrows RangeError without 'Invalid content' substring", () => {
    const lift = vi.fn(() => {
      throw new RangeError("position out of range");
    });
    const { plugin } = createSafeUnnestPlugin(makeFakeEditor(lift));
    expect(() => plugin.props.handleKeyDown(null, shiftTab)).toThrow(RangeError);
  });

  it("rethrows non-RangeError exceptions", () => {
    const lift = vi.fn(() => {
      throw new TypeError("unrelated");
    });
    const { plugin } = createSafeUnnestPlugin(makeFakeEditor(lift));
    expect(() => plugin.props.handleKeyDown(null, shiftTab)).toThrow(TypeError);
  });

  it("propagates liftListItem's boolean return (false = not handled)", () => {
    const lift = vi.fn(() => false);
    const { plugin } = createSafeUnnestPlugin(makeFakeEditor(lift));
    expect(plugin.props.handleKeyDown(null, shiftTab)).toBe(false);
  });
});
