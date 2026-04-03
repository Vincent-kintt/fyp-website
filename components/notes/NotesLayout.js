"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import PageTree from "./PageTree";
import MobileSidebar from "./MobileSidebar";

export default function NotesLayout({
  notes,
  activeNoteId,
  onCreateNote,
  onDeleteNote,
  onReorder,
  onRename,
  onDuplicate,
  trashedNotes,
  onRestore,
  onPermanentDelete,
  children,
}) {
  const t = useTranslations("notes");
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-full">
      <aside className="notes-sidebar hidden md:flex flex-col" style={{ boxShadow: "1px 0 0 0 var(--border)" }}>
        <PageTree
          notes={notes}
          activeNoteId={activeNoteId}
          onCreateNote={onCreateNote}
          onDeleteNote={onDeleteNote}
          onReorder={onReorder}
          onRename={onRename}
          onDuplicate={onDuplicate}
          trashedNotes={trashedNotes}
          onRestore={onRestore}
          onPermanentDelete={onPermanentDelete}
        />
      </aside>

      <button
        className="md:hidden fixed top-[4.5rem] left-4 z-30 p-2 rounded-lg"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
        onClick={() => setDrawerOpen(true)}
        aria-label={t("openSidebar")}
      >
        <Menu size={16} strokeWidth={1.5} style={{ color: "var(--text-secondary)" }} />
      </button>

      <MobileSidebar
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        notes={notes}
        activeNoteId={activeNoteId}
        onCreateNote={onCreateNote}
        onDeleteNote={onDeleteNote}
        onReorder={onReorder}
        onRename={onRename}
        onDuplicate={onDuplicate}
        trashedNotes={trashedNotes}
        onRestore={onRestore}
        onPermanentDelete={onPermanentDelete}
      />

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
