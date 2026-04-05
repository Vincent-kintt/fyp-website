"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronRight, MoreHorizontal, Plus, Trash2, Pencil, Copy } from "lucide-react";
import NoteIcon from "./NoteIcon";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useClickOutside } from "@/hooks/useClickOutside";

export default function PageTreeItem({
  note,
  depth = 0,
  expanded = false,
  hasChildren = false,
  onToggleExpand,
  isOverlay = false,
  descendantCount = 0,
  dropIndicator = null,
  activeNoteId,
  onCreateSubPage,
  onDeleteNote,
  onRename,
  onDuplicate,
}) {
  const t = useTranslations("notes");
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useClickOutside(() => setMenuOpen(false));

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id, disabled: isOverlay });

  const sortableStyle = isOverlay
    ? {}
    : { transform: CSS.Transform.toString(transform), transition };

  const isActive = note.id === activeNoteId;

  if (isOverlay) {
    return (
      <div
        className="notes-tree-item notes-tree-overlay"
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <NoteIcon icon={note.icon} hasChildren={hasChildren} expanded={expanded} size={15} />
        <span className="flex-1 truncate text-[14px]">{note.title || t("untitled")}</span>
        {descendantCount > 0 && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ background: "var(--surface-hover)", color: "var(--text-muted)" }}
          >
            +{descendantCount}
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      {dropIndicator === "before" && (
        <div className="notes-drop-indicator" style={{ marginLeft: `${12 + depth * 16}px` }} />
      )}
      <div ref={setNodeRef} style={sortableStyle} {...attributes}>
        <div
          className="notes-tree-item group"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          data-active={isActive}
          data-dragging={isDragging}
          data-drop-target={dropIndicator === "into"}
        >
          {/* Drag handle area: chevron + icon */}
          <div
            ref={setActivatorNodeRef}
            {...listeners}
            className="flex items-center gap-1 flex-shrink-0 cursor-grab active:cursor-grabbing"
          >
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleExpand?.(note.id);
              }}
              className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded"
              style={{
                color: "var(--text-muted)",
                visibility: hasChildren ? "visible" : "hidden",
              }}
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              <ChevronRight
                size={12}
                strokeWidth={1.5}
                style={{
                  transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 150ms ease",
                }}
              />
            </button>

            <NoteIcon icon={note.icon} hasChildren={hasChildren} expanded={expanded} size={15} />
          </div>

          {renaming ? (
            <input
              autoFocus
              className="flex-1 text-[14px] bg-transparent outline-none px-1 rounded"
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
              className="flex-1 truncate text-[14px]"
              title={note.title}
            >
              {note.title || t("untitled")}
            </Link>
          )}

          <div className="relative flex-shrink-0" ref={menuRef}>
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100" style={{ transition: "opacity 150ms ease" }}>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen((prev) => !prev);
                }}
                className="p-1 rounded"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                aria-label="Actions"
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal size={14} strokeWidth={1.5} />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCreateSubPage?.(note.id);
                }}
                className="p-1 rounded"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                aria-label={t("addSubPage")}
              >
                <Plus size={14} strokeWidth={1.5} />
              </button>
            </div>

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
                  onClick={() => { setMenuOpen(false); onCreateSubPage?.(note.id); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  role="menuitem"
                >
                  <Plus size={14} strokeWidth={1.5} /> {t("addSubPage")}
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setRenameValue(note.title || ""); setRenaming(true); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  role="menuitem"
                >
                  <Pencil size={14} strokeWidth={1.5} /> {t("rename")}
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDuplicate?.(note.id); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  role="menuitem"
                >
                  <Copy size={14} strokeWidth={1.5} /> {t("duplicate")}
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDeleteNote?.(note.id); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left transition-colors"
                  style={{ color: "var(--danger)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  role="menuitem"
                >
                  <Trash2 size={14} strokeWidth={1.5} /> {t("delete")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {dropIndicator === "after" && (
        <div className="notes-drop-indicator" style={{ marginLeft: `${12 + depth * 16}px` }} />
      )}
    </>
  );
}
