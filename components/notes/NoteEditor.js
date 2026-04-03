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
import { FaMagic } from "react-icons/fa";

export default function NoteEditor({ note, onSave }) {
  const t = useTranslations("notes");
  const { theme } = useTheme();
  const [title, setTitle] = useState(note?.title || "");
  const [saveStatus, setSaveStatus] = useState(null);
  const saveTimerRef = useRef(null);
  const titleTimerRef = useRef(null);
  const pendingAskRef = useRef(null);

  useEffect(() => {
    setTitle(note?.title || "");
    setSaveStatus(null);
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useCreateBlockNote({
    initialContent: note?.content?.length > 0 ? note.content : undefined,
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
          icon: <FaMagic style={{ color: "var(--accent)" }} />,
        },
        {
          title: t("summarize"),
          onItemClick: () => {
            executeAiCommand("summarize", "");
          },
          subtext: t("summarizeSubtext"),
          aliases: ["summarize", "summary"],
          group: "AI",
          icon: <FaMagic style={{ color: "var(--accent)" }} />,
        },
        {
          title: t("digestLabel"),
          onItemClick: () => {
            executeAiCommand("digest", "");
          },
          subtext: t("digestSubtext"),
          aliases: ["digest", "overview"],
          group: "AI",
          icon: <FaMagic style={{ color: "var(--accent)" }} />,
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
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    };
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-16 pt-12 pb-24" onKeyDown={handleEditorKeyDown}>
      <div className="flex justify-end mb-2 h-5">
        {saveStatus && (
          <span className="notes-save-status">
            {saveStatus === "saving" ? t("saving") : t("autoSaved")}
          </span>
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
