"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import NotesLayout from "@/components/notes/NotesLayout";
import NoteEditor from "@/components/notes/NoteEditor";
import NoteTopBar from "@/components/notes/NoteTopBar";
import { findAncestors } from "@/lib/notes/tree";
import useNotes from "@/hooks/useNotes";

export default function NotePage() {
  const { noteId } = useParams();
  const router = useRouter();
  const t = useTranslations("notes");
  const locale = useLocale();

  const {
    notes,
    trashedNotes,
    createNote,
    deleteNote,
    reorderNotes,
    renameNote,
    duplicateNote,
    restoreNote,
    permanentDeleteNote,
  } = useNotes();

  const [currentNote, setCurrentNote] = useState(null);
  const [editorSaveStatus, setEditorSaveStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentNote = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes/${noteId}`);
      const data = await res.json();
      if (data.success) {
        setCurrentNote(data.data);
      } else {
        router.replace("/notes");
      }
    } catch {
      router.replace("/notes");
    } finally {
      setLoading(false);
    }
  }, [noteId, router]);

  useEffect(() => {
    fetchCurrentNote();
  }, [fetchCurrentNote]);

  const handleSave = useCallback(
    async (updates) => {
      try {
        const res = await fetch(`/api/notes/${noteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (!data.success) throw new Error("Save failed");
        if (updates.title) {
          setCurrentNote((prev) =>
            prev ? { ...prev, title: updates.title } : prev,
          );
        }
      } catch (err) {
        toast.error(t("saveFailed"));
        throw err;
      }
    },
    [noteId, t],
  );

  const handleIconChange = useCallback(
    async (icon) => {
      try {
        const res = await fetch(`/api/notes/${noteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ icon }),
        });
        const data = await res.json();
        if (data.success) {
          setCurrentNote((prev) => (prev ? { ...prev, icon } : prev));
        }
      } catch {
        toast.error(t("saveFailed"));
      }
    },
    [noteId, t],
  );

  const handleDeleteNote = useCallback(
    async (id) => {
      await deleteNote(id);
      if (id === noteId) router.replace("/notes");
    },
    [deleteNote, noteId, router],
  );

  const ancestors = currentNote
    ? findAncestors(notes, currentNote.id)
        .reverse()
        .map((id) => notes.find((n) => n.id === id))
        .filter(Boolean)
    : [];

  if (loading) {
    return (
      <div className="flex h-full">
        <section className="flex-1 overflow-hidden" style={{ background: "var(--surface)" }}>
          <div
            className="flex items-center justify-between px-3"
            style={{ minHeight: 40, borderBottom: "1px solid var(--border)" }}
          >
            <div className="skeleton-line h-3 w-24" />
            <div className="skeleton-line h-3 w-16" />
          </div>
          <div className="mx-auto px-6 md:px-16 pt-6" style={{ maxWidth: 900 }}>
            <div style={{ paddingLeft: 54 }}>
              <div className="skeleton-line w-8 h-8 rounded-lg mb-2" />
            </div>
            <div className="skeleton-line h-10 w-56 mb-6" style={{ borderRadius: 6 }} />
            <div className="space-y-3" style={{ paddingLeft: 54 }}>
              <div className="skeleton-line h-4 w-full" />
              <div className="skeleton-line h-4 w-5/6" />
              <div className="skeleton-line h-4 w-3/5" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <NotesLayout
      notes={notes}
      activeNoteId={noteId}
      onCreateNote={createNote}
      onDeleteNote={handleDeleteNote}
      onReorder={reorderNotes}
      onRename={renameNote}
      onDuplicate={duplicateNote}
      trashedNotes={trashedNotes}
      onRestore={restoreNote}
      onPermanentDelete={permanentDeleteNote}
    >
      {currentNote && (
        <>
          <NoteTopBar
            note={currentNote}
            ancestors={ancestors}
            saveStatus={editorSaveStatus}
            locale={locale}
            onRename={() => {
              const newTitle = prompt(t("rename"), currentNote.title);
              if (newTitle?.trim()) renameNote(currentNote.id, newTitle.trim());
            }}
            onDuplicate={() => duplicateNote(currentNote.id)}
            onDelete={() => handleDeleteNote(currentNote.id)}
          />
          <NoteEditor
            key={currentNote.id}
            note={currentNote}
            onSave={handleSave}
            onSaveStatusChange={setEditorSaveStatus}
            onIconChange={handleIconChange}
          />
        </>
      )}
    </NotesLayout>
  );
}
