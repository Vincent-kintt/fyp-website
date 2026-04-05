"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
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

  const treeProps = {
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
  };

  return (
    <div className="flex h-full">
      {/* Mobile menu button */}
      <button
        className="md:hidden fixed top-[4.5rem] left-4 z-30 p-2 rounded-lg"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={() => setDrawerOpen(true)}
        aria-label={t("openSidebar")}
      >
        <Menu size={16} strokeWidth={1.5} style={{ color: "var(--text-secondary)" }} />
      </button>
      <MobileSidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} {...treeProps} />
      <section className="flex-1 overflow-y-auto" style={{ background: "var(--surface)" }}>
        {children}
      </section>
    </div>
  );
}
