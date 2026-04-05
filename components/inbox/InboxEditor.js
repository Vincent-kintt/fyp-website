"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { BlockNoteView } from "@blocknote/mantine";
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { filterSuggestionItems } from "@blocknote/core";
import { en as bnEn } from "@blocknote/core/locales";
import "@blocknote/mantine/style.css";
import { Sparkles } from "lucide-react";
import TaskItem from "@/components/tasks/TaskItem";

export default function InboxEditor({ tasks, onToggleComplete, onDelete, onEdit }) {
  const t = useTranslations("inbox");
  const tNotes = useTranslations("notes");
  const locale = useLocale();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null);
  const saveTimerRef = useRef(null);

  const editor = useCreateBlockNote({
    dictionary: {
      ...bnEn,
      placeholders: {
        ...bnEn.placeholders,
        default: t("editorPlaceholder"),
      },
    },
  });

  // Fetch capture document on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/inbox/capture");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.data.content?.length > 0) {
          editor.replaceBlocks(editor.document, data.data.content);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleContentChange = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const content = editor.document;
      setSaveStatus("saving");
      try {
        await fetch("/api/inbox/capture", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(null), 2000);
      } catch {
        setSaveStatus(null);
      }
    }, 1000);
  }, [editor]);

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
              { type: "text", text: "Generating...", styles: { italic: true } },
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
            noteTitle: "Inbox",
            noteContext,
            language: locale?.startsWith("zh") ? "zh" : "en",
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
              text: "Failed to get AI response.",
              styles: { italic: true },
            },
          ],
        });
      }
    },
    [editor, locale],
  );

  const getSlashMenuItems = useCallback(
    (editorInstance) => {
      const defaultItems = getDefaultReactSlashMenuItems(editorInstance);
      const aiItems = [
        {
          title: tNotes("askAi"),
          onItemClick: () => executeAiCommand("ask", ""),
          subtext: tNotes("askAiSubtext"),
          aliases: ["ask", "ai"],
          group: "AI",
          icon: (
            <Sparkles
              size={14}
              strokeWidth={1.5}
              style={{ color: "var(--accent)" }}
            />
          ),
        },
        {
          title: tNotes("summarize"),
          onItemClick: () => executeAiCommand("summarize", ""),
          subtext: tNotes("summarizeSubtext"),
          aliases: ["summarize", "summary"],
          group: "AI",
          icon: (
            <Sparkles
              size={14}
              strokeWidth={1.5}
              style={{ color: "var(--accent)" }}
            />
          ),
        },
        {
          title: tNotes("digestLabel"),
          onItemClick: () => executeAiCommand("digest", ""),
          subtext: tNotes("digestSubtext"),
          aliases: ["digest"],
          group: "AI",
          icon: (
            <Sparkles
              size={14}
              strokeWidth={1.5}
              style={{ color: "var(--accent)" }}
            />
          ),
        },
      ];
      return [...defaultItems, ...aiItems];
    },
    [executeAiCommand, tNotes],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <div
          className="h-40 rounded-lg animate-pulse"
          style={{ backgroundColor: "var(--surface-hover)" }}
        />
      </div>
    );
  }

  return (
    <div>
      {saveStatus && (
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            {saveStatus === "saving" ? t("saving") : t("saved")}
          </span>
        </div>
      )}

      <div
        className="rounded-xl mb-6"
        style={{
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--card-border)",
          minHeight: "200px",
        }}
      >
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

      {tasks.length > 0 && (
        <>
          <div
            className="text-[11px] font-semibold mb-2 px-1"
            style={{ color: "var(--text-muted)" }}
          >
            {t("capturedTasks")}{" "}
            <span className="font-normal">{tasks.length}</span>
          </div>
          <div className="space-y-0.5">
            {tasks.map((task) => (
              <TaskItem
                key={task._id || task.id}
                task={task}
                onToggleComplete={onToggleComplete}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
