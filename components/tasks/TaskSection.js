"use client";

import { useState } from "react";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";
import TaskItem from "./TaskItem";

export default function TaskSection({
  title,
  icon,
  tasks,
  onToggleComplete,
  onDelete,
  onUpdate,
  collapsible = true,
  defaultCollapsed = false,
  emptyMessage = "No tasks",
  emptyAction = null, // New prop for actionable empty state
  showDate = true,
  accentColor = "blue"
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const accentColors = {
    blue: "text-primary",
    green: "text-success",
    orange: "text-warning",
    purple: "text-info",
    gray: "text-text-muted",
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;

  return (
    <div className="mb-6">
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
      {!isCollapsed && (
        <div className="space-y-2">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggleComplete={onToggleComplete}
                onDelete={onDelete}
                onUpdate={onUpdate}
                showDate={showDate}
              />
            ))
          ) : emptyAction ? (
            <div 
              onClick={emptyAction.onClick}
              className="p-4 rounded-lg border border-dashed border-[var(--card-border)] hover:bg-[var(--background)] transition-colors cursor-pointer group text-center"
            >
              <div className="flex flex-col items-center gap-2">
                <span className="text-xl group-hover:scale-110 transition-transform">{emptyAction.icon || "🤖"}</span>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{emptyAction.text}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{emptyAction.subtext}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm py-3 px-4" style={{ color: "var(--text-muted)" }}>
              {emptyMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
