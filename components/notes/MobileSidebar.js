"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import PageTree from "./PageTree";

export default function MobileSidebar({
  open,
  onClose,
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
}) {
  const t = useTranslations("notes");

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && activeNoteId) onClose();
  }, [activeNoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <>
      <div
        className="notes-drawer-backdrop md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="notes-drawer-enter fixed top-16 left-0 bottom-0 w-[280px] z-50 flex flex-col md:hidden"
        style={{
          background: "var(--background-secondary)",
        }}
        role="dialog"
        aria-label={t("pageTree")}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <span
            className="text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {t("title")}
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-lg"
            style={{ color: "var(--text-muted)" }}
            aria-label={t("closeSidebar")}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
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
        </div>
      </aside>
    </>
  );
}
