"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { FaPlus } from "react-icons/fa";
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
}) {
  const t = useTranslations("notes");
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
      <div className="flex items-center justify-between px-3 py-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          {t("title")}
        </span>
        <button
          onClick={() => onCreateNote?.()}
          className="p-1 rounded transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--text-primary)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--text-muted)")
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
    </div>
  );
}
