"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { BlockNoteView } from "@blocknote/mantine";
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { filterSuggestionItems } from "@blocknote/core";
import "@blocknote/mantine/style.css";
import { Sparkles } from "lucide-react";
import NoteIcon from "./NoteIcon";
import IconPicker from "./IconPicker";

export default function NoteEditor({ note, onSave, onSaveStatusChange, onIconChange }) {
  const t = useTranslations("notes");
  const { theme } = useTheme();
  const [title, setTitle] = useState(note?.title || "");
  const [saveStatus, setSaveStatus] = useState(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const saveTimerRef = useRef(null);
  const titleTimerRef = useRef(null);
  const pendingAskRef = useRef(null);

  useEffect(() => {
    setTitle(note?.title || "");
    setSaveStatus(null);
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useCreateBlockNote({
    initialContent: note?.content?.length > 0 ? note.content : undefined,
    dictionary: {
      placeholders: {
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
    async (type, input, afterBlockId) => {
      const blocks = editor.document;
      const noteContext = blocks
        .map((b) => b.content?.map((c) => c.text || "").join("") || "")
        .filter(Boolean)
        .join("\n");

      let commandBlock;
      if (afterBlockId) {
        commandBlock = editor.getBlock(afterBlockId);
      } else {
        const currentBlock = editor.getTextCursorPosition().block;
        const commandText = `/${type}${input ? " " + input : ""}`;
        [commandBlock] = editor.insertBlocks(
          [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: commandText,
                  styles: { italic: true, textColor: "purple" },
                },
              ],
            },
          ],
          currentBlock,
          "after",
        );
      }

      const [loadingBlock] = editor.insertBlocks(
        [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "⏳ Generating...",
                styles: { italic: true },
              },
            ],
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
            noteTitle: title,
            noteContext,
          }),
        });

        if (!res.ok) throw new Error("AI request failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          editor.updateBlock(loadingBlock, {
            type: "paragraph",
            content: [
              { type: "text", text: accumulated, styles: { italic: true } },
            ],
          });
        }

        const parsedBlocks = await editor.tryParseMarkdownToBlocks(accumulated);
        editor.removeBlocks([loadingBlock]);

        if (parsedBlocks.length > 0) {
          editor.insertBlocks(parsedBlocks, commandBlock, "after");
        }
      } catch {
        editor.updateBlock(loadingBlock, {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "❌ Failed to get AI response.",
              styles: { italic: true },
            },
          ],
        });
      }
    },
    [editor, title],
  );

  const getSlashMenuItems = useCallback(
    (editorInstance) => {
      const defaultItems = getDefaultReactSlashMenuItems(editorInstance);

      const aiItems = [
        {
          title: t("askAi"),
          onItemClick: () => {
            const currentBlock = editorInstance.getTextCursorPosition().block;
            const [promptBlock] = editorInstance.insertBlocks(
              [{ type: "paragraph", content: [] }],
              currentBlock,
              "after",
            );
            editorInstance.setTextCursorPosition(promptBlock, "end");
            pendingAskRef.current = promptBlock.id;
          },
          subtext: t("askAiSubtext"),
          aliases: ["ask", "ai", "question"],
          group: "AI",
          icon: <Sparkles size={14} strokeWidth={1.5} style={{ color: "var(--accent)" }} />,
        },
        {
          title: t("summarize"),
          onItemClick: () => {
            executeAiCommand("summarize", "");
          },
          subtext: t("summarizeSubtext"),
          aliases: ["summarize", "summary"],
          group: "AI",
          icon: <Sparkles size={14} strokeWidth={1.5} style={{ color: "var(--accent)" }} />,
        },
        {
          title: t("digestLabel"),
          onItemClick: () => {
            executeAiCommand("digest", "");
          },
          subtext: t("digestSubtext"),
          aliases: ["digest", "overview"],
          group: "AI",
          icon: <Sparkles size={14} strokeWidth={1.5} style={{ color: "var(--accent)" }} />,
        },
      ];

      return [...defaultItems, ...aiItems];
    },
    [executeAiCommand, t],
  );

  const handleEditorKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey && pendingAskRef.current) {
        const blockId = pendingAskRef.current;
        const block = editor.getBlock(blockId);
        if (!block) {
          pendingAskRef.current = null;
          return;
        }
        const question = block.content
          ?.map((c) => c.text || "")
          .join("")
          .trim();
        if (!question) return;

        e.preventDefault();
        pendingAskRef.current = null;

        editor.updateBlock(blockId, {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: `/ask ${question}`,
              styles: { italic: true, textColor: "purple" },
            },
          ],
        });

        executeAiCommand("ask", question, blockId);
      }
    },
    [editor, executeAiCommand],
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
    <div
      className="mx-auto px-6 md:px-16 pt-6 pb-[30vh]"
      style={{ maxWidth: "900px" }}
      onKeyDown={handleEditorKeyDown}
    >
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
