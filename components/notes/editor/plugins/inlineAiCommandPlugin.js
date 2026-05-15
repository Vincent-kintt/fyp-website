// Inline AI command plugin — Tiptap ProseMirror plugin that intercepts the
// Enter key on /command paragraph blocks and dispatches AI command execution.
//
// HIGH-RISK private-API surface (pinned to @blocknote/* 0.47.3 — see
// package.json + tests/unit/blocknote-version-lock.test.js for CI gate):
// - editor._tiptapEditor (BlockNote internal accessor for the underlying Tiptap instance)
// - editor.getTextCursorPosition() (public BlockNote API)
// - editor.getExtension(SuggestionMenu)?.shown() (private — SuggestionMenu is an
//   internal @blocknote/core class and .shown() is its internal state accessor;
//   used to coexist with the slash menu so the menu can handle no-input commands)
// - view.state.selection (standard ProseMirror API)
//
// Slash-menu coexistence rule: if the command has no user input (e.g. user typed
// `/summarize` and hasn't entered anything) AND the slash suggestion menu is
// currently shown, return false so the menu's "Enter" handler can execute the
// command via its menu-item callback. If the user provided input (e.g. `/ask
// hello`), we always intercept Enter, since the user clearly wants to run it.

import { Plugin, PluginKey } from "@tiptap/pm/state";
import { SuggestionMenu } from "@blocknote/core";
import { parseCommand } from "@/lib/notes/commands.js";

export function createInlineAiCommandPlugin({
  editor,
  executedCommandsRef,
  executeRef,
}) {
  const tiptap = editor?._tiptapEditor;
  if (!tiptap) return null;

  const pluginKey = new PluginKey("inline-ai-commands");
  const plugin = new Plugin({
    key: pluginKey,
    props: {
      handleKeyDown(view, event) {
        if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
          return false;
        }

        const pos = editor.getTextCursorPosition();
        const block = pos.block;

        if (block.type !== "paragraph") return false;

        const { from, to } = view.state.selection;
        if (from !== to) return false;

        const blockText =
          block.content?.map((c) => c.text || "").join("") || "";
        const parsed = parseCommand(blockText);
        if (!parsed) return false;

        if (
          (parsed.type === "ask" || parsed.type === "agent") &&
          !parsed.input
        ) {
          return false;
        }

        if (!parsed.input && editor.getExtension(SuggestionMenu)?.shown()) {
          return false;
        }

        const prevText = executedCommandsRef.current.get(block.id);
        if (prevText !== undefined && prevText === blockText) return false;

        event.preventDefault();
        executeRef.current?.(parsed.type, parsed.input, block.id);
        return true;
      },
    },
  });

  return { plugin, pluginKey };
}
