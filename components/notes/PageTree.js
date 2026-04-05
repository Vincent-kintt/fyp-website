"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, File, Plus, Trash2 } from "lucide-react";
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
      <div className="flex-1 overflow-y-auto py-2 px-1">
        {tree.length === 0 ? (
          <div className="flex flex-col items-center px-3 py-10 text-center gap-2">
            <File size={32} strokeWidth={1} style={{ color: "var(--text-muted)", opacity: 0.15 }} />
            <p className="text-xs" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
              {t("noPages")}
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
