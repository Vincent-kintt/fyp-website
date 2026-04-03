"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FaChevronRight, FaEllipsisH, FaPlus, FaTrash, FaEdit, FaCopy } from "react-icons/fa";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useClickOutside } from "@/hooks/useClickOutside";

export default function PageTreeItem({
  note,
  depth = 0,
  activeNoteId,
  onCreateSubPage,
  onDeleteNote,
  onRename,
  onDuplicate,
}) {
  const t = useTranslations("notes");
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
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

        {renaming ? (
          <input
            autoFocus
            className="flex-1 text-[13px] bg-transparent outline-none px-1 rounded"
            style={{ color: "var(--text-primary)", border: "1px solid var(--border-focus)" }}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => {
              if (renameValue.trim() && renameValue !== note.title) {
                onRename?.(note.id, renameValue.trim());
              }
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (renameValue.trim() && renameValue !== note.title) {
                  onRename?.(note.id, renameValue.trim());
                }
                setRenaming(false);
              }
              if (e.key === "Escape") {
                setRenaming(false);
              }
            }}
          />
        ) : (
          <Link
            href={`/notes/${note.id}`}
            className="flex-1 truncate text-[13px]"
            title={note.title}
          >
            {note.title || t("untitled")}
          </Link>
        )}

        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={(e) => {
              e.preventDefault();
              setMenuOpen((prev) => !prev);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity"
            style={{ color: "var(--text-muted)" }}
            aria-label="Actions"
            aria-haspopup="true"
            aria-expanded={menuOpen}
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
              role="menu"
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
                role="menuitem"
              >
                <FaPlus className="w-3 h-3" /> {t("addSubPage")}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setRenameValue(note.title || "");
                  setRenaming(true);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                role="menuitem"
              >
                <FaEdit className="w-3 h-3" /> {t("rename")}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate?.(note.id);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                role="menuitem"
              >
                <FaCopy className="w-3 h-3" /> {t("duplicate")}
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
                role="menuitem"
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
              onRename={onRename}
              onDuplicate={onDuplicate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
