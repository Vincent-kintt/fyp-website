"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, File, Plus, Trash2 } from "lucide-react";
import TrashSection from "./TrashSection";
import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { buildTree, flattenVisibleTree, getDescendantIds, getProjection, computeTreeReorder } from "@/lib/notes/tree";
import { useDndSensors, DROP_ANIMATION_CONFIG } from "@/lib/dnd";
import PageTreeItem from "./PageTreeItem";

const INDENT_WIDTH = 16;

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
  const sensors = useDndSensors();

  // Expand/collapse state — default: all notes with children are expanded
  const [expandedIds, setExpandedIds] = useState(() => {
    const ids = new Set();
    for (const note of notes) {
      if (notes.some((n) => n.parentId === note.id)) {
        ids.add(note.id);
      }
    }
    return ids;
  });

  // Drag state
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const descendantIdsRef = useRef(new Set());

  const toggleExpand = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Build tree + flatten to visible rows
  const tree = useMemo(() => buildTree(notes), [notes]);
  const flatVisible = useMemo(
    () => flattenVisibleTree(tree, expandedIds),
    [tree, expandedIds],
  );

  // During drag: filter out active item's descendants
  const sortableItems = useMemo(() => {
    if (!activeId) return flatVisible;
    return flatVisible.filter((item) => !descendantIdsRef.current.has(item.id));
  }, [flatVisible, activeId]);

  const sortableIds = useMemo(() => sortableItems.map((item) => item.id), [sortableItems]);

  // Projection: where would the item land?
  const projected = useMemo(() => {
    if (!activeId || !overId) return null;
    return getProjection(sortableItems, activeId, overId, dragOffsetX, INDENT_WIDTH);
  }, [sortableItems, activeId, overId, dragOffsetX]);

  // Find active note for overlay
  const activeNote = activeId ? notes.find((n) => n.id === activeId) : null;
  const activeDescendantCount = activeId ? descendantIdsRef.current.size : 0;

  // Compute drop indicator for each item
  const getDropIndicator = useCallback(
    (itemId) => {
      if (!projected || !overId) return null;
      if (itemId === overId && projected.depth > (sortableItems.find((i) => i.id === overId)?.depth ?? 0)) {
        return "into";
      }
      if (itemId === overId) return "after";
      return null;
    },
    [projected, overId, sortableItems],
  );

  // DnD handlers
  const handleDragStart = useCallback(
    (event) => {
      const id = event.active.id;
      setActiveId(id);
      descendantIdsRef.current = getDescendantIds(notes, id);
    },
    [notes],
  );

  const handleDragMove = useCallback((event) => {
    setDragOffsetX(event.delta.x);
    setOverId(event.over?.id ?? null);
  }, []);

  const handleDragOver = useCallback((event) => {
    setOverId(event.over?.id ?? null);
  }, []);

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        resetDragState();
        return;
      }

      const finalProjection = getProjection(sortableItems, active.id, over.id, dragOffsetX, INDENT_WIDTH);
      const overIndex = sortableItems.findIndex((item) => item.id === over.id);
      const updates = computeTreeReorder(notes, active.id, finalProjection, overIndex);

      if (updates.length > 0) {
        onReorder?.(updates);

        // Auto-expand if dropped into a collapsed folder
        if (finalProjection.parentId && !expandedIds.has(finalProjection.parentId)) {
          setExpandedIds((prev) => new Set([...prev, finalProjection.parentId]));
        }
      }

      resetDragState();
    },
    [sortableItems, notes, onReorder, dragOffsetX, expandedIds],
  );

  const handleDragCancel = useCallback(() => {
    resetDragState();
  }, []);

  function resetDragState() {
    setActiveId(null);
    setOverId(null);
    setDragOffsetX(0);
    descendantIdsRef.current = new Set();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-2 px-1">
        {flatVisible.length === 0 ? (
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
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {sortableItems.map((item) => {
                const note = notes.find((n) => n.id === item.id);
                if (!note) return null;
                return (
                  <PageTreeItem
                    key={item.id}
                    note={note}
                    depth={item.depth}
                    expanded={expandedIds.has(item.id)}
                    hasChildren={item.hasChildren}
                    onToggleExpand={toggleExpand}
                    dropIndicator={getDropIndicator(item.id)}
                    activeNoteId={activeNoteId}
                    onCreateSubPage={(parentId) => onCreateNote?.(parentId)}
                    onDeleteNote={onDeleteNote}
                    onRename={onRename}
                    onDuplicate={onDuplicate}
                  />
                );
              })}
            </SortableContext>

            <DragOverlay dropAnimation={DROP_ANIMATION_CONFIG}>
              {activeNote ? (
                <PageTreeItem
                  note={activeNote}
                  depth={projected?.depth ?? 0}
                  expanded={false}
                  hasChildren={activeDescendantCount > 0}
                  isOverlay
                  descendantCount={activeDescendantCount}
                  activeNoteId={activeNoteId}
                />
              ) : null}
            </DragOverlay>
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
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Trash2 size={14} strokeWidth={1.5} />
          {t("trash")}
          {trashedNotes?.length > 0 && (
            <span className="ml-auto text-[10px]" style={{ color: "var(--text-muted)" }}>
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
