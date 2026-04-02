"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FaChevronRight, FaEllipsisH, FaPlus, FaTrash } from "react-icons/fa";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useClickOutside } from "@/hooks/useClickOutside";

export default function PageTreeItem({
  note,
  depth = 0,
  activeNoteId,
  onCreateSubPage,
  onDeleteNote,
}) {
  const t = useTranslations("notes");
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useClickOutside(() => setMenuOpen(false));

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: note.id });
  const sortableStyle = { transform: CSS.Transform.toString(transform), transition };

  const hasChildren = note.children && note.children.length > 0;
  const isActive = note.id === activeNoteId;

  return (
    <div ref={setNodeRef} style={sortableStyle} {...attributes}>
      <div
        className="notes-tree-item group"
        style={{ paddingLeft: `${8 + depth * 20}px` }}
        data-active={isActive}
        data-dragging={isDragging}
        {...listeners}
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            setExpanded((prev) => !prev);
          }}
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded"
          style={{
            color: "var(--text-muted)",
            visibility: hasChildren ? "visible" : "hidden",
          }}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <FaChevronRight
            className="w-2.5 h-2.5 transition-transform"
            style={{ transform: expanded ? "rotate(90deg)" : "none" }}
          />
        </button>

        <span className="flex-shrink-0 text-sm">{note.icon || "📄"}</span>

        <Link
          href={`/notes/${note.id}`}
          className="flex-1 truncate text-[13px]"
          title={note.title}
        >
          {note.title || t("untitled")}
        </Link>

        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={(e) => {
              e.preventDefault();
              setMenuOpen((prev) => !prev);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
            style={{ color: "var(--text-muted)" }}
            aria-label="Actions"
          >
            <FaEllipsisH className="w-3 h-3" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 py-1 rounded-lg shadow-lg z-20 min-w-[160px]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onCreateSubPage?.(note.id);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--surface-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <FaPlus className="w-3 h-3" /> {t("addSubPage")}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDeleteNote?.(note.id);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors"
                style={{ color: "var(--danger)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--surface-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <FaTrash className="w-3 h-3" /> {t("delete")}
              </button>
            </div>
          )}
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {note.children.map((child) => (
            <PageTreeItem
              key={child.id}
              note={child}
              depth={depth + 1}
              activeNoteId={activeNoteId}
              onCreateSubPage={onCreateSubPage}
              onDeleteNote={onDeleteNote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
