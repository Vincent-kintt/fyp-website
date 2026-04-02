"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import "@blocknote/mantine/style.css";
import { parseCommand } from "@/lib/notes/commands";
import CommandBlock from "./CommandBlock";
import ResponseBlock from "./ResponseBlock";

export default function NoteEditor({ note, onSave }) {
  const t = useTranslations("notes");
  const { theme } = useTheme();
  const [title, setTitle] = useState(note?.title || "");
  const [saveStatus, setSaveStatus] = useState(null);
  const [commandInput, setCommandInput] = useState("");
  const [aiResponses, setAiResponses] = useState([]);
  const saveTimerRef = useRef(null);
  const titleTimerRef = useRef(null);

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
      });
    }, 1000);
  }, [editor, onSave]);

  const handleCommand = useCallback(async () => {
    const parsed = parseCommand(commandInput);
    if (!parsed) return;

    const responseId = Date.now().toString();
    setAiResponses((prev) => [
      ...prev,
      { id: responseId, ...parsed, content: "", loading: true },
    ]);
    setCommandInput("");

    try {
      const blocks = editor.document;
      const noteContext = blocks
        .map((b) => b.content?.map((c) => c.text || "").join("") || "")
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/ai/notes-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: parsed.type,
          input: parsed.input || noteContext,
          noteTitle: title,
          noteContext,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setAiResponses((prev) =>
          prev.map((r) =>
            r.id === responseId ? { ...r, content: accumulated } : r,
          ),
        );
      }

      setAiResponses((prev) =>
        prev.map((r) =>
          r.id === responseId ? { ...r, loading: false } : r,
        ),
      );
    } catch {
      setAiResponses((prev) =>
        prev.map((r) =>
          r.id === responseId
            ? { ...r, content: "Error: Failed to get AI response.", loading: false }
            : r,
        ),
      );
    }
  }, [commandInput, editor, title]);

  const handleTitleChange = useCallback(
    (newTitle) => {
      setTitle(newTitle);
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      titleTimerRef.current = setTimeout(() => {
        setSaveStatus("saving");
        onSave?.({ title: newTitle }).then(() => {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus(null), 2000);
        });
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
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
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
      />

      {aiResponses.map((r) => (
        <div key={r.id} className="mt-4">
          <CommandBlock command={r.type} input={r.input} />
          <ResponseBlock content={r.content} loading={r.loading} />
        </div>
      ))}

      <div className="mt-6 flex gap-2">
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && commandInput.startsWith("/")) {
              e.preventDefault();
              handleCommand();
            }
          }}
          placeholder="/ask, /summarize, /digest..."
          className="flex-1 px-3 py-2 rounded-lg text-sm"
          style={{
            background: "var(--input-bg)",
            border: "1px solid var(--input-border)",
            color: "var(--text-primary)",
          }}
        />
      </div>
    </div>
  );
}
