// Workaround for BlockNote#1338: editor._tiptapEditor.commands.liftListItem
// throws RangeError("Invalid content for node ...") when the nested list item
// has siblings after it. Upstream fix: PR #2601. Remove this module once
// BlockNote ships the fix (> v0.47.3).
//
// Private API touched (currently resolved to @blocknote/* 0.47.3; package.json
// still has range ^0.47.3 — exact pin is part of PR3b R0 mitigation):
// - editor._tiptapEditor (BlockNote internal accessor for the underlying Tiptap instance)
// - tiptap.commands.liftListItem (Tiptap list-item command)

import { Plugin, PluginKey } from "@tiptap/pm/state";

export function createSafeUnnestPlugin(editor) {
  const tiptap = editor?._tiptapEditor;
  if (!tiptap) return null;

  const pluginKey = new PluginKey("safe-unnest");
  const plugin = new Plugin({
    key: pluginKey,
    props: {
      handleKeyDown(view, event) {
        if (event.key !== "Tab" || !event.shiftKey) return false;
        try {
          return tiptap.commands.liftListItem("blockContainer");
        } catch (e) {
          if (
            e instanceof RangeError &&
            e.message.includes("Invalid content")
          ) {
            return true;
          }
          throw e;
        }
      },
    },
  });

  return { plugin, pluginKey };
}
