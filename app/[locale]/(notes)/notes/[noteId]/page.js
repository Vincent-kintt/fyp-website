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
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PromptDialog from "@/components/ui/PromptDialog";
import { findAncestors } from "@/lib/notes/tree";
import useNotes from "@/hooks/useNotes";
import { useNote } from "@/hooks/useNote";
import { useUpdateNote } from "@/hooks/useUpdateNote";

export default function NotePage() {
  const { noteId } = useParams();
  const router = useRouter();
  const t = useTranslations("notes");
  const tc = useTranslations("common");
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

  const {
    data: currentNote,
    isLoading: loading,
    error: noteError,
  } = useNote({ id: noteId });

  const updateNoteMutation = useUpdateNote();

  const [editorSaveStatus, setEditorSaveStatus] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);

  // Preserve the prior UX: a missing or unreadable note bounces back to
  // the notes index. useNote rejects on !res.ok and { success: false }.
  useEffect(() => {
    if (noteError) router.replace("/notes");
  }, [noteError, router]);

  const handleSave = useCallback(
    async (updates) => {
      try {
        await updateNoteMutation.mutateAsync({ id: noteId, ...updates });
      } catch (err) {
        toast.error(t("saveFailed"));
        throw err;
      }
    },
    [noteId, t, updateNoteMutation],
  );

  const handleIconChange = useCallback(
    async (icon) => {
      try {
        await updateNoteMutation.mutateAsync({ id: noteId, icon });
      } catch {
        toast.error(t("saveFailed"));
      }
    },
    [noteId, t, updateNoteMutation],
  );

  const handleDeleteNote = useCallback((id) => {
    setDeleteTargetId(id);
    setShowDeleteDialog(true);
  }, []);

  const confirmDeleteNote = useCallback(async () => {
    if (!deleteTargetId) return;
    const success = await deleteNote(deleteTargetId);
    if (success && deleteTargetId === noteId) {
      router.replace("/notes");
    }
  }, [deleteNote, deleteTargetId, noteId, router]);

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
          <div className="px-6 pt-6">
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
            onRename={() => setShowRenameDialog(true)}
            onDuplicate={() => duplicateNote(currentNote.id)}
            onDelete={() => handleDeleteNote(currentNote.id)}
          />
          <NoteEditor
            key={currentNote.id}
            note={currentNote}
            onSave={handleSave}
            onSaveStatusChange={setEditorSaveStatus}
            onIconChange={handleIconChange}
            notes={notes}
          />
        </>
      )}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDeleteNote}
        title={t("confirmDeleteTitle")}
        message={t("confirmDelete")}
        confirmLabel={t("delete")}
        cancelLabel={tc("cancel")}
        variant="danger"
      />
      {currentNote && (
        <PromptDialog
          open={showRenameDialog}
          onClose={() => setShowRenameDialog(false)}
          onSubmit={(newTitle) => renameNote(currentNote.id, newTitle)}
          title={t("renameTitle")}
          defaultValue={currentNote.title}
          placeholder={t("untitled")}
          cancelLabel={tc("cancel")}
          confirmLabel={tc("confirm")}
        />
      )}
    </NotesLayout>
  );
}
