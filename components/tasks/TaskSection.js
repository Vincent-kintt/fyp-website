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
  showDate = true,
  accentColor = "blue"
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const accentColors = {
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-green-600 dark:text-green-400",
    orange: "text-orange-600 dark:text-orange-400",
    purple: "text-purple-600 dark:text-purple-400",
    gray: "text-gray-600 dark:text-gray-400",
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
