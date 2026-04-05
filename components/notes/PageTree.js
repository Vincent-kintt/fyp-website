"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, File, Plus, Trash2 } from "lucide-react";
import TrashSection from "./TrashSection";
import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { buildTree, flattenVisibleTree, getDescendantIds, computeTreeReorder } from "@/lib/notes/tree";
import { useDndSensors, DROP_ANIMATION_CONFIG } from "@/lib/dnd";
import PageTreeItem from "./PageTreeItem";

// Drop zone thresholds: top 25% = before, middle 50% = into, bottom 25% = after
const DROP_ZONE_BEFORE = 0.25;
const DROP_ZONE_AFTER = 0.75;

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

  // Auto-expand parents when new children appear
  useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const note of notes) {
        if (note.parentId && notes.some((n) => n.id === note.parentId) && !next.has(note.parentId)) {
          const parentHadChildren = prev.has(note.parentId);
          if (!parentHadChildren) {
            next.add(note.parentId);
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [notes]);

  // Drag state
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [dropPosition, setDropPosition] = useState(null); // "before" | "into" | "after"
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

  // Find active note for overlay
  const activeNote = activeId ? notes.find((n) => n.id === activeId) : null;
  const activeDescendantCount = activeId ? descendantIdsRef.current.size : 0;

  // Drop indicator for each item — driven by dropPosition state
  const getDropIndicator = useCallback(
    (itemId) => {
      if (!dropPosition || !overId || !activeId) return null;
      if (itemId !== overId) return null;
      return dropPosition;
    },
    [dropPosition, overId, activeId],
  );

  // Auto-expand timer ref
  const autoExpandTimerRef = useRef(null);
  const lastOverIdRef = useRef(null);

  // Compute drop zone from pointer position within the over element
  const computeDropZone = useCallback((event) => {
    const over = event.over;
    if (!over) {
      setOverId(null);
      setDropPosition(null);
      return;
    }

    setOverId(over.id);

    const overRect = over.rect;
    if (!overRect) return;

    // Pointer Y = activation point + delta
    const pointerY = event.activatorEvent.clientY + event.delta.y;
    const relativeY = (pointerY - overRect.top) / overRect.height;

    // Check if over-item is a leaf (no children) — leaf nodes only get before/after
    const overItem = sortableItems.find((i) => i.id === over.id);
    const isLeaf = overItem && !overItem.hasChildren;

    let position;
    if (isLeaf) {
      // Leaf: 50/50 split — before or after only
      position = relativeY < 0.5 ? "before" : "after";
    } else {
      // Non-leaf: top 25% = before, middle 50% = into, bottom 25% = after
      if (relativeY < DROP_ZONE_BEFORE) {
        position = "before";
      } else if (relativeY > DROP_ZONE_AFTER) {
        position = "after";
      } else {
        position = "into";
      }
    }

    setDropPosition(position);

    // Auto-expand: if hovering "into" zone of a collapsed folder for 500ms
    if (position === "into" && over.id !== lastOverIdRef.current) {
      clearTimeout(autoExpandTimerRef.current);
      lastOverIdRef.current = over.id;

      if (!expandedIds.has(over.id)) {
        autoExpandTimerRef.current = setTimeout(() => {
          setExpandedIds((prev) => new Set([...prev, over.id]));
        }, 500);
      }
    } else if (position !== "into" || over.id !== lastOverIdRef.current) {
      clearTimeout(autoExpandTimerRef.current);
      lastOverIdRef.current = null;
    }
  }, [sortableItems, expandedIds]);

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
    computeDropZone(event);
  }, [computeDropZone]);

  const handleDragOver = useCallback((event) => {
    computeDropZone(event);
  }, [computeDropZone]);

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !dropPosition) {
        resetDragState();
        return;
      }

      const updates = computeTreeReorder(notes, active.id, over.id, dropPosition);

      if (updates.length > 0) {
        onReorder?.(updates);

        // Auto-expand if dropped into a page
        if (dropPosition === "into" && !expandedIds.has(over.id)) {
          setExpandedIds((prev) => new Set([...prev, over.id]));
        }
      }

      resetDragState();
    },
    [notes, onReorder, dropPosition, expandedIds],
  );

  const handleDragCancel = useCallback(() => {
    resetDragState();
  }, []);

  function resetDragState() {
    setActiveId(null);
    setOverId(null);
    setDropPosition(null);
    descendantIdsRef.current = new Set();
    clearTimeout(autoExpandTimerRef.current);
    lastOverIdRef.current = null;
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
                  depth={0}
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
