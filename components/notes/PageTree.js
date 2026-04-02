"use client";

import { useTranslations } from "next-intl";
import { FaPlus } from "react-icons/fa";
import { buildTree } from "@/lib/notes/tree";
import PageTreeItem from "./PageTreeItem";

export default function PageTree({
  notes,
  activeNoteId,
  onCreateNote,
  onDeleteNote,
}) {
  const t = useTranslations("notes");
  const tree = buildTree(notes);

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          {t("title")}
        </span>
        <button
          onClick={() => onCreateNote?.()}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--surface-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
          aria-label={t("newPage")}
          title={t("newPage")}
        >
          <FaPlus className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1 px-1">
        {tree.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {t("emptyState")}
            </p>
          </div>
        ) : (
          tree.map((note) => (
            <PageTreeItem
              key={note.id}
              note={note}
              activeNoteId={activeNoteId}
              onCreateSubPage={(parentId) => onCreateNote?.(parentId)}
              onDeleteNote={onDeleteNote}
            />
          ))
        )}
      </div>
    </div>
  );
}
