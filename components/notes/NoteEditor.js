"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { BlockNoteView } from "@blocknote/mantine";
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { filterSuggestionItems, SuggestionMenu } from "@blocknote/core";
import { en as bnEn } from "@blocknote/core/locales";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { parseCommand } from "@/lib/notes/commands.js";
import { blocksToText } from "@/lib/notes/blocksToText.js";
import "@blocknote/mantine/style.css";
import NoteIcon from "./NoteIcon";
import IconPicker from "./IconPicker";

export default function NoteEditor({ note, onSave, onSaveStatusChange, onIconChange, hideTitle, editorRef, disableAiCommands }) {
  const t = useTranslations("notes");
  const locale = useLocale();
  const { theme } = useTheme();
  const [title, setTitle] = useState(note?.title || "");
  const [saveStatus, setSaveStatus] = useState(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const saveTimerRef = useRef(null);
  const titleTimerRef = useRef(null);
  const titleRef = useRef(title);
  const localeRef = useRef(locale);
  const executedCommandsRef = useRef(new Map());
  const executeAiCommandRef = useRef(null);

  useEffect(() => {
    setTitle(note?.title || "");
    setSaveStatus(null);
    executedCommandsRef.current.clear();
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { titleRef.current = title; }, [title]);
  useEffect(() => { localeRef.current = locale; }, [locale]);

  const editor = useCreateBlockNote({
    initialContent: note?.content?.length > 0 ? note.content : undefined,
    dictionary: {
      ...bnEn,
      placeholders: {
        ...bnEn.placeholders,
        default: t("editorPlaceholder"),
      },
    },
  });

  useEffect(() => {
    if (note?.content?.length > 0) {
      editor.replaceBlocks(editor.document, note.content);
    } else {
      editor.replaceBlocks(editor.document, [
        { type: "paragraph", content: [] },
      ]);
    }
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Expose editor content to parent via ref callback
  useEffect(() => {
    if (editorRef) {
      editorRef.current = {
        getContent: () => editor.document,
        resetContent: (blocks) => {
          const newContent = blocks?.length ? blocks : [{ type: "paragraph", content: [] }];
          editor.replaceBlocks(editor.document, newContent);
        },
      };
    }
  }, [editor, editorRef]);

  const handleContentChange = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const content = editor.document;
      setSaveStatus("saving");
      onSave?.({ content }).then(() => {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(null), 2000);
      }).catch(() => setSaveStatus(null));
    }, 1000);
  }, [editor, onSave]);

  const executeAiCommand = useCallback(
    async (type, input, commandBlockId) => {
      const noteContext = blocksToText(editor.document);
      let commandBlock;

      if (commandBlockId) {
        commandBlock = editor.getBlock(commandBlockId);
      } else {
        const currentBlock = editor.getTextCursorPosition().block;
        commandBlock = currentBlock;
      }

      if (!commandBlock) return;

      // Mark as executed immediately to prevent double-trigger
      const blockText = commandBlock.content?.map((c) => c.text || "").join("") || "";
      executedCommandsRef.current.set(commandBlock.id, blockText);

      const [loadingBlock] = editor.insertBlocks(
        [
          {
            type: "paragraph",
            content: `⏳ ${t("aiGenerating")}`,
          },
        ],
        commandBlock,
        "after",
      );

      try {
        const res = await fetch("/api/ai/notes-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: type,
            input: input || noteContext,
            noteTitle: titleRef.current,
            noteContext,
            language: localeRef.current?.startsWith("zh") ? "zh" : "en",
          }),
        });

        if (!res.ok) {
          let errMsg = `HTTP ${res.status}`;
          try {
            const errBody = await res.json();
            errMsg = errBody.error || errMsg;
          } catch {}
          throw new Error(errMsg);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          // Strip markdown syntax for display during streaming
          const displayText = accumulated
            .replace(/^#{1,6}\s+/gm, "")
            .replace(/\*\*([^*]+)\*\*/g, "$1")
            .replace(/\*([^*]+)\*/g, "$1")
            .replace(/^[-*+]\s+/gm, "— ");
          try {
            editor.updateBlock(loadingBlock, {
              type: "paragraph",
              content: displayText,
            });
          } catch {
            // Block was deleted by user mid-stream — abort
            reader.cancel();
            return;
          }
        }
        accumulated += decoder.decode(); // flush buffered multi-byte sequences

        // Convert full markdown to proper BlockNote blocks
        if (accumulated.trim()) {
          const parsedBlocks = editor.tryParseMarkdownToBlocks(accumulated);
          if (editor.getBlock(loadingBlock.id)) {
            editor.removeBlocks([loadingBlock]);
          }
          if (parsedBlocks.length > 0 && editor.getBlock(commandBlock.id)) {
            editor.insertBlocks(parsedBlocks, commandBlock, "after");
          }
        } else {
          // Empty response — show error instead of silently removing
          try {
            editor.updateBlock(loadingBlock, {
              type: "paragraph",
              content: `❌ ${t("aiError")}`,
            });
          } catch {
            // Loading block already deleted
          }
        }
      } catch (err) {
        console.error("Inline AI error:", err);
        try {
          editor.updateBlock(loadingBlock, {
            type: "paragraph",
            content: `❌ ${t("aiError")}${err?.message ? ` (${err.message})` : ""}`,
          });
        } catch {
          // Loading block already deleted
        }
      }
    },
    [editor, t],
  );

  // Sync executeAiCommandRef AFTER the declaration to avoid TDZ
  useEffect(() => { executeAiCommandRef.current = executeAiCommand; }, [executeAiCommand]);

  useEffect(() => {
    if (disableAiCommands) return;

    const tiptap = editor._tiptapEditor;
    if (!tiptap) return;

    const pluginKey = new PluginKey("inline-ai-commands");

    const plugin = new Plugin({
      key: pluginKey,
      props: {
        handleKeyDown(view, event) {
          if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
            return false;
          }

          // Don't intercept if suggestion menu is open
          if (editor.getExtension(SuggestionMenu)?.shown()) {
            return false;
          }

          const pos = editor.getTextCursorPosition();
          const block = pos.block;

          // Only intercept paragraph blocks
          if (block.type !== "paragraph") return false;

          // Check selection is collapsed
          const { from, to } = view.state.selection;
          if (from !== to) return false;

          // Read block text
          const blockText = block.content?.map((c) => c.text || "").join("") || "";
          const parsed = parseCommand(blockText);
          if (!parsed) return false;

          // /ask with empty prompt — let Enter pass through
          if (parsed.type === "ask" && !parsed.input) return false;

          // Check consumed tracking
          const prevText = executedCommandsRef.current.get(block.id);
          if (prevText !== undefined && prevText === blockText) return false;

          // Execute the command via ref (avoids stale closure)
          event.preventDefault();
          executeAiCommandRef.current?.(parsed.type, parsed.input, block.id);
          return true;
        },
      },
    });

    // Prepend plugin so it runs BEFORE BlockNote's KeyboardShortcutsExtension
    tiptap.registerPlugin(plugin, (newPlugin, plugins) => [newPlugin, ...plugins]);

    return () => {
      tiptap.unregisterPlugin(pluginKey);
    };
  }, [editor, disableAiCommands]);

  const getSlashMenuItems = useCallback(
    (editorInstance) => {
      const defaultItems = getDefaultReactSlashMenuItems(editorInstance);

      if (disableAiCommands) return defaultItems;

      const aiItems = [
        {
          title: t("askAi"),
          onItemClick: () => {
            const currentBlock = editorInstance.getTextCursorPosition().block;
            const blockText = currentBlock.content?.map((c) => c.text || "").join("") || "";
            if (!blockText.trim()) {
              editorInstance.updateBlock(currentBlock, {
                type: "paragraph",
                content: "/ask ",
              });
              editorInstance.setTextCursorPosition(currentBlock, "end");
            } else {
              const [newBlock] = editorInstance.insertBlocks(
                [{ type: "paragraph", content: "/ask " }],
                currentBlock,
                "after",
              );
              editorInstance.setTextCursorPosition(newBlock, "end");
            }
          },
          subtext: t("askAiSubtext"),
          aliases: ["ask", "ai"],
          group: "AI",
          icon: <Sparkles size={14} strokeWidth={1.5} style={{ color: "var(--accent)" }} />,
        },
        {
          title: t("summarize"),
          onItemClick: () => {
            const currentBlock = editorInstance.getTextCursorPosition().block;
            const blockText = currentBlock.content?.map((c) => c.text || "").join("") || "";
            if (!blockText.trim()) {
              editorInstance.updateBlock(currentBlock, {
                type: "paragraph",
                content: "/summarize",
              });
              executeAiCommand("summarize", "", currentBlock.id);
            } else {
              const [newBlock] = editorInstance.insertBlocks(
                [{ type: "paragraph", content: "/summarize" }],
                currentBlock,
                "after",
              );
              executeAiCommand("summarize", "", newBlock.id);
            }
          },
          subtext: t("summarizeSubtext"),
          aliases: ["summarize", "summary"],
          group: "AI",
          icon: <Sparkles size={14} strokeWidth={1.5} style={{ color: "var(--accent)" }} />,
        },
        {
          title: t("digestLabel"),
          onItemClick: () => {
            const currentBlock = editorInstance.getTextCursorPosition().block;
            const blockText = currentBlock.content?.map((c) => c.text || "").join("") || "";
            if (!blockText.trim()) {
              editorInstance.updateBlock(currentBlock, {
                type: "paragraph",
                content: "/digest",
              });
              executeAiCommand("digest", "", currentBlock.id);
            } else {
              const [newBlock] = editorInstance.insertBlocks(
                [{ type: "paragraph", content: "/digest" }],
                currentBlock,
                "after",
              );
              executeAiCommand("digest", "", newBlock.id);
            }
          },
          subtext: t("digestSubtext"),
          aliases: ["digest"],
          group: "AI",
          icon: <Sparkles size={14} strokeWidth={1.5} style={{ color: "var(--accent)" }} />,
        },
      ];

      return [...defaultItems, ...aiItems];
    },
    [executeAiCommand, t, disableAiCommands],
  );

  const handleTitleChange = useCallback(
    (newTitle) => {
      setTitle(newTitle);
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      titleTimerRef.current = setTimeout(() => {
        setSaveStatus("saving");
        onSave?.({ title: newTitle }).then(() => {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus(null), 2000);
        }).catch(() => setSaveStatus(null));
      }, 1000);
    },
    [onSave],
  );

  useEffect(() => {
    onSaveStatusChange?.(saveStatus);
  }, [saveStatus, onSaveStatusChange]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    };
  }, []);

  return (
    <div className="px-6 pt-6 pb-[30vh]">
      {!hideTitle && (
        <>
          {/* Icon area */}
          <div className="relative" style={{ paddingLeft: "54px" }}>
            {note?.icon ? (
              <button
                onClick={() => setIconPickerOpen((prev) => !prev)}
                className="p-1 rounded-md mb-1 transition-opacity hover:opacity-80"
                style={{ cursor: "pointer" }}
              >
                <NoteIcon icon={note.icon} hasChildren={false} expanded={false} size={32} />
              </button>
            ) : (
              <button
                onClick={() => setIconPickerOpen((prev) => !prev)}
                className="notes-add-icon-hint flex items-center gap-1.5 px-2 py-1 rounded-md mb-1 text-xs"
              >
                <NoteIcon icon={null} hasChildren={false} expanded={false} size={14} fallbackOpacity={0.4} />
                {t("addIcon")}
              </button>
            )}
            {iconPickerOpen && (
              <IconPicker
                currentIcon={note?.icon}
                onSelect={(icon) => {
                  onIconChange?.(icon);
                  setIconPickerOpen(false);
                }}
                onClose={() => setIconPickerOpen(false)}
              />
            )}
          </div>

          <input
            className="notes-title-input mb-4"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder={t("untitled")}
            aria-label="Page title"
          />
        </>
      )}

      <BlockNoteView
        editor={editor}
        theme={theme === "dark" ? "dark" : "light"}
        onChange={handleContentChange}
        slashMenu={false}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(getSlashMenuItems(editor), query)
          }
        />
      </BlockNoteView>
    </div>
  );
}
