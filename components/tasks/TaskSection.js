"use client";

import { useState, useEffect, memo } from "react";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import TaskItem from "./TaskItem";
import SortableTaskItem from "./SortableTaskItem";
import EmptyState from "@/components/ui/EmptyState";
import { getSectionDropColor } from "@/lib/dnd";

// Visual wrapper for external drag-over feedback (no droppable — that lives in TaskListContent)
const DroppableWrapper = memo(function DroppableWrapper({ sectionId, children, isExternalDragOver }) {
  return (
    <div
      className={`mb-6 rounded-lg transition-colors ${
        isExternalDragOver ? getSectionDropColor(sectionId) : ""
      }`}
    >
      {children}
    </div>
  );
});

export default function TaskSection({
  title,
  icon,
  tasks,
  onToggleComplete,
  onDelete,
  onUpdate,
  onSnooze,
  onEdit,
  collapsible = true,
  defaultCollapsed = false,
  emptyMessage = "No tasks",
  emptyAction = null,
  showDate = true,
  accentColor = "blue",
  sortable = false,
  sectionId = null,
  droppable = false,
  isExternalDragOver = false,
  completingIds = null,
  forceExpand = false,
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Auto-expand when parent requests (drag hover)
  useEffect(() => {
    if (forceExpand && isCollapsed) {
      setIsCollapsed(false);
    }
  }, [forceExpand, isCollapsed]);

  const accentColors = {
    blue: "text-primary",
    green: "text-success",
    orange: "text-warning",
    purple: "text-info",
    gray: "text-text-muted",
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;

  const inner = (
    <>
      {/* Header */}
      <button
        onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
        className={`flex items-center gap-2 w-full text-left mb-2 ${
          collapsible ? "cursor-pointer" : "cursor-default"
        }`}
      >
        {collapsible && (
          <span style={{ color: "var(--text-muted)" }}>
            {isCollapsed ? (
              <FaChevronRight className="w-3 h-3" />
            ) : (
              <FaChevronDown className="w-3 h-3" />
            )}
          </span>
        )}
        {icon && <span className={accentColors[accentColor]}>{icon}</span>}
        <h2 className={`text-sm font-semibold ${accentColors[accentColor]}`}>
          {title}
        </h2>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {completedCount > 0 ? `${completedCount}/${totalCount}` : totalCount}
        </span>
      </button>

      {/* Task List */}
      {!isCollapsed ? (
        <TaskListContent
          tasks={tasks}
          sortable={sortable}
          sectionId={sectionId}
          droppable={droppable}
          isExternalDragOver={isExternalDragOver}
          onToggleComplete={onToggleComplete}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onSnooze={onSnooze}
          onEdit={onEdit}
          showDate={showDate}
          emptyAction={emptyAction}
          emptyMessage={emptyMessage}
          completingIds={completingIds}
        />
      ) : (
        droppable && sectionId && (
          <CollapsedDropZone sectionId={sectionId} isExternalDragOver={isExternalDragOver} />
        )
      )}
    </>
  );

  // Isolate useDroppable subscription in DroppableWrapper to prevent
  // all TaskSections from re-rendering on every drag event
  if (droppable && sectionId) {
    return (
      <DroppableWrapper sectionId={sectionId} isExternalDragOver={isExternalDragOver}>
        {inner}
      </DroppableWrapper>
    );
  }

  return <div className="mb-6">{inner}</div>;
}

// Minimal droppable zone for collapsed sections — keeps drag target active
function CollapsedDropZone({ sectionId, isExternalDragOver }) {
  const { setNodeRef } = useDroppable({ id: sectionId });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg transition-colors ${
        isExternalDragOver ? getSectionDropColor(sectionId) : ""
      }`}
      style={{ minHeight: "8px" }}
    />
  );
}

function TaskListContent({
  tasks, sortable, sectionId, droppable, isExternalDragOver,
  onToggleComplete, onDelete, onUpdate, onSnooze, onEdit, showDate, emptyAction, emptyMessage,
  completingIds,
}) {
  const { setNodeRef } = useDroppable({ id: sectionId || "default", disabled: !droppable });
  const ItemComponent = sortable ? SortableTaskItem : TaskItem;

  const content = (
    <div
      ref={droppable ? setNodeRef : undefined}
      className={`space-y-2 rounded-lg transition-colors ${
        isExternalDragOver ? getSectionDropColor(sectionId) : ""
      }`}
      style={{ minHeight: droppable ? "48px" : undefined }}
      aria-live="polite"
    >
      {tasks.length > 0 ? (
        tasks.map((task, index) => (
          <ItemComponent
            key={task.id}
            task={task}
            onToggleComplete={onToggleComplete}
            onDelete={onDelete}
            onUpdate={onUpdate}
            onSnooze={onSnooze}
            onEdit={onEdit}
            showDate={showDate}
            isCompleting={completingIds?.has(task.id)}
            animationClass="task-stagger-enter"
            animationDelay={Math.min(index * 40, 600)}
          />
        ))
      ) : emptyAction ? (
        <div
          onClick={emptyAction.onClick}
          className="p-4 rounded-lg border border-dashed border-[var(--card-border)] hover:bg-[var(--background)] transition-colors cursor-pointer group text-center"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-xl group-hover:scale-110 transition-transform">{emptyAction.icon || ""}</span>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{emptyAction.text}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{emptyAction.subtext}</p>
          </div>
        </div>
      ) : (
        <EmptyState title={emptyMessage} />
      )}
    </div>
  );

  if (sortable) {
    return (
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        {content}
      </SortableContext>
    );
  }

  return content;
}
