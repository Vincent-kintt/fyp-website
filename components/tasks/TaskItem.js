"use client";

import { useState } from "react";
import Link from "next/link";
import { FaClock, FaEdit, FaTrash } from "react-icons/fa";
import { format, isToday, isTomorrow, isPast } from "date-fns";

export default function TaskItem({ task, onToggleComplete, onDelete, showDate = true }) {
  const [isCompleting, setIsCompleting] = useState(false);

  const handleToggle = async () => {
    setIsCompleting(true);
    await onToggleComplete(task.id, !task.completed);
    setTimeout(() => setIsCompleting(false), 300);
  };

  const formatTaskDate = (dateTime) => {
    const date = new Date(dateTime);
    if (isToday(date)) {
      return format(date, "'Today at' h:mm a");
    }
    if (isTomorrow(date)) {
      return format(date, "'Tomorrow at' h:mm a");
    }
    return format(date, "MMM d 'at' h:mm a");
  };

  const getCategoryColor = (category) => {
    const colors = {
      work: "bg-blue-500",
      personal: "bg-green-500",
      health: "bg-red-500",
      other: "bg-gray-500"
    };
    return colors[category] || colors.other;
  };

  const isOverdue = !task.completed && isPast(new Date(task.dateTime));

  return (
    <div
      className={`group flex items-start gap-3 p-4 rounded-xl transition-all duration-200 hover:opacity-90 ${
        task.completed ? "opacity-60" : ""
      } ${isCompleting ? "scale-[0.98]" : ""}`}
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
        borderWidth: "1px",
        borderStyle: "solid",
      }}
    >
      {/* Category indicator */}
      <div className={`w-1 h-full min-h-[40px] rounded-full ${getCategoryColor(task.category)}`} />

      {/* Checkbox */}
      <button
        onClick={handleToggle}
        className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded-full border-2 transition-all duration-200 ${
          task.completed
            ? "bg-green-500 border-green-500"
            : "hover:border-blue-500"
        }`}
        style={{
          borderColor: task.completed ? undefined : "var(--text-muted)",
        }}
      >
        {task.completed && (
          <svg className="w-full h-full text-white p-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3
          className={`text-sm font-medium transition-all duration-200 ${
            task.completed ? "line-through" : ""
          }`}
          style={{
            color: task.completed ? "var(--text-muted)" : "var(--text-primary)",
          }}
        >
          {task.title}
        </h3>
        {task.description && (
          <p 
            className="text-xs mt-0.5 line-clamp-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {task.description}
          </p>
        )}
        {showDate && (
          <div 
            className="flex items-center gap-1 mt-1 text-xs"
            style={{ color: isOverdue ? "#dc2626" : "var(--text-muted)" }}
          >
            <FaClock className="w-3 h-3" />
            <span>{formatTaskDate(task.dateTime)}</span>
            {task.recurring && (
              <span className="ml-2 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded text-[10px]">
                {task.recurringType}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Link
          href={`/reminders/${task.id}/edit`}
          className="p-1.5 hover:text-blue-600 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <FaEdit className="w-3.5 h-3.5" />
        </Link>
        <button
          onClick={() => onDelete(task.id)}
          className="p-1.5 hover:text-red-600 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <FaTrash className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
