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

export default function NotePage() {
  const { noteId } = useParams();
  const router = useRouter();
  const t = useTranslations("notes");
  const locale = useLocale();
  const [notes, setNotes] = useState([]);
  const [currentNote, setCurrentNote] = useState(null);
  const [editorSaveStatus, setEditorSaveStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/notes");
      const data = await res.json();
      if (data.success) setNotes(data.data);
    } catch {
      /* silent */
    }
  }, []);

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
    fetchNotes();
    fetchCurrentNote();
  }, [fetchNotes, fetchCurrentNote]);

  const handleSave = useCallback(
    async (updates) => {
      try {
        const res = await fetch(`/api/notes/${noteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (data.success && updates.title) {
          setNotes((prev) =>
            prev.map((n) =>
              n.id === noteId ? { ...n, title: updates.title } : n,
            ),
          );
        }
      } catch {
        toast.error(t("saveFailed"));
      }
    },
    [noteId, t],
  );

  const handleCreateNote = useCallback(
    async (parentId) => {
      try {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: t("untitled"),
            parentId: parentId || null,
          }),
        });
        const data = await res.json();
        if (data.success) {
          await fetchNotes();
          router.push(`/notes/${data.data.id}`);
        }
      } catch {
        toast.error(t("saveFailed"));
      }
    },
    [fetchNotes, router, t],
  );

  const handleDeleteNote = useCallback(
    async (id) => {
      if (!confirm(t("confirmDelete"))) return;
      try {
        const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          await fetchNotes();
          if (id === noteId) router.replace("/notes");
        }
      } catch {
        toast.error(t("deleteFailed"));
      }
    },
    [fetchNotes, noteId, router, t],
  );

  const handleReorder = useCallback(
    async (updates) => {
      try {
        await fetch("/api/notes/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        });
        await fetchNotes();
      } catch {
        toast.error(t("saveFailed"));
      }
    },
    [fetchNotes, t],
  );

  const handleRename = useCallback(
    async (id, newTitle) => {
      try {
        const res = await fetch(`/api/notes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });
        const data = await res.json();
        if (data.success) {
          setNotes((prev) =>
            prev.map((n) => (n.id === id ? { ...n, title: newTitle } : n)),
          );
          if (id === noteId) {
            setCurrentNote((prev) => (prev ? { ...prev, title: newTitle } : prev));
          }
        }
      } catch {
        toast.error(t("saveFailed"));
      }
    },
    [noteId, t],
  );

  const handleDuplicate = useCallback(
    async (id) => {
      try {
        const sourceNote = notes.find((n) => n.id === id);
        if (!sourceNote) return;
        const getRes = await fetch(`/api/notes/${id}`);
        const getData = await getRes.json();
        if (!getData.success) return;

        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${getData.data.title} (copy)`,
            parentId: getData.data.parentId,
          }),
        });
        const data = await res.json();
        if (data.success) {
          await fetch(`/api/notes/${data.data.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: getData.data.content }),
          });
          await fetchNotes();
          router.push(`/notes/${data.data.id}`);
        }
      } catch {
        toast.error(t("saveFailed"));
      }
    },
    [notes, fetchNotes, router, t],
  );

  const ancestors = currentNote
    ? findAncestors(notes, currentNote.id)
        .reverse()
        .map((id) => notes.find((n) => n.id === id))
        .filter(Boolean)
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="skeleton-line w-48 h-6" />
      </div>
    );
  }

  return (
    <NotesLayout
      notes={notes}
      activeNoteId={noteId}
      onCreateNote={handleCreateNote}
      onDeleteNote={handleDeleteNote}
      onReorder={handleReorder}
      onRename={handleRename}
      onDuplicate={handleDuplicate}
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
              if (newTitle?.trim()) handleRename(currentNote.id, newTitle.trim());
            }}
            onDuplicate={() => handleDuplicate(currentNote.id)}
            onDelete={() => handleDeleteNote(currentNote.id)}
          />
          <NoteEditor
            key={currentNote.id}
            note={currentNote}
            onSave={handleSave}
            onSaveStatusChange={setEditorSaveStatus}
          />
        </>
      )}
    </NotesLayout>
  );
}
