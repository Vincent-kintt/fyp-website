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
  const [trashedNotes, setTrashedNotes] = useState([]);

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

  const fetchTrashedNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/notes/trash");
      const data = await res.json();
      if (data.success) setTrashedNotes(data.data);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchNotes();
    fetchCurrentNote();
    fetchTrashedNotes();
  }, [fetchNotes, fetchCurrentNote, fetchTrashedNotes]);

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
          setCurrentNote((prev) =>
            prev ? { ...prev, title: updates.title } : prev,
          );
        }
      } catch {
        toast.error(t("saveFailed"));
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
          setNotes((prev) =>
            prev.map((n) => (n.id === noteId ? { ...n, icon } : n)),
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
          await fetchTrashedNotes();
          if (id === noteId) router.replace("/notes");
        }
      } catch {
        toast.error(t("deleteFailed"));
      }
    },
    [fetchNotes, fetchTrashedNotes, noteId, router, t],
  );

  const handleRestore = useCallback(
    async (id) => {
      try {
        const res = await fetch(`/api/notes/${id}/restore`, { method: "POST" });
        const data = await res.json();
        if (data.success) {
          await fetchNotes();
          await fetchTrashedNotes();
        }
      } catch {
        toast.error(t("saveFailed"));
      }
    },
    [fetchNotes, fetchTrashedNotes, t],
  );

  const handlePermanentDelete = useCallback(
    async (id) => {
      try {
        const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          await fetchTrashedNotes();
        }
      } catch {
        toast.error(t("deleteFailed"));
      }
    },
    [fetchTrashedNotes, t],
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
      <div className="flex h-full">
        <aside
          className="hidden md:flex flex-col"
          style={{
            width: 240,
            minWidth: 240,
            boxShadow: "1px 0 0 0 var(--border)",
            background: "var(--background-secondary)",
          }}
        >
          <div className="px-3 pt-3 pb-2">
            <div className="skeleton-line h-3 w-12" />
          </div>
          <div className="px-2 space-y-0.5">
            {[24, 32, 20, 28].map((w, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                <div className="skeleton-line w-4 h-4 rounded" />
                <div className="skeleton-line h-3" style={{ width: `${w * 4}px` }} />
              </div>
            ))}
          </div>
        </aside>
        <main className="flex-1 overflow-hidden" style={{ background: "var(--surface)" }}>
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
        </main>
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
      trashedNotes={trashedNotes}
      onRestore={handleRestore}
      onPermanentDelete={handlePermanentDelete}
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
            onIconChange={handleIconChange}
          />
        </>
      )}
    </NotesLayout>
  );
}
