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
import NoteIcon from "./NoteIcon";
import IconPicker from "./IconPicker";

export default function NoteEditor({ note, onSave, onSaveStatusChange, onIconChange, hideTitle, editorRef }) {
  const t = useTranslations("notes");
  const locale = useLocale();
  const { theme } = useTheme();
  const [title, setTitle] = useState(note?.title || "");
  const [saveStatus, setSaveStatus] = useState(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const saveTimerRef = useRef(null);
  const titleTimerRef = useRef(null);

  useEffect(() => {
    setTitle(note?.title || "");
    setSaveStatus(null);
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        _editor: editor,
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

  const getSlashMenuItems = useCallback(
    (editorInstance) => {
      return getDefaultReactSlashMenuItems(editorInstance);
    },
    [],
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
