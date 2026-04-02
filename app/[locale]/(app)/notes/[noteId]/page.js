"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import NotesLayout from "@/components/notes/NotesLayout";
import NoteEditor from "@/components/notes/NoteEditor";

export default function NotePage() {
  const { noteId } = useParams();
  const router = useRouter();
  const t = useTranslations("notes");
  const [notes, setNotes] = useState([]);
  const [currentNote, setCurrentNote] = useState(null);
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
    >
      {currentNote && (
        <NoteEditor key={currentNote.id} note={currentNote} onSave={handleSave} />
      )}
    </NotesLayout>
  );
}
