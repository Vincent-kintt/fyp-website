"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote, SuggestionMenuController } from "@blocknote/react";
import { filterSuggestionItems } from "@blocknote/core";
import { en as bnEn } from "@blocknote/core/locales";
import { parseCommand } from "@/lib/notes/commands.js";
import { TOOL_PROGRESS_LABELS } from "@/lib/notes/toolProgressLabels.js";
import { noteEditorSchema } from "@/components/notes/editor/schema";
import MentionMenu from "@/components/notes/editor/menus/MentionMenu";
import { getSlashMenuItems as buildSlashMenuItems } from "@/components/notes/editor/menus/getSlashMenuItems";
import { getMentionItems as buildMentionItems } from "@/components/notes/editor/menus/getMentionItems";
import { createSafeUnnestPlugin } from "@/components/notes/editor/plugins/safeUnnestPlugin.js";
import { createInlineAiCommandPlugin } from "@/components/notes/editor/plugins/inlineAiCommandPlugin.js";
import { useInlineAiCommand } from "@/components/notes/editor/commands/useInlineAiCommand.js";
import { useAgentCommand } from "@/components/notes/editor/commands/useAgentCommand.js";
import { useRssCommand } from "@/components/notes/editor/commands/useRssCommand.js";
import "@blocknote/mantine/style.css";
import NoteHeader from "./NoteHeader";
import RSSOnboardingModal from "./RSSOnboardingModal";


export default function NoteEditor({ note, onSave, onSaveStatusChange, onIconChange, hideTitle, editorRef, disableAiCommands, notes }) {
  const t = useTranslations("notes");
  const locale = useLocale();
  const { theme } = useTheme();
  const [title, setTitle] = useState(note?.title || "");
  const [saveStatus, setSaveStatus] = useState(null);
  const [rssModalOpen, setRssModalOpen] = useState(false);
  const rssModalCallbackRef = useRef(null);
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
    schema: noteEditorSchema,
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
    }
    // Empty content — skip replaceBlocks so BlockNote keeps its default empty state with placeholder
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

  const executeAgentCommand = useAgentCommand({
    editor,
    titleRef,
    localeRef,
    t,
    executedCommandsRef,
    toolProgressLabels: TOOL_PROGRESS_LABELS,
  });

  const executeRSSCommand = useRssCommand({
    editor,
    localeRef,
    t,
    executedCommandsRef,
    toolProgressLabels: TOOL_PROGRESS_LABELS,
    onNeedOnboarding: useCallback((subscribeAndRetry) => {
      rssModalCallbackRef.current = subscribeAndRetry;
      setRssModalOpen(true);
    }, []),
  });

  const executeInlineAiCommand = useInlineAiCommand({
    editor,
    titleRef,
    localeRef,
    t,
    executedCommandsRef,
  });

  const executeAiCommand = useCallback(
    async (type, input, commandBlockId) => {
      if (type === "agent") return executeAgentCommand(input, commandBlockId);
      if (type === "rss") return executeRSSCommand(commandBlockId);
      return executeInlineAiCommand(type, input, commandBlockId);
    },
    [executeAgentCommand, executeRSSCommand, executeInlineAiCommand],
  );

  // Sync executeAiCommandRef AFTER the declaration to avoid TDZ
  useEffect(() => { executeAiCommandRef.current = executeAiCommand; }, [executeAiCommand]);

  useEffect(() => {
    if (disableAiCommands) return;

    const created = createInlineAiCommandPlugin({
      editor,
      executedCommandsRef,
      executeRef: executeAiCommandRef,
    });
    if (!created) return;

    const tiptap = editor._tiptapEditor;
    const { plugin, pluginKey } = created;
    // Prepend plugin so it runs BEFORE BlockNote's KeyboardShortcutsExtension
    tiptap.registerPlugin(plugin, (newPlugin, plugins) => [newPlugin, ...plugins]);
    return () => tiptap.unregisterPlugin(pluginKey);
  }, [editor, disableAiCommands]);

  // Workaround for BlockNote#1338 — see safeUnnestPlugin.js for upstream link
  // and private-API documentation.
  useEffect(() => {
    const created = createSafeUnnestPlugin(editor);
    if (!created) return;

    const tiptap = editor._tiptapEditor;
    const { plugin, pluginKey } = created;
    tiptap.registerPlugin(plugin, (newPlugin, plugins) => [newPlugin, ...plugins]);
    return () => tiptap.unregisterPlugin(pluginKey);
  }, [editor]);

  const getSlashMenuItems = useCallback(
    (editorInstance) =>
      buildSlashMenuItems({ editorInstance, t, executeAiCommand, disableAiCommands }),
    [t, executeAiCommand, disableAiCommands],
  );

  const getMentionItems = useCallback(
    (editorInstance) => buildMentionItems({ notes, t, editorInstance }),
    [notes, t],
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
        <NoteHeader
          note={note}
          title={title}
          onTitleChange={handleTitleChange}
          onIconChange={onIconChange}
          t={t}
        />
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
        {notes && notes.length > 0 && (
          <SuggestionMenuController
            triggerCharacter="@"
            suggestionMenuComponent={MentionMenu}
            getItems={async (query) =>
              filterSuggestionItems(getMentionItems(editor), query)
            }
          />
        )}
      </BlockNoteView>

      <RSSOnboardingModal
        open={rssModalOpen}
        onClose={() => setRssModalOpen(false)}
        onConfirm={async (categories) => {
          await rssModalCallbackRef.current?.(categories);
        }}
      />
    </div>
  );
}
