"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Plus, Search, Trash2 } from "lucide-react";
import TrashSection from "./TrashSection";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { buildTree } from "@/lib/notes/tree";
import { useDndSensors, computeSortOrders } from "@/lib/dnd";
import PageTreeItem from "./PageTreeItem";

export default function PageTree({
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
  const [trashOpen, setTrashOpen] = useState(false);
  const tree = buildTree(notes);
  const sensors = useDndSensors();
  const flatIds = notes.map((n) => n.id);

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeNote = notes.find((n) => n.id === active.id);
      const overNote = notes.find((n) => n.id === over.id);
      if (!activeNote || !overNote) return;

      const targetParentId = overNote.parentId;
      const siblings = notes
        .filter((n) => n.parentId === targetParentId && n.id !== active.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const overIndex = siblings.findIndex((n) => n.id === over.id);
      siblings.splice(overIndex, 0, { ...activeNote, parentId: targetParentId });

      const updates = computeSortOrders(siblings).map((s) => ({
        ...s,
        parentId: targetParentId,
      }));

      onReorder?.(updates);
    },
    [notes, onReorder]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Search bar — triggers global ⌘K search */}
      <button
        onClick={() => {
          document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
          );
        }}
        className="flex items-center gap-2 mx-2 mt-2 mb-1 px-2.5 py-1.5 rounded-md text-[12.5px] text-left"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <Search size={13} strokeWidth={1.5} />
        {t("search")}
        <kbd
          className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-mono"
          style={{ background: "var(--surface-hover)", color: "var(--text-muted)" }}
        >
          ⌘K
        </kbd>
      </button>

      {/* Section label */}
      <div className="px-3 pt-3 pb-1">
        <span
          className="text-[11px] font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          {t("pages")}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-1 px-1">
        {tree.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {t("emptyState")}
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
              {tree.map((note) => (
                <PageTreeItem
                  key={note.id}
                  note={note}
                  activeNoteId={activeNoteId}
                  onCreateSubPage={(parentId) => onCreateNote?.(parentId)}
                  onDeleteNote={onDeleteNote}
                  onRename={onRename}
                  onDuplicate={onDuplicate}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* New Page button */}
      <button
        onClick={() => onCreateNote?.()}
        className="flex items-center gap-2 mx-1 px-3 py-1.5 rounded-md text-[13px]"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--surface-hover)";
          e.currentTarget.style.color = "var(--text-secondary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--text-muted)";
        }}
      >
        <Plus size={14} strokeWidth={1.5} />
        {t("newPage")}
      </button>

      {/* Trash section — pinned to bottom */}
      <div style={{ marginTop: "auto", borderTop: "1px solid var(--border)" }}>
        <button
          onClick={() => setTrashOpen((prev) => !prev)}
          className="flex items-center gap-2 w-full px-3 py-2 text-[12.5px]"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--surface-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <Trash2 size={14} strokeWidth={1.5} />
          {t("trash")}
          {trashedNotes?.length > 0 && (
            <span
              className="ml-auto text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              {trashedNotes.length}
            </span>
          )}
          <ChevronRight
            size={10}
            strokeWidth={1.5}
            style={{
              transform: trashOpen ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 150ms ease",
              marginLeft: trashedNotes?.length > 0 ? "4px" : "auto",
            }}
          />
        </button>
        {trashOpen && (
          <TrashSection
            trashedNotes={trashedNotes}
            onRestore={onRestore}
            onPermanentDelete={onPermanentDelete}
          />
        )}
      </div>
    </div>
  );
}
