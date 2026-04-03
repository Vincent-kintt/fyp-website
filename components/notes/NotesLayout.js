"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FaBars } from "react-icons/fa";
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
  children,
}) {
  const t = useTranslations("notes");
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-full">
      <aside className="notes-sidebar hidden md:flex flex-col">
        <PageTree
          notes={notes}
          activeNoteId={activeNoteId}
          onCreateNote={onCreateNote}
          onDeleteNote={onDeleteNote}
          onReorder={onReorder}
          onRename={onRename}
          onDuplicate={onDuplicate}
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
        <FaBars className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
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
      />

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
